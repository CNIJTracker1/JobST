"""Auth, profile, settings, account deletion (port of AuthService/AuthProvider + settings screens)."""
import secrets
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from catalog import DEFAULT_THEME, FONT_SIZES, FREE_THEMES, STARTER_GOALS, STARTING_TOKENS, THEMES
from core import (
    DEV_MODE,
    FRONTEND_URL,
    REQUIRE_EMAIL_VERIFICATION,
    create_token,
    get_current_user,
    get_db,
    hash_password,
    new_id,
    now_utc,
    parse_dt,
    public_user,
    verify_password,
)
from emailer import reset_email, send_email, verification_email
from rewards import set_goal

router = APIRouter()

DEFAULT_SETTINGS = {
    "app_theme": DEFAULT_THEME,
    "dark_mode": False,
    "font_size": "defaultSize",
    "timezone": "America/Toronto",
    "daily_reminder": True,
    "reminder_time": "09:00",
    "quote_notification": True,
    "weekly_report": True,
    "report_day": 1,  # 0 = Sunday … 6 = Saturday
    "target_role": "",
    "weekly_application_goal": 10,
    "onboarded": False,
}


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    username: str = Field(min_length=3, max_length=20)
    timezone: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class TokenIn(BaseModel):
    token: str


class EmailIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(min_length=6)


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


class ProfileIn(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=20)
    avatar: Optional[str] = None  # data URL (≤ ~1.5 MB)


class SettingsIn(BaseModel):
    app_theme: Optional[str] = None
    dark_mode: Optional[bool] = None
    font_size: Optional[str] = None
    timezone: Optional[str] = None
    daily_reminder: Optional[bool] = None
    reminder_time: Optional[str] = None
    quote_notification: Optional[bool] = None
    weekly_report: Optional[bool] = None
    report_day: Optional[int] = Field(default=None, ge=0, le=6)
    target_role: Optional[str] = None
    weekly_application_goal: Optional[int] = Field(default=None, ge=1, le=200)
    onboarded: Optional[bool] = None


async def _issue_email_token(user, kind, hours):
    token = secrets.token_urlsafe(32)
    await get_db().email_tokens.insert_one(
        {"token": token, "user_id": user["id"], "kind": kind, "expires_at": now_utc() + timedelta(hours=hours), "used": False}
    )
    return token


async def _consume_email_token(token, kind):
    db = get_db()
    row = await db.email_tokens.find_one({"token": token, "kind": kind, "used": False})
    if not row or parse_dt(row["expires_at"]) < now_utc():
        raise HTTPException(400, "This link is invalid or has expired")
    await db.email_tokens.update_one({"token": token}, {"$set": {"used": True}})
    return row


async def _send_verification(user):
    token = await _issue_email_token(user, "verify", 48)
    url = f"{FRONTEND_URL}/verify-email?token={token}"
    sent = await send_email(user["email"], "Verify your CareerNiche account", verification_email(user["username"], url))
    return url if (DEV_MODE and not sent) else None


def _auth_response(user, extra=None):
    out = {"token": create_token(user["id"]), "user": public_user(user)}
    out.update(extra or {})
    return out


@router.post("/auth/register")
async def register(body: RegisterIn):
    db = get_db()
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "An account with this email already exists")
    settings = dict(DEFAULT_SETTINGS)
    if body.timezone:
        settings["timezone"] = body.timezone
    user = {
        "id": new_id(),
        "email": email,
        "username": body.username.strip(),
        "password_hash": hash_password(body.password),
        "avatar": None,
        "email_verified": not REQUIRE_EMAIL_VERIFICATION,
        "auth_provider": "password",
        "tokens": STARTING_TOKENS,
        "unlocked_themes": list(FREE_THEMES),
        "town": {"expansion_level": 1, "unlocked_items": ["road", "tree", "cottage"]},
        "stats": {"goals_completed": 0},
        "settings": settings,
        "created_at": now_utc(),
    }
    await db.users.insert_one(dict(user))
    for goal_type, action, target in STARTER_GOALS:
        await set_goal(user, goal_type, action, target)
    extra = {}
    if REQUIRE_EMAIL_VERIFICATION:
        dev_link = await _send_verification(user)
        if dev_link:
            extra["dev_verification_link"] = dev_link
    return _auth_response(user, extra)


