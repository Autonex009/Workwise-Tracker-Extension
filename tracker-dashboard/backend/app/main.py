"""WorkWise Tracker Dashboard — standalone FastAPI backend (demo).

Read-only over the production roster (auth) and the WorkWise telemetry DB.
Mirrors the PM portal's stack so it can be ported in by lifting the routers.
"""
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from .auth import router as auth_router
from .tracker import router as tracker_router
from .db import telemetry_engine

log = logging.getLogger("tracker")

# Per-employee work-site classification + colors. Owned by the dashboard, so we
# create it here (idempotent) instead of depending on a WorkWise redeploy. If the
# telemetry role lacks DDL rights, the feature degrades to empty config.
WORK_SITES_DDL = """
CREATE TABLE IF NOT EXISTS work_sites (
  email      TEXT NOT NULL,
  domain     TEXT NOT NULL,
  is_work    BOOLEAN NOT NULL DEFAULT true,
  color      TEXT,
  label      TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (email, domain)
)
"""

app = FastAPI(title="WorkWise Tracker Dashboard")


@app.on_event("startup")
def ensure_schema():
    if telemetry_engine is None:
        return
    try:
        with telemetry_engine.begin() as conn:
            conn.execute(text(WORK_SITES_DDL))
    except Exception as e:  # best-effort — read-only sandbox roles may block DDL
        log.warning("could not ensure work_sites table: %s", e)

# Comma-separated list of allowed browser origins for the dashboard SPA.
# In dev, defaults to Vite's default port; in prod set to your Vercel/Netlify domain(s).
_allowed_origins_env = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3100,http://localhost:5173",
)
ALLOWED_ORIGINS = [o.strip() for o in _allowed_origins_env.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,  # we use Bearer tokens in headers, not cookies
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(tracker_router)
