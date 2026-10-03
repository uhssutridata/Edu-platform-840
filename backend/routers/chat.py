"""1:1 direct messages and group channels between students and teachers."""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, now_utc, online_cutoff
from lib.db import db

router = APIRouter(prefix="/chat", tags=["chat"])


class ConversationCreate(BaseModel):
    type: str  # dm | group
    name: Optional[str] = None
    member_ids: List[str] = []


class MemberOut(BaseModel):
    id: str
    name: str
    role: str
    online: bool


class MessageBrief(BaseModel):
    text: str
    sender_name: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    type: str
    name: str
    members: List[MemberOut]
    last_message: Optional[MessageBrief] = None
    unread: int = 0
    updated_at: datetime


class MessageOut(BaseModel):
    id: str
    conversation_id: str
    sender_id: str
    sender_name: str
    sender_role: str
    text: str
    created_at: datetime


async def _member_map(user_ids: List[str]) -> dict:
    docs = await db.users.find({"id": {"$in": user_ids}}).to_list(500)
    return {u["id"]: u for u in docs}


def _members_out(member_ids: List[str], users: dict) -> List[MemberOut]:
    cutoff = online_cutoff()
    out = []
    for mid in member_ids:
        u = users.get(mid)
        if not u:
            continue
        last = u.get("_last_active")
        out.append(MemberOut(
            id=u["id"], name=u.get("name", ""), role=u.get("role", "student"),
            online=bool(last and aware(last) >= cutoff),
        ))
    return out


@router.get("/conversations", response_model=List[ConversationOut])
async def list_conversations(me: Annotated[dict, Depends(get_current_user)]) -> List[ConversationOut]:
    convs = await db.conversations.find({"member_ids": me["id"]}).sort("updated_at", -1).to_list(200)
    if not convs:
        return []
    all_member_ids: list[str] = []
    for c in convs:
        all_member_ids.extend(c["member_ids"])
    users = await _member_map(list(set(all_member_ids)))
    # latest last_active per user for presence dots
    sessions = await db.sessions.find().sort("last_active", -1).to_list(500)
    for s in sessions:
        u = users.get(s["user_id"])
        if u is not None and "_last_active" not in u:
            u["_last_active"] = s["last_active"]
    conv_ids = [c["id"] for c in convs]
    messages = await db.messages.find({"conversation_id": {"$in": conv_ids}}).sort("created_at", 1).to_list(5000)
    by_conv: dict[str, list[dict]] = {}
    for m in messages:
        by_conv.setdefault(m["conversation_id"], []).append(m)
    out: List[ConversationOut] = []
    for c in convs:
        other = next((mid for mid in c["member_ids"] if mid != me["id"]), None)
        name = c.get("name") or (users.get(other, {}).get("name", "Direct message") if c["type"] == "dm" else "Group")
        my_read = (c.get("reads") or {}).get(me["id"])
        read_dt = aware(my_read) if my_read else None
        msgs = by_conv.get(c["id"], [])
        last = msgs[-1] if msgs else None
        unread = sum(
            1 for m in msgs
            if m["sender_id"] != me["id"] and (read_dt is None or aware(m["created_at"]) > read_dt)
        )
        out.append(ConversationOut(
            id=c["id"],
            type=c["type"],
            name=name,
            members=_members_out(c["member_ids"], users),
            last_message=MessageBrief(
                text=last["text"], sender_name=last["sender_name"], created_at=aware(last["created_at"])
            ) if last else None,
            unread=unread,
            updated_at=aware(c.get("updated_at", c.get("created_at", now_utc()))),
        ))
    return out


@router.post("/conversations", response_model=ConversationOut)
async def create_conversation(
    req: ConversationCreate, me: Annotated[dict, Depends(get_current_user)]
) -> ConversationOut:
    if req.type not in ("dm", "group"):
        raise HTTPException(status_code=422, detail="type must be dm or group")
    if req.type == "dm":
        if len(req.member_ids) != 1:
            raise HTTPException(status_code=422, detail="A direct message needs exactly one other member")
        other_id = req.member_ids[0]
        other = await db.users.find_one({"id": other_id})
        if not other:
            raise HTTPException(status_code=404, detail="User not found")
        dm_key = "|".join(sorted([me["id"], other_id]))
        existing = await db.conversations.find_one({"dm_key": dm_key})
        if existing:
            return await _single(existing, me)
        doc = {
            "id": str(uuid.uuid4()),
            "type": "dm",
            "dm_key": dm_key,
            "name": None,
            "member_ids": [me["id"], other_id],
            "reads": {},
            "created_by": me["id"],
            "created_at": now_utc(),
            "updated_at": now_utc(),
        }
        await db.conversations.insert_one(doc)
        return await _single(doc, me)
    # group
    if not (req.name or "").strip():
        raise HTTPException(status_code=422, detail="A group needs a name")
    member_ids = list(set(req.member_ids + [me["id"]]))
    doc = {
        "id": str(uuid.uuid4()),
        "type": "group",
        "name": req.name.strip(),
        "member_ids": member_ids,
        "reads": {},
        "created_by": me["id"],
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    await db.conversations.insert_one(doc)
    return await _single(doc, me)


async def _single(doc: dict, me: dict) -> ConversationOut:
    convs = await list_conversations(me)
    for c in convs:
        if c.id == doc["id"]:
            return c
    raise HTTPException(status_code=404, detail="Conversation not found")


async def _get_member_conversation(conv_id: str, me: dict) -> dict:
    conv = await db.conversations.find_one({"id": conv_id})
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if me["id"] not in conv["member_ids"]:
        raise HTTPException(status_code=403, detail="You are not a member of this conversation")
    return conv


@router.get("/conversations/{conv_id}/messages", response_model=List[MessageOut])
async def get_messages(conv_id: str, me: Annotated[dict, Depends(get_current_user)]) -> List[MessageOut]:
    conv = await _get_member_conversation(conv_id, me)
    docs = await db.messages.find({"conversation_id": conv_id}).sort("created_at", 1).to_list(300)
    await db.conversations.update_one(
        {"id": conv_id}, {"$set": {f"reads.{me['id']}": now_utc()}}
    )
    return [
        MessageOut(
            id=m["id"],
            conversation_id=m["conversation_id"],
            sender_id=m["sender_id"],
            sender_name=m.get("sender_name", ""),
            sender_role=m.get("sender_role", "student"),
            text=m["text"],
            created_at=aware(m["created_at"]),
        )
        for m in docs
    ]


class MessageCreate(BaseModel):
    text: str


@router.post("/conversations/{conv_id}/messages", response_model=MessageOut)
async def send_message(
    conv_id: str, req: MessageCreate, me: Annotated[dict, Depends(get_current_user)]
) -> MessageOut:
    conv = await _get_member_conversation(conv_id, me)
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Message cannot be empty")
    if len(text) > 4000:
        raise HTTPException(status_code=422, detail="Message too long (max 4000 characters)")
    now = now_utc()
    doc = {
        "id": str(uuid.uuid4()),
        "conversation_id": conv_id,
        "sender_id": me["id"],
        "sender_name": me["name"],
        "sender_role": me.get("role", "student"),
        "text": text,
        "created_at": now,
    }
    await db.messages.insert_one(doc)
    await db.conversations.update_one(
        {"id": conv_id}, {"$set": {"updated_at": now, f"reads.{me['id']}": now}}
    )
    return MessageOut(
        id=doc["id"],
        conversation_id=conv_id,
        sender_id=me["id"],
        sender_name=me["name"],
        sender_role=me.get("role", "student"),
        text=text,
        created_at=now,
    )
