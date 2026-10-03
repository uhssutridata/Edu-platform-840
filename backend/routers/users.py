"""User directory for chat member pickers, teacher lists and presence dots."""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, is_subscribed, online_cutoff
from lib.db import db

router = APIRouter(prefix="/users", tags=["users"])


class UserCard(BaseModel):
    id: str
    name: str
    role: str
    plan: str
    subscribed: bool
    online: bool
    last_active: Optional[datetime] = None


@router.get("", response_model=List[UserCard])
async def list_users(me: Annotated[dict, Depends(get_current_user)]) -> List[UserCard]:
    users = await db.users.find({}, {"password_hash": 0}).sort("name", 1).to_list(500)
    sessions = await db.sessions.find().sort("last_active", -1).to_list(500)
    last_active: dict[str, object] = {}
    for s in sessions:
        last_active.setdefault(s["user_id"], aware(s["last_active"]))
    cutoff = online_cutoff()
    out: List[UserCard] = []
    for u in users:
        last = last_active.get(u["id"])
        out.append(
            UserCard(
                id=u["id"],
                name=u.get("name", ""),
                role=u.get("role", "student"),
                plan=u.get("plan", "free"),
                subscribed=is_subscribed(u),
                online=bool(last and last >= cutoff),
                last_active=last,
            )
        )
    return out
