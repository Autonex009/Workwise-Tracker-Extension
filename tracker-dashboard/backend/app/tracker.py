"""Tracker dashboard endpoints (manager-only).

Roster + names + PM-team scoping come from the production DB (READ-ONLY).
Metrics come from the WorkWise telemetry DB. The two are merged by employee
email. PMs are scoped to their team; admins see everyone.
"""
import os
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

DAY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import text, bindparam
from sqlalchemy.orm import Session

from .auth import require_manager
from .db import get_auth_db, get_telemetry_db

router = APIRouter(prefix="/api/tracker", tags=["tracker"])

# Live-status window. 90s matches the extension's flush cadence in production;
# for a static demo dataset, set OFFLINE_THRESHOLD_S high so seeded statuses
# don't all decay to "offline".
OFFLINE_THRESHOLD_S = int(os.getenv("OFFLINE_THRESHOLD_S", "90"))


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def derive_status(last_event_at, session_open, last_idle_state, now):
    if not last_event_at:
        return "offline"
    if (now - last_event_at).total_seconds() > OFFLINE_THRESHOLD_S or not session_open:
        return "offline"
    if last_idle_state in ("idle", "locked"):
        return "idle"
    return "active"


TAB_GAP_CLAMP_MS = 30 * 60 * 1000


def compute_tab_time(rows):
    """Raw wall-clock time spent per tab — keyed by the FULL URL. The gap between
    consecutive events is attributed to the URL you were on, with NO activity/idle
    gating (filters come later). rows: [{ts, url}] ordered ascending."""
    totals = {}
    for i in range(len(rows) - 1):
        url = rows[i]["url"]
        if not url:
            continue
        gap = (rows[i + 1]["ts"] - rows[i]["ts"]).total_seconds() * 1000
        gap = min(max(gap, 0), TAB_GAP_CLAMP_MS)
        totals[url] = totals.get(url, 0) + gap
    out = [{"url": u, "active_ms": int(ms)} for u, ms in totals.items()]
    out.sort(key=lambda x: x["active_ms"], reverse=True)
    return out[:12]


def domain_of(url):
    """Exact hostname of a URL, lowercased, leading www. stripped. None if unparseable."""
    if not url:
        return None
    host = urlparse(url).hostname
    if not host:
        return None
    host = host.lower()
    return host[4:] if host.startswith("www.") else host


def load_work_sites(tel_db: Session, email):
    """{domain: {is_work, color, label}} for one employee. Empty if the table is
    absent (e.g. DDL blocked on a read-only sandbox role)."""
    try:
        rows = tel_db.execute(text(
            "SELECT domain, is_work, color, label FROM work_sites WHERE email = :e"),
            {"e": email}).mappings().all()
    except Exception:
        tel_db.rollback()
        return {}
    return {r["domain"]: dict(r) for r in rows}


def get_roster(auth_db: Session, user: dict):
    """Active employees the viewer may see: admin -> all; pm -> their team."""
    if user["role"] == "admin":
        rows = auth_db.execute(
            text("SELECT email, name, designation FROM employees "
                 "WHERE status = 'active' AND email IS NOT NULL ORDER BY name")
        ).mappings().all()
    else:
        rows = auth_db.execute(
            text("""
                SELECT DISTINCT e.email, e.name, e.designation
                FROM employees e
                JOIN allocations a   ON a.employee_id = e.id
                JOIN daily_sheets ds ON a.sub_project_id = ds.id
                LEFT JOIN sub_projects sp  ON ds.sub_project_id = sp.id
                LEFT JOIN main_projects mp ON ds.main_project_id = mp.id
                WHERE (sp.pm_id = :emp OR mp.program_manager_id = :emp)
                  AND e.status = 'active' AND e.email IS NOT NULL
                ORDER BY e.name
            """),
            {"emp": user.get("employee_id")},
        ).mappings().all()
    return [dict(r) for r in rows]