@router.post("/auth/login")
async def login(body: LoginIn):
    user = await get_db().users.find_one({"email": body.email.lower()})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(401, "Incorrect email or password")
    return _auth_response(user)


@router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return {"user": public_user(user), "require_verification": REQUIRE_EMAIL_VERIFICATION}


@router.post("/auth/verify-email")
async def verify_email(body: TokenIn):
    row = await _consume_email_token(body.token, "verify")
    await get_db().users.update_one({"id": row["user_id"]}, {"$set": {"email_verified": True}})
    return {"ok": True}


@router.post("/auth/resend-verification")
async def resend_verification(user=Depends(get_current_user)):
    if user.get("email_verified"):
        return {"ok": True, "already_verified": True}
    dev_link = await _send_verification(user)
    return {"ok": True, "dev_verification_link": dev_link}


@router.post("/auth/forgot-password")
async def forgot_password(body: EmailIn):
    user = await get_db().users.find_one({"email": body.email.lower()})
    out = {"ok": True}  # never reveal whether the email exists
    if user:
        token = await _issue_email_token(user, "reset", 1)
        url = f"{FRONTEND_URL}/reset-password?token={token}"
        sent = await send_email(user["email"], "Reset your CareerNiche password", reset_email(user["username"], url))
        if DEV_MODE and not sent:
            out["dev_reset_link"] = url
    return out


@router.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    row = await _consume_email_token(body.token, "reset")
    await get_db().users.update_one({"id": row["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    return {"ok": True}


@router.post("/auth/change-password")
async def change_password(body: ChangePasswordIn, user=Depends(get_current_user)):
    if not verify_password(body.current_password, user.get("password_hash", "")):
        raise HTTPException(400, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different from current password")
    await get_db().users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


@router.patch("/me")
async def update_profile(body: ProfileIn, user=Depends(get_current_user)):
    update = {}
    if body.username is not None:
        update["username"] = body.username.strip()
    if body.avatar is not None:
        if body.avatar and (not body.avatar.startswith("data:image/") or len(body.avatar) > 2_000_000):
            raise HTTPException(400, "Avatar must be an image under ~1.5 MB")
        update["avatar"] = body.avatar or None
    if update:
        await get_db().users.update_one({"id": user["id"]}, {"$set": update})
    fresh = await get_db().users.find_one({"id": user["id"]})
    return {"user": public_user(fresh)}


@router.delete("/me")
async def delete_account(user=Depends(get_current_user)):
    db = get_db()
    uid = user["id"]
    for coll in ("jobs", "interviews", "documents", "contacts", "activity", "goals", "user_missions", "user_badges", "buildings", "email_tokens", "hub_interest"):
        await db[coll].delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@router.get("/settings")
async def get_settings(user=Depends(get_current_user)):
    return {**DEFAULT_SETTINGS, **user.get("settings", {})}


@router.patch("/settings")
async def update_settings(body: SettingsIn, user=Depends(get_current_user)):
    changes = body.model_dump(exclude_none=True)
    if "app_theme" in changes:
        if changes["app_theme"] not in THEMES:
            raise HTTPException(400, "Unknown theme")
        if changes["app_theme"] not in user.get("unlocked_themes", FREE_THEMES):
            raise HTTPException(403, "Unlock this theme first")
    if "font_size" in changes and changes["font_size"] not in FONT_SIZES:
        raise HTTPException(400, "Unknown font size")
    if changes:
        await get_db().users.update_one({"id": user["id"]}, {"$set": {f"settings.{k}": v for k, v in changes.items()}})
    if "weekly_application_goal" in changes:
        await set_goal(user, "weekly", "apply", changes["weekly_application_goal"])
    fresh = await get_db().users.find_one({"id": user["id"]})
    return {**DEFAULT_SETTINGS, **fresh.get("settings", {})}
