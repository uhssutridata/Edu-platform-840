"""Homework assignments, student PDF submissions and teacher grading."""

import base64
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, now_utc, require_role, require_subscription
from lib.db import db

router = APIRouter(prefix="/homework", tags=["homework"])
MAX_PDF_BYTES = 5 * 1024 * 1024


class HomeworkCreate(BaseModel):
    title: str
    description: str = ""
    due_date: Optional[str] = None


class SubmissionBrief(BaseModel):
    id: str
    status: str
    grade: Optional[float] = None
    feedback: Optional[str] = None
    submitted_at: Optional[datetime] = None
    filename: Optional[str] = None


class SubmissionFull(SubmissionBrief):
    homework_id: str
    student_id: str
    student_name: str
    size: int = 0
    graded_at: Optional[datetime] = None


class HomeworkOut(BaseModel):
    id: str
    title: str
    description: str = ""
    due_date: Optional[str] = None
    created_by_name: str = ""
    created_at: datetime
    my_submission: Optional[SubmissionBrief] = None
    submission_count: int = 0
    graded_count: int = 0


class HomeworkDetail(HomeworkOut):
    submissions: List[SubmissionFull] = []


class GradeRequest(BaseModel):
    grade: float = Field(ge=0, le=100)
    feedback: str = ""


def _sub_brief(doc: dict) -> SubmissionBrief:
    return SubmissionBrief(
        id=doc["id"],
        status=doc.get("status", "submitted"),
        grade=doc.get("grade"),
        feedback=doc.get("feedback"),
        submitted_at=aware(doc["submitted_at"]) if doc.get("submitted_at") else None,
        filename=doc.get("filename"),
    )


def _sub_full(doc: dict) -> SubmissionFull:
    return SubmissionFull(
        **_sub_brief(doc).model_dump(),
        homework_id=doc["homework_id"],
        student_id=doc["student_id"],
        student_name=doc.get("student_name", ""),
        size=doc.get("size", 0),
        graded_at=aware(doc["graded_at"]) if doc.get("graded_at") else None,
    )


@router.get("", response_model=List[HomeworkOut])
async def list_homework(me: Annotated[dict, Depends(get_current_user)]) -> List[HomeworkOut]:
    docs = await db.homeworks.find().sort("created_at", -1).to_list(200)
    hw_ids = [d["id"] for d in docs]
    query = {"homework_id": {"$in": hw_ids}}
    if me["role"] == "student":
        query["student_id"] = me["id"]
    subs = await db.submissions.find(query, {"data": 0}).to_list(500)
    by_hw: dict[str, list[dict]] = {}
    for s in subs:
        by_hw.setdefault(s["homework_id"], []).append(s)
    out: List[HomeworkOut] = []
    for d in docs:
        mine = None
        if me["role"] == "student":
            own = next((s for s in by_hw.get(d["id"], []) if s["student_id"] == me["id"]), None)
            mine = _sub_brief(own) if own else None
        hw_subs = by_hw.get(d["id"], [])
        out.append(
            HomeworkOut(
                id=d["id"],
                title=d["title"],
                description=d.get("description", ""),
                due_date=d.get("due_date"),
                created_by_name=d.get("created_by_name", ""),
                created_at=aware(d["created_at"]),
                my_submission=mine,
                submission_count=len(hw_subs),
                graded_count=sum(1 for s in hw_subs if s.get("status") == "graded"),
            )
        )
    return out


@router.post("", response_model=HomeworkOut)
async def create_homework(
    req: HomeworkCreate, me: Annotated[dict, Depends(get_current_user)]
) -> HomeworkOut:
    require_role(me, "teacher", "admin")
    doc = {
        "id": str(uuid.uuid4()),
        "title": req.title.strip(),
        "description": req.description.strip(),
        "due_date": req.due_date,
        "created_by": me["id"],
        "created_by_name": me["name"],
        "created_at": now_utc(),
    }
    await db.homeworks.insert_one(doc)
    return HomeworkOut(**{**doc, "created_at": aware(doc["created_at"])})