def _fetch_telemetry(tel_db: Session, emails, day):
    """Return {email: stats} and {email: status_row} for the given emails."""
    if not emails:
        return {}, {}
    stats_q = text(
        "SELECT email, active_ms, paused_ms, focus_ratio, tasks_started, tasks_skipped, "
        "session_count FROM daily_user_stats WHERE day = :d AND email IN :em"
    ).bindparams(bindparam("em", expanding=True))
    status_q = text(
        "SELECT email, last_event_at, last_idle_state, session_open "
        "FROM user_status WHERE email IN :em"
    ).bindparams(bindparam("em", expanding=True))
    stats = {r["email"]: dict(r) for r in tel_db.execute(stats_q, {"d": day, "em": emails}).mappings()}
    statuses = {r["email"]: dict(r) for r in tel_db.execute(status_q, {"em": emails}).mappings()}
    return stats, statuses


@router.get("/team")
def team(day: str | None = None, user=Depends(require_manager),
         auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    today = day or _today()
    people = get_roster(auth_db, user)
    emails = [p["email"].lower() for p in people if p["email"]]
    stats, statuses = _fetch_telemetry(tel_db, emails, today)
    now = datetime.now(timezone.utc)

    members = []
    for p in people:
        e = p["email"].lower() if p["email"] else None
        st = statuses.get(e)
        s = stats.get(e, {})
        members.append({
            "email": p["email"], "name": p["name"], "designation": p["designation"],
            "status": derive_status(st["last_event_at"], st["session_open"], st["last_idle_state"], now) if st else "offline",
            "active_ms": int(s.get("active_ms") or 0),
            "paused_ms": int(s.get("paused_ms") or 0),
            "focus_ratio": s.get("focus_ratio"),
            "tasks_started": s.get("tasks_started") or 0,
            "tasks_skipped": s.get("tasks_skipped") or 0,
            "session_count": s.get("session_count") or 0,
        })

    total_active = sum(m["active_ms"] for m in members)
    ts = sum(m["tasks_started"] for m in members)
    tk = sum(m["tasks_skipped"] for m in members)
    return {
        "day": today,
        "scope": user["role"],
        "kpis": {
            "members": len(members),
            "active_now": sum(1 for m in members if m["status"] == "active"),
            "with_data": sum(1 for m in members if m["session_count"] or m["active_ms"]),
            "team_active_ms": total_active,
            "tasks_started": ts,
            "tasks_skipped": tk,
            "skip_rate": (tk / ts) if ts else None,
        },
        "members": members,
    }


def _assert_visible(auth_db, user, email):
    """PMs may only view their own team's members; admins anyone."""
    if user["role"] == "admin":
        return
    allowed = {p["email"].lower() for p in get_roster(auth_db, user) if p["email"]}
    if email.lower() not in allowed:
        raise HTTPException(status_code=403, detail="Employee not in your team")


ZERO_DAY_STATS = {
    "active_ms": 0, "paused_ms": 0, "session_count": 0, "pause_count": 0,
    "focus_ratio": None, "tasks_started": 0, "tasks_skipped": 0, "tasks_exited": 0, "avg_task_ms": None,
}


@router.get("/insights/{email}")
def insights(email: str, day: str | None = None, days: int = 7, user=Depends(require_manager),
             auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    email = email.lower().strip()
    _assert_visible(auth_db, user, email)
    days = max(1, min(days, 90))
    selected = day if (day and DAY_RE.match(day)) else _today()
    from_day = (datetime.strptime(selected, "%Y-%m-%d") - timedelta(days=days - 1)).strftime("%Y-%m-%d")

    profile = auth_db.execute(
        text("SELECT name, designation FROM employees WHERE email = :e"), {"e": email}
    ).mappings().first()

    # 7-day trend ending on the selected day
    daily = tel_db.execute(text(
        "SELECT day, active_ms, paused_ms, session_count, pause_count, focus_ratio, "
        "tasks_started, tasks_skipped, tasks_exited, avg_task_ms "
        "FROM daily_user_stats WHERE email = :e AND day BETWEEN :from_day AND :d ORDER BY day"
    ), {"e": email, "from_day": from_day, "d": selected}).mappings().all()

    # Selected day's KPI stats (zeros if the employee had no activity that day)
    ds = tel_db.execute(text(
        "SELECT active_ms, paused_ms, session_count, pause_count, focus_ratio, "
        "tasks_started, tasks_skipped, tasks_exited, avg_task_ms "
        "FROM daily_user_stats WHERE email = :e AND day = :d"), {"e": email, "d": selected}).mappings().first()
    day_stats = dict(ds) if ds else dict(ZERO_DAY_STATS)

    # Per-employee work-site classification (which domains count as work + colors).
    work_sites = load_work_sites(tel_db, email)

    # Raw time-on-tab computed live from raw_events (not the gated rollup).
    nav = tel_db.execute(text(
        "SELECT ts, url FROM raw_events WHERE email = :e AND day = :d AND url IS NOT NULL "
        "ORDER BY ts ASC"), {"e": email, "d": selected}).mappings().all()
    tab_time = compute_tab_time([dict(r) for r in nav])
    # Classify each tab entry by exact hostname; split wall-clock into work / off-work.
    work_ms = off_ms = 0
    for t in tab_time:
        dom = domain_of(t["url"])
        cfg = work_sites.get(dom)
        t["domain"] = dom
        t["is_work"] = bool(cfg["is_work"]) if cfg else False
        t["color"] = cfg["color"] if cfg else None
        if t["is_work"]:
            work_ms += t["active_ms"]
        else:
            off_ms += t["active_ms"]
    sec = tel_db.execute(text(
        "SELECT category, active_ms FROM daily_encord_section_time WHERE email = :e AND day = :d"),
        {"e": email, "d": selected}).mappings().all()
    hourly = tel_db.execute(text(
        "SELECT hour, event_type, cnt FROM daily_event_counts_hourly WHERE email = :e AND day = :d "
        "ORDER BY hour"), {"e": email, "d": selected}).mappings().all()
    tasks = tel_db.execute(text(
        "SELECT project_id, data_id, started_at, ended_at, duration_ms, outcome "
        "FROM task_spans WHERE email = :e AND day = :d ORDER BY started_at DESC NULLS LAST LIMIT 50"),
        {"e": email, "d": selected}).mappings().all()
    st = tel_db.execute(text(
        "SELECT last_event_at, last_idle_state, session_open FROM user_status WHERE email = :e"),
        {"e": email}).mappings().first()

    now = datetime.now(timezone.utc)
    return {
        "email": email,
        "name": profile["name"] if profile else None,
        "designation": profile["designation"] if profile else None,
        "status": derive_status(st["last_event_at"], st["session_open"], st["last_idle_state"], now) if st else "offline",
        "lastEventAt": st["last_event_at"].isoformat() if st and st["last_event_at"] else None,
        "selectedDay": selected,
        "rangeDays": days,
        "dayStats": day_stats,
        "daily": [dict(r) for r in daily],
        "workSites": [
            {"domain": d, "is_work": bool(c["is_work"]), "color": c["color"], "label": c["label"]}
            for d, c in work_sites.items()
        ],
        "selected": {
            "domainTime": tab_time,
            "workSiteMs": work_ms,
            "offWorkMs": off_ms,
            "totalTabMs": work_ms + off_ms,
            "sectionTime": [dict(r) for r in sec],
            "hourly": [dict(r) for r in hourly],
            "tasks": [dict(r) for r in tasks],
        },
    }


class WorkSite(BaseModel):
    domain: str
    is_work: bool = True
    color: str | None = None
    label: str | None = None
    delete: bool = False


class WorkSitesBody(BaseModel):
    sites: list[WorkSite]


@router.get("/work-sites/{email}")
def get_work_sites(email: str, user=Depends(require_manager),
                   auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    email = email.lower().strip()
    _assert_visible(auth_db, user, email)
    sites = load_work_sites(tel_db, email)
    return {"email": email, "sites": [
        {"domain": d, "is_work": bool(c["is_work"]), "color": c["color"], "label": c["label"]}
        for d, c in sites.items()
    ]}


@router.put("/work-sites/{email}")
def put_work_sites(email: str, body: WorkSitesBody, user=Depends(require_manager),
                   auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    """Upsert (or delete) an employee's work-site classification + colors."""
    email = email.lower().strip()
    _assert_visible(auth_db, user, email)
    for s in body.sites:
        dom = domain_of(s.domain) or (s.domain or "").strip().lower()
        if not dom:
            continue
        if s.delete:
            tel_db.execute(text("DELETE FROM work_sites WHERE email = :e AND domain = :d"),
                           {"e": email, "d": dom})
            continue
        color = s.color.strip() if s.color and s.color.strip() else None
        label = s.label.strip() if s.label and s.label.strip() else None
        tel_db.execute(text(
            "INSERT INTO work_sites (email, domain, is_work, color, label, updated_by, updated_at) "
            "VALUES (:e, :d, :w, :c, :l, :by, now()) "
            "ON CONFLICT (email, domain) DO UPDATE SET "
            "is_work = EXCLUDED.is_work, color = EXCLUDED.color, label = EXCLUDED.label, "
            "updated_by = EXCLUDED.updated_by, updated_at = now()"),
            {"e": email, "d": dom, "w": s.is_work, "c": color, "l": label, "by": user["email"]})
    tel_db.commit()
    sites = load_work_sites(tel_db, email)
    return {"email": email, "sites": [
        {"domain": d, "is_work": bool(c["is_work"]), "color": c["color"], "label": c["label"]}
        for d, c in sites.items()
    ]}


@router.get("/raw-events/{email}")
def raw_events(email: str, request: Request, day: str | None = None, since: str | None = None,
               limit: int = 200, user=Depends(require_manager),
               auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    email = email.lower().strip()
    _assert_visible(auth_db, user, email)
    limit = max(1, min(limit, 1000))

    # Audit every raw-log view (writes to the telemetry DB, not production).
    tel_db.execute(text(
        "INSERT INTO raw_log_access_audit (viewer_email, viewed_email, ip) VALUES (:v, :e, :ip)"),
        {"v": user["email"], "e": email, "ip": request.client.host if request.client else None})
    tel_db.commit()

    params = {"e": email, "lim": limit}
    where = "email = :e"
    if day and DAY_RE.match(day):
        where += " AND day = :day"
        params["day"] = day
    elif since:
        where += " AND ts > :since"
        params["since"] = since
    rows = tel_db.execute(text(
        f"SELECT event_type, ts, url, domain, encord_category, project_id, data_id, metadata "
        f"FROM raw_events WHERE {where} ORDER BY ts DESC LIMIT :lim"), params).mappings().all()
    return {"email": email, "viewer": user["email"], "events": [dict(r) for r in rows]}


@router.get("/status")
def status(user=Depends(require_manager),
           auth_db: Session = Depends(get_auth_db), tel_db: Session = Depends(get_telemetry_db)):
    """Lightweight live-status map for the roster — for the polling status board."""
    people = get_roster(auth_db, user)
    emails = [p["email"].lower() for p in people if p["email"]]
    _, statuses = _fetch_telemetry(tel_db, emails, _today())
    now = datetime.now(timezone.utc)
    out = []
    for p in people:
        e = p["email"].lower() if p["email"] else None
        st = statuses.get(e)
        out.append({
            "email": p["email"], "name": p["name"],
            "status": derive_status(st["last_event_at"], st["session_open"], st["last_idle_state"], now) if st else "offline",
            "lastEventAt": st["last_event_at"].isoformat() if st and st["last_event_at"] else None,
        })
    return {"asOf": now.isoformat(), "members": out}
