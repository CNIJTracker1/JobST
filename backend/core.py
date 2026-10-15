"""Shared infrastructure: config, database, auth helpers, time helpers."""
import os
import uuid
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import bcrypt
import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logger = logging.getLogger("careerniche")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")

# ── Config ────────────────────────────────────────────────────────────────────
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "careerniche_tracker")
JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_EXPIRE_DAYS", "14"))
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
REQUIRE_EMAIL_VERIFICATION = os.environ.get("REQUIRE_EMAIL_VERIFICATION", "false").lower() == "true"
DEV_MODE = os.environ.get("DEV_MODE", "true").lower() == "true"
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_FROM = os.environ.get("EMAIL_FROM", "CareerNiche <onboarding@resend.dev>")
CRON_SECRET = os.environ.get("CRON_SECRET", "")
DEFAULT_TIMEZONE = "America/Toronto"


class _DB:
    """Lazy holder so tests can swap the client (e.g. mongomock)."""

    client = None
    db = None


def init_db(client=None):
    _DB.client = client or AsyncIOMotorClient(MONGO_URL)
    _DB.db = _DB.client[DB_NAME]
    return _DB.db


def get_db():
    if _DB.db is None:
        init_db()
    return _DB.db


# ── Generic helpers ───────────────────────────────────────────────────────────
def new_id() -> str:
    return str(uuid.uuid4())


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt):
    if dt is None:
        return None
    if isinstance(dt, str):
        return dt
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def parse_dt(value):
    """Accept ISO strings or datetimes; always return aware UTC datetimes."""
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    text = str(value).replace("Z", "+00:00")
    dt = datetime.fromisoformat(text)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def clean(doc):
    """Strip Mongo's _id and serialise datetimes so documents are JSON-safe."""
    if doc is None:
        return None
    out = {}
    for key, value in doc.items():
        if key == "_id":
            continue
        if isinstance(value, datetime):
            out[key] = iso(value)
        elif isinstance(value, dict):
            out[key] = clean(value)
        elif isinstance(value, list):
            out[key] = [clean(v) if isinstance(v, dict) else (iso(v) if isinstance(v, datetime) else v) for v in value]
        else:
            out[key] = value
    return out


# ── Time zones & periods ──────────────────────────────────────────────────────
def user_tz(user) -> ZoneInfo:
    name = (user or {}).get("settings", {}).get("timezone") or DEFAULT_TIMEZONE
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo(DEFAULT_TIMEZONE)


def day_start(user, at=None) -> datetime:
    tz = user_tz(user)
    local = (at or now_utc()).astimezone(tz)
    return local.replace(hour=0, minute=0, second=0, microsecond=0).astimezone(timezone.utc)


def week_start(user, at=None) -> datetime:
    """Weeks start on Sunday, matching the original Flutter app."""
    tz = user_tz(user)
    local = (at or now_utc()).astimezone(tz)
    start = local.replace(hour=0, minute=0, second=0, microsecond=0)
    start = start - timedelta(days=(start.weekday() + 1) % 7)
    return start.astimezone(timezone.utc)


# ── Passwords & tokens ────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": now_utc() + timedelta(days=JWT_EXPIRE_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


_bearer = HTTPBearer(auto_error=False)


async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(_bearer)):
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired session")
    user = await get_db().users.find_one({"id": payload.get("sub")})
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return user


def public_user(user) -> dict:
    u = clean(user)
    for secret in ("password_hash",):
        u.pop(secret, None)
    return u