@router.get("/{hw_id}", response_model=HomeworkDetail)
async def get_homework(hw_id: str, me: Annotated[dict, Depends(get_current_user)]) -> HomeworkDetail:
    doc = await db.homeworks.find_one({"id": hw_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Homework not found")
    query: dict = {"homework_id": hw_id}
    if me["role"] == "student":
        query["student_id"] = me["id"]
    subs = await db.submissions.find(query, {"data": 0}).sort("submitted_at", -1).to_list(300)
    mine = next((s for s in subs if s["student_id"] == me["id"]), None) if me["role"] == "student" else None
    return HomeworkDetail(
        id=doc["id"],
        title=doc["title"],
        description=doc.get("description", ""),
        due_date=doc.get("due_date"),
        created_by_name=doc.get("created_by_name", ""),
        created_at=aware(doc["created_at"]),
        my_submission=_sub_brief(mine) if mine else None,
        submission_count=len(subs),
        graded_count=sum(1 for s in subs if s.get("status") == "graded"),
        submissions=[_sub_full(s) for s in subs],
    )


@router.post("/{hw_id}/submit", response_model=SubmissionBrief)
async def submit_homework(
    hw_id: str,
    me: Annotated[dict, Depends(get_current_user)],
    file: UploadFile = File(...),
) -> SubmissionBrief:
    require_role(me, "student")
    require_subscription(me)
    hw = await db.homeworks.find_one({"id": hw_id})
    if not hw:
        raise HTTPException(status_code=404, detail="Homework not found")
    filename = file.filename or "submission.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="Only .pdf files are accepted")
    raw = await file.read()
    if len(raw) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF too large — maximum 5 MB")
    now = now_utc()
    existing = await db.submissions.find_one({"homework_id": hw_id, "student_id": me["id"]})
    data = base64.b64encode(raw).decode()
    if existing:
        if existing.get("status") == "graded":
            raise HTTPException(status_code=409, detail="This submission was already graded")
        await db.submissions.update_one(
            {"id": existing["id"]},
            {"$set": {
                "filename": filename,
                "size": len(raw),
                "data": data,
                "status": "submitted",
                "grade": None,
                "feedback": None,
                "submitted_at": now,
                "graded_at": None,
            }},
        )
        sub_id = existing["id"]
    else:
        sub_id = str(uuid.uuid4())
        await db.submissions.insert_one({
            "id": sub_id,
            "homework_id": hw_id,
            "student_id": me["id"],
            "student_name": me["name"],
            "filename": filename,
            "size": len(raw),
            "data": data,
            "status": "submitted",
            "grade": None,
            "feedback": None,
            "submitted_at": now,
            "graded_at": None,
        })
    return SubmissionBrief(id=sub_id, status="submitted", submitted_at=now, filename=filename)


@router.get("/{hw_id}/submissions", response_model=List[SubmissionFull])
async def list_submissions(hw_id: str, me: Annotated[dict, Depends(get_current_user)]) -> List[SubmissionFull]:
    require_role(me, "teacher", "admin")
    subs = await db.submissions.find({"homework_id": hw_id}, {"data": 0}).sort("submitted_at", -1).to_list(300)
    return [_sub_full(s) for s in subs]


@router.get("/submissions/mine", response_model=List[SubmissionFull])
async def my_submissions(me: Annotated[dict, Depends(get_current_user)]) -> List[SubmissionFull]:
    require_role(me, "student")
    subs = await db.submissions.find({"student_id": me["id"]}, {"data": 0}).sort("submitted_at", -1).to_list(300)
    return [_sub_full(s) for s in subs]


@router.get("/submissions/{sub_id}/pdf")
async def submission_pdf(sub_id: str, me: Annotated[dict, Depends(get_current_user)]) -> object:
    sub = await db.submissions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    if me["role"] == "student" and sub["student_id"] != me["id"]:
        raise HTTPException(status_code=403, detail="You can only view your own submission")
    from fastapi import Response

    return Response(
        content=base64.b64decode(sub["data"]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{sub["filename"]}"'},
    )


@router.post("/submissions/{sub_id}/grade", response_model=SubmissionFull)
async def grade_submission(
    sub_id: str, req: GradeRequest, me: Annotated[dict, Depends(get_current_user)]
) -> SubmissionFull:
    require_role(me, "teacher", "admin")
    require_subscription(me)
    sub = await db.submissions.find_one({"id": sub_id})
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    await db.submissions.update_one(
        {"id": sub_id},
        {"$set": {"grade": req.grade, "feedback": req.feedback, "status": "graded", "graded_at": now_utc()}},
    )
    sub.update({"grade": req.grade, "feedback": req.feedback, "status": "graded", "graded_at": now_utc()})
    return _sub_full(sub)
