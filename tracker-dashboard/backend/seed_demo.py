"""Seed realistic DEMO telemetry into the sandbox telemetry DB for a real PM's
team (emails read READ-ONLY from production). Re-runnable. Writes ONLY to the
telemetry DB — never to the production auth DB.

Usage: ./venv/bin/python seed_demo.py
"""
import os, random
from datetime import datetime, timedelta, timezone
import psycopg2
from dotenv import load_dotenv

load_dotenv()
AUTH = os.getenv("AUTH_DATABASE_URL")
TEL = os.getenv("TELEMETRY_DATABASE_URL")
PM_EMAIL = "chirag.rao@autonexai360.com"
DAYS = 5
random.seed(42)

now = datetime.now(timezone.utc)
today = now.strftime("%Y-%m-%d")
day_strs = [(now - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(DAYS)]


def get_team():
    ac = psycopg2.connect(AUTH)
    ac.set_session(readonly=True)
    try:
        with ac.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT e.email, e.name FROM employees e
                JOIN allocations a   ON a.employee_id = e.id
                JOIN daily_sheets ds ON a.sub_project_id = ds.id
                LEFT JOIN sub_projects sp  ON ds.sub_project_id = sp.id
                LEFT JOIN main_projects mp ON ds.main_project_id = mp.id
                JOIN users u ON u.email = %s
                WHERE (sp.pm_id = u.employee_id OR mp.program_manager_id = u.employee_id)
                  AND e.status = 'active' AND e.email IS NOT NULL
                ORDER BY e.name LIMIT 8
            """, (PM_EMAIL,))
            return cur.fetchall()
    finally:
        ac.close()


def main():
    team = get_team()
    emails = [e.lower() for (e, _) in team]
    print(f"Seeding {len(team)} of {PM_EMAIL}'s team:")
    for e, n in team:
        print(f"   {e}  ({n})")

    tc = psycopg2.connect(TEL)
    try:
        cur = tc.cursor()
        # ensure today's raw_events partition exists
        part = "raw_events_p_" + today.replace("-", "")
        nxt = (now + timedelta(days=1)).strftime("%Y-%m-%d")
        cur.execute(f"CREATE TABLE IF NOT EXISTS {part} PARTITION OF raw_events "
                    f"FOR VALUES FROM ('{today}') TO ('{nxt}')")

        # clean prior demo rows for these emails
        for t in ["daily_user_stats", "daily_domain_time", "daily_encord_section_time",
                  "daily_event_counts_hourly", "task_spans", "user_status", "raw_events",
                  "interaction_minutes"]:
            cur.execute(f"DELETE FROM {t} WHERE email = ANY(%s)", (emails,))

        for i, (email, name) in enumerate(team):
            em = email.lower()
            # ── per-day rollups ──
            for d, day in enumerate(day_strs):
                active_ms = int((4 + (i % 4) + random.uniform(-0.5, 1.5)) * 3600_000)
                paused_ms = int((0.4 + random.uniform(0, 1.1)) * 3600_000)
                started = 20 + i * 3 + random.randint(0, 20)
                skipped = random.randint(0, max(1, started // 8))
                exited = random.randint(0, 4)
                focus = round(active_ms / (active_ms + paused_ms), 4)
                first_a = f"{day}T09:{random.randint(0,20):02d}:00+00:00"
                last_a = f"{day}T17:{random.randint(0,59):02d}:00+00:00"
                cur.execute("""
                    INSERT INTO daily_user_stats (email,day,active_ms,paused_ms,session_count,pause_count,
                        focus_ratio,tasks_started,tasks_skipped,tasks_exited,avg_task_ms,first_active,last_active)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (em, day, active_ms, paused_ms, random.randint(1, 2), random.randint(1, 4),
                      focus, started, skipped, exited, random.randint(120, 420) * 1000, first_a, last_a))

            # ── today's breakdowns ──
            enc = int((3 + random.uniform(0, 2)) * 3600_000)
            cur.execute("INSERT INTO daily_domain_time (email,day,domain,active_ms) VALUES (%s,%s,'app.encord.com',%s)", (em, today, enc))
            cur.execute("INSERT INTO daily_domain_time (email,day,domain,active_ms) VALUES (%s,%s,'mail.google.com',%s)", (em, today, int(random.uniform(0.2, 0.8) * 3600_000)))
            cur.execute("INSERT INTO daily_domain_time (email,day,domain,active_ms) VALUES (%s,%s,'docs.google.com',%s)", (em, today, int(random.uniform(0.1, 0.5) * 3600_000)))
            for cat, frac in [("label_editor", 0.7), ("project_view", 0.15), ("projects", 0.1), ("home", 0.05)]:
                cur.execute("INSERT INTO daily_encord_section_time (email,day,category,active_ms) VALUES (%s,%s,%s,%s)", (em, today, cat, int(enc * frac)))
            for hour in range(9, 18):
                cur.execute("INSERT INTO daily_event_counts_hourly (email,day,hour,event_type,cnt) VALUES (%s,%s,%s,'MOUSE_CLICK',%s)", (em, today, hour, random.randint(20, 120)))
                cur.execute("INSERT INTO daily_event_counts_hourly (email,day,hour,event_type,cnt) VALUES (%s,%s,%s,'KEYBOARD_INPUT',%s)", (em, today, hour, random.randint(10, 80)))
            for k in range(random.randint(4, 9)):
                st = f"{today}T{random.randint(9,16):02d}:{random.randint(0,59):02d}:00+00:00"
                dur = random.randint(60, 600) * 1000
                outcome = random.choice(["exited", "exited", "skipped"])
                cur.execute("""INSERT INTO task_spans (email,day,project_id,data_id,started_at,duration_ms,outcome,dedupe_key)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT (dedupe_key) DO NOTHING""",
                            (em, today, f"proj-{i%3}", f"data-{i}-{k}", st, dur, outcome, f"{em}|seed|{i}|{k}"))

            # ── live status: mix of active / idle / offline ──
            kind = i % 3
            if kind == 0:
                last_evt, idle, sopen = now - timedelta(seconds=20), None, True       # active
            elif kind == 1:
                last_evt, idle, sopen = now - timedelta(seconds=30), "idle", True      # idle
            else:
                last_evt, idle, sopen = now - timedelta(hours=2), None, False          # offline
            cur.execute("""INSERT INTO user_status (email,last_event_at,last_idle_state,session_open)
                           VALUES (%s,%s,%s,%s)
                           ON CONFLICT (email) DO UPDATE SET last_event_at=EXCLUDED.last_event_at,
                             last_idle_state=EXCLUDED.last_idle_state, session_open=EXCLUDED.session_open""",
                        (em, last_evt, idle, sopen))

        # ── raw_events feed for the first 2 employees (for the raw-logs modal) ──
        # A COMPLETE session (start..stop + a sessions row) so that if the WorkWise
        # rollup job ever recomputes this sandbox, it reproduces sane non-zero
        # aggregates instead of zeroing these employees out.
        for (email, _) in team[:2]:
            em = email.lower()
            seq = [
                ("SESSION_STARTED", "app.encord.com", None, None),
                ("ENCORD_PAGE_VIEW", "app.encord.com", "label_editor", None),
                ("TASK_STARTED", "app.encord.com", None, '{"projectId":"proj-1","dataId":"d-1"}'),
                ("KEYBOARD_INPUT", "app.encord.com", None, '{"count":14,"keys":"car, pedestrian"}'),
                ("MOUSE_CLICK", "app.encord.com", None, None),
                ("TASK_SKIPPED", "app.encord.com", None, '{"projectId":"proj-1","dataId":"d-1"}'),
                ("IDLE_STATE_CHANGED", "app.encord.com", None, '{"state":"idle"}'),
                ("SESSION_STOPPED", "app.encord.com", None,
                 '{"totalSessionTimeMs":18900000,"totalActiveTimeMs":16200000,"totalPausedTimeMs":2700000,"pauseCount":2,"totalEvents":40,"pauseHistory":[]}'),
            ]
            base = now - timedelta(minutes=12)
            stopped_at = None
            for j, (et, dom, cat, meta) in enumerate(seq):
                ts = base + timedelta(seconds=j * 90)
                if et == "SESSION_STOPPED":
                    stopped_at = ts
                cur.execute("""INSERT INTO raw_events (email,event_type,ts,day,url,domain,encord_category,metadata)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                            (em, et, ts, today, "https://app.encord.com/label_editor/p/d", dom, cat, meta))
            cur.execute("""INSERT INTO sessions (email,day,started_at,stopped_at,total_ms,active_ms,paused_ms,
                              pause_count,total_events,pause_history,dedupe_key)
                           VALUES (%s,%s,%s,%s,18900000,16200000,2700000,2,40,'[]',%s)
                           ON CONFLICT (dedupe_key) DO NOTHING""",
                        (em, today, base, stopped_at, f"{em}|seed|stop"))

        tc.commit()
        print(f"\nSeeded telemetry for {len(team)} employees across {DAYS} days (today={today}).")
    finally:
        tc.close()


if __name__ == "__main__":
    main()
