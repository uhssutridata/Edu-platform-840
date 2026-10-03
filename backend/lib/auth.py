"""Auth primitives: pbkdf2 password hashing, httpOnly cookie sessions, current-user dependency."""

import hashlib
import hmac
import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, Response

from lib.db import db

SESSION_COOKIE = "lms_session"
SESSION_TTL_DAYS = 30
ONLINE_WINDOW_SECONDS = 60
PBKDF2_ITERATIONS = 120_000


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), PBKDF2_ITERATIONS
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def aware(dt: datetime) -> datetime:
    """Motor hands back naive UTC datetimes — normalise before comparing/serialising."""
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


async def create_session(response: Response, user_id: str, user_agent: str = "") -> str:
    token = uuid.uuid4().hex
    now = now_utc()
    await db.sessions.insert_one(
        {
            "id": token,
            "user_id": user_id,
            "created_at": now,
            "last_active": now,
            "user_agent": (user_agent or "")[:200],
        }
    )
    response.set_cookie(
        SESSION_COOKIE,
        token,
        httponly=True,
        samesite="lax",
        max_age=SESSION_TTL_DAYS * 86400,
    )
    return token


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=401, detail="Not signed in")
    session = await db.sessions.find_one({"id": token})
    if not session:
        raise HTTPException(status_code=401, detail="Session expired — sign in again")
    user = await db.users.find_one({"id": session["user_id"]})
    if not user:
        raise HTTPException(status_code=401, detail="Account not found")
    now = now_utc()
    if (now - aware(session.get("last_active", now))).total_seconds() > 20:
        await db.sessions.update_one({"id": token}, {"$set": {"last_active": now}})
    return user


def is_subscribed(user: dict) -> bool:
    end = user.get("subscription_end")
    if not end:
        return False
    return aware(end) > now_utc()


def require_role(user: dict, *roles: str) -> None:
    if user.get("role") not in roles:
        raise HTTPException(status_code=403, detail=f"This action requires role: {' or '.join(roles)}")


def require_subscription(user: dict) -> None:
    if user.get("role") == "admin":
        return
    if not is_subscribed(user):
        raise HTTPException(
            status_code=402,
            detail={
                "code": "subscription_required",
                "message": "An active subscription is required for this action.",
            },
        )


def online_cutoff() -> datetime:
    return now_utc() - timedelta(seconds=ONLINE_WINDOW_SECONDS)
