"""Core user models shared across routers."""

import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from lib.auth import aware, is_subscribed


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(BaseModel):
    id: str = Field(default_factory=_uuid)
    name: str
    email: str
    password_hash: str
    role: str = "student"  # student | teacher | admin
    plan: str = "free"  # free | student_pro | teacher_pro
    subscription_end: datetime | None = None
    created_at: datetime = Field(default_factory=_now)


class UserPublic(BaseModel):
    id: str
    name: str
    email: str
    role: str
    plan: str
    subscribed: bool = False
    subscription_end: datetime | None = None
    created_at: datetime


def to_public(doc: dict) -> UserPublic:
    sub_end = doc.get("subscription_end")
    return UserPublic(
        id=doc["id"],
        name=doc.get("name", ""),
        email=doc.get("email", ""),
        role=doc.get("role", "student"),
        plan=doc.get("plan", "free"),
        subscribed=is_subscribed(doc),
        subscription_end=aware(sub_end) if sub_end else None,
        created_at=aware(doc.get("created_at", _now())),
    )
