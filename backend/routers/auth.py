"""Register / login / logout / me / heartbeat, plus the admin active-sessions radar."""

from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from typing_extensions import Annotated

from lib.auth import (
    ONLINE_WINDOW_SECONDS,
    aware,
    create_session,
    get_current_user,
    hash_password,
    is_subscribed,
    now_utc,
    online_cutoff,
    require_role,
    verify_password,
)
from lib.db import db
from models.user import User, UserPublic, to_public

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "student"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ActiveSessionOut(BaseModel):
    session_id: str
    user: UserPublic
    login_at:  datetime
    last_active: datetime
    online: bool
    user_agent: str


@router.post("/register", response_model=UserPublic)
async def register(
    req: RegisterRequest, response: Response, request: Request
) -> UserPublic:
    if req.role not in ("student", "teacher"):
        raise HTTPException(status_code=422, detail="Role must be student or teacher")
    if len(req.password) < 6:
        raise HTTPException(status_code=422, detail="Password must be at least 6 characters")
    email = req.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(
        name=req.name.strip(),
        email=email,
        password_hash=hash_password(req.password),
        role=req.role,
    )
    await db.users.insert_one(user.model_dump())
    await create_session(response, user.id, request.headers.get("user-agent", ""))
    return to_public(user.model_dump())


@router.post("/login", response_model=UserPublic)
async def login(req: LoginRequest, response: Response, request: Request) -> UserPublic:
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await create_session(response, user["id"], request.headers.get("user-agent", ""))
    return to_public(user)


@router.post("/logout")
async def logout(request: Request, response: Response) -> dict:
    token = request.cookies.get("lms_session")
    if token:
        await db.sessions.delete_one({"id": token})
    response.delete_cookie("lms_session")
    return {"ok": True}


@router.get("/me", response_model=UserPublic)
async def me(user: Annotated[dict, Depends(get_current_user)]) -> UserPublic:
    return to_public(user)


@router.post("/heartbeat")
async def heartbeat(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    await db.sessions.update_one(
        {"user_id": user["id"]}, {"$set": {"last_active": now_utc()}}
    )
    return {"ok": True}


@router.get("/active", response_model=List[ActiveSessionOut])
async def active_sessions(admin: Annotated[dict, Depends(get_current_user)]) -> List[ActiveSessionOut]:
    require_role(admin, "admin")
    sessions = await db.sessions.find().sort("last_active", -1).to_list(200)
    user_ids = list({s["user_id"] for s in sessions})
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": user_ids}}).to_list(500)}
    cutoff = online_cutoff()
    out: List[ActiveSessionOut] = []
    for s in sessions:
        u = users.get(s["user_id"])
        if not u:
            continue
        last = aware(s["last_active"])
        out.append(
            ActiveSessionOut(
                session_id=s["id"][:8],
                user=to_public(u),
                login_at=aware(s["created_at"]),
                last_active=last,
                online=last >= cutoff,
                user_agent=s.get("user_agent", ""),
            )
        )
    return out
