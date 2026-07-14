"""Auth: real login validated READ-ONLY against the production user directory.

Mirrors the PM portal's pattern (bcrypt + JWT + role guard) so it ports cleanly.
The dashboard is a manager tool, so only admin/pm may log in. We NEVER write to
the production auth DB — login is a single SELECT.
"""
import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from .db import get_auth_db

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_ALG = "HS256"
TOKEN_TTL_HOURS = 12
ALLOW_DEV_LOGIN = os.getenv("ALLOW_DEV_LOGIN", "0") == "1"

# Local demo/temp credentials (only honored when ALLOW_DEV_LOGIN=1) — let managers
# sign in for the demo without a real production password. Unset in production.
DEMO_ADMIN_EMAIL = os.getenv("DEMO_ADMIN_EMAIL", "admin@tracker.local").lower()
DEMO_ADMIN_PASSWORD = os.getenv("DEMO_ADMIN_PASSWORD", "")
DEMO_PM_EMAIL = os.getenv("DEMO_PM_EMAIL", "").lower()
DEMO_PM_PASSWORD = os.getenv("DEMO_PM_PASSWORD", "")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class LoginReq(BaseModel):
    email: str
    password: str


class LoginResp(BaseModel):
    token: str
    email: str
    name: str | None = None
    role: str


def _issue(rid, email, name, role, eid):
    claims = {"sub": str(rid), "email": email, "name": name, "role": role,
              "employee_id": eid, "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)}
    return LoginResp(token=jwt.encode(claims, JWT_SECRET, algorithm=JWT_ALG), email=email, name=name, role=role)


@router.post("/login", response_model=LoginResp)
def login(body: LoginReq, db: Session = Depends(get_auth_db)):
    email = (body.email or "").lower().strip()
    pw = body.password or ""

    # Local temp/demo credentials (gated by ALLOW_DEV_LOGIN). The PM credential
    # resolves the real employee_id so team-scoping still works.
    if ALLOW_DEV_LOGIN:
        if DEMO_ADMIN_PASSWORD and email == DEMO_ADMIN_EMAIL and pw == DEMO_ADMIN_PASSWORD:
            return _issue("0", email, "Demo Admin", "admin", None)
        if DEMO_PM_PASSWORD and email == DEMO_PM_EMAIL and pw == DEMO_PM_PASSWORD:
            r = db.execute(text("SELECT id, name, employee_id FROM users WHERE email = :e"),
                           {"e": email}).mappings().first()
            return _issue(str(r["id"]) if r else "0", email, r["name"] if r else "Demo PM",
                          "pm", r["employee_id"] if r else None)

    # Real production login (READ-ONLY)
    row = db.execute(
        text("SELECT id, email, name, role, is_active, password_hash, employee_id "
             "FROM users WHERE email = :e"),
        {"e": email},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=403, detail="Account not found")
    if not row["password_hash"] or not pwd_context.verify(pw, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid password")
    if row["is_active"] is False:
        raise HTTPException(status_code=403, detail="Account is inactive")
    if row["role"] not in ("admin", "pm"):
        raise HTTPException(status_code=403, detail="Manager access only (admin/pm)")
    return _issue(row["id"], row["email"], row["name"], row["role"], row["employee_id"])


def get_current_user(token: str = Depends(oauth2)):
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


def require_manager(user=Depends(get_current_user)):
    if user.get("role") not in ("admin", "pm"):
        raise HTTPException(status_code=403, detail="Manager access required")
    return user
