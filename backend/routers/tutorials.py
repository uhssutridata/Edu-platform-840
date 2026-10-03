"""Tutorial library: in-app animated step lessons and teacher-added YouTube embeds."""

import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, now_utc, require_role
from lib.db import db

router = APIRouter(prefix="/tutorials", tags=["tutorials"])
VIZ_KINDS = ("sorting", "graph", "projectile", "cards")


class StepCreate(BaseModel):
    title: str
    description: str = ""
    viz: str = "cards"  # sorting | graph | projectile | cards


class TutorialCreate(BaseModel):
    title: str
    subject: str = "General"
    kind: str  # animated | youtube
    youtube_id: Optional[str] = None
    steps: List[StepCreate] = Field(default_factory=list)


class TutorialOut(BaseModel):
    id: str
    title: str
    subject: str
    kind: str
    youtube_id: Optional[str] = None
    steps: List[StepCreate]
    created_by_name: str = ""
    created_at: datetime


def _out(doc: dict) -> TutorialOut:
    return TutorialOut(
        id=doc["id"],
        title=doc["title"],
        subject=doc.get("subject", "General"),
        kind=doc.get("kind", "animated"),
        youtube_id=doc.get("youtube_id"),
        steps=[StepCreate(**s) for s in doc.get("steps", [])],
        created_by_name=doc.get("created_by_name", ""),
        created_at=aware(doc["created_at"]),
    )


@router.get("", response_model=List[TutorialOut])
async def list_tutorials(me: Annotated[dict, Depends(get_current_user)]) -> List[TutorialOut]:
    docs = await db.tutorials.find().sort("created_at", -1).to_list(200)
    return [_out(d) for d in docs]


@router.post("", response_model=TutorialOut)
async def create_tutorial(req: TutorialCreate, me: Annotated[dict, Depends(get_current_user)]) -> TutorialOut:
    require_role(me, "teacher", "admin")
    if req.kind not in ("animated", "youtube"):
        raise HTTPException(status_code=422, detail="kind must be animated or youtube")
    if req.kind == "youtube" and not req.youtube_id:
        raise HTTPException(status_code=422, detail="A YouTube video id is required for video tutorials")
    for s in req.steps:
        if s.viz not in VIZ_KINDS:
            raise HTTPException(status_code=422, detail=f"viz must be one of {', '.join(VIZ_KINDS)}")
    doc = {
        "id": str(uuid.uuid4()),
        "title": req.title.strip(),
        "subject": req.subject.strip() or "General",
        "kind": req.kind,
        "youtube_id": req.youtube_id,
        "steps": [s.model_dump() for s in req.steps],
        "created_by": me["id"],
        "created_by_name": me["name"],
        "created_at": now_utc(),
    }
    await db.tutorials.insert_one(doc)
    return _out(doc)
