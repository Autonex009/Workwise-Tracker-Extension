"""Database connections for the standalone Tracker Dashboard.

Two independent engines, both used READ-ONLY for queries:
  - auth_engine      -> production roster/auth DB (login, employees, allocations)
  - telemetry_engine -> WorkWise telemetry DB (rollups, raw_events, audit)

psycopg2/libpq handles `sslmode=require` natively, so no SSL workarounds are
needed (unlike node-postgres).
"""
import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

load_dotenv()

AUTH_DATABASE_URL = os.getenv("AUTH_DATABASE_URL")
TELEMETRY_DATABASE_URL = os.getenv("TELEMETRY_DATABASE_URL")


def _engine(url, pool_size=3):
    return create_engine(
        url,
        pool_pre_ping=True,
        pool_size=pool_size,
        max_overflow=2,
        pool_recycle=300,
        pool_timeout=15,
        connect_args={"connect_timeout": 10},
    )


auth_engine = _engine(AUTH_DATABASE_URL) if AUTH_DATABASE_URL else None
telemetry_engine = _engine(TELEMETRY_DATABASE_URL) if TELEMETRY_DATABASE_URL else None

AuthSession = sessionmaker(bind=auth_engine, autoflush=False, autocommit=False) if auth_engine else None
TelemetrySession = sessionmaker(bind=telemetry_engine, autoflush=False, autocommit=False) if telemetry_engine else None


def get_auth_db():
    if AuthSession is None:
        raise RuntimeError("AUTH_DATABASE_URL not configured")
    db = AuthSession()
    try:
        yield db
    finally:
        db.close()


def get_telemetry_db():
    if TelemetrySession is None:
        raise RuntimeError("TELEMETRY_DATABASE_URL not configured")
    db = TelemetrySession()
    try:
        yield db
    finally:
        db.close()
