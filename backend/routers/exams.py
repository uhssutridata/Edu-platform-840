"""Teacher-scheduled exams: one window for all students, server-synced countdown, auto-grading."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, now_utc, require_role, require_subscription
from lib.db import db

router = APIRouter(prefix="/exams", tags=["exams"])
GRACE_SECONDS = 65  # network-delay tolerance for the auto-submit firing at the deadline


class QuestionCreate(BaseModel):
    text: str
    options: List[str] = Field(min_length=2, max_length=6)
    correct_index: int = Field(ge=0)
    points: int = Field(default=1, ge=1)


class ExamCreate(BaseModel):
    title: str
    subject: str = "General"
    start_at: datetime
    duration_minutes: int = Field(ge=1, le=600)
    questions: List[QuestionCreate] = Field(min_length=1)


class QuestionOut(BaseModel):
    id: str
    text: str
    options: List[str]
    points: int = 1
    correct_index: Optional[int] = None  # stripped for students


class AttemptBrief(BaseModel):
    id: str
    status: str  # in_progress | submitted
    started_at: datetime
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    auto_submitted: bool = False


class ExamItem(BaseModel):
    id: str
    title: str
    subject: str
    start_at: datetime
    end_at: datetime
    duration_minutes: int
    status: str  # scheduled | live | ended
    question_count: int
    total_points: int
    created_by_name: str = ""
    my_status: Optional[str] = None  # None | in_progress | submitted | missed
    my_score: Optional[float] = None


class ExamDetail(ExamItem):
    questions: List[QuestionOut]
    my_attempt: Optional[AttemptBrief] = None


class SubmitRequest(BaseModel):
    answers: Dict[str, int]


class BreakdownRow(BaseModel):
    question_id: str
    answer: Optional[int] = None
    correct: bool = False


class ExamResultOut(BaseModel):
    score: float
    total: int
    auto_submitted: bool
    submitted_at: datetime
    breakdown: List[BreakdownRow]
    questions: List[QuestionOut]
    answers: Dict[str, int]


class AttemptRow(BaseModel):
    attempt_id: str
    student_id: str
    student_name: str
    started_at: datetime
    submitted_at: Optional[datetime]
    score: Optional[float]
    total: int
    auto_submitted: bool


def _end_at(exam: dict) -> datetime:
    return aware(exam["start_at"]) + timedelta(minutes=exam["duration_minutes"])


def _status(exam: dict, now: datetime) -> str:
    start = aware(exam["start_at"])
    if now < start:
        return "scheduled"
    if now <= _end_at(exam):
        return "live"
    return "ended"


def _total_points(exam: dict) -> int:
    return sum(q.get("points", 1) for q in exam.get("questions", []))


def _strip(q: dict) -> dict:
    return {k: v for k, v in q.items() if k != "correct_index"}


def _attempt_brief(doc: dict) -> AttemptBrief:
    return AttemptBrief(
        id=doc["id"],
        status="submitted" if doc.get("submitted_at") else "in_progress",
        started_at=aware(doc["started_at"]),
        submitted_at=aware(doc["submitted_at"]) if doc.get("submitted_at") else None,
        score=doc.get("score"),
        auto_submitted=doc.get("auto_submitted", False),
    )


def _question_out(q: dict, include_answer: bool) -> QuestionOut:
    return QuestionOut(
        id=q["id"],
        text=q["text"],
        options=q["options"],
        points=q.get("points", 1),
        correct_index=q.get("correct_index") if include_answer else None,
    )


@router.get("/time")
async def server_time() -> dict:
    return {"now": now_utc().isoformat()}


@router.get("", response_model=List[ExamItem])
async def list_exams(me: Annotated[dict, Depends(get_current_user)]) -> List[ExamItem]:
    exams = await db.exams.find().sort("start_at", 1).to_list(200)
    now = now_utc()
    attempts_by_exam: dict[str, dict] = {}
    if me["role"] == "student":
        attempts = await db.exam_attempts.find({"student_id": me["id"]}).to_list(300)
        attempts_by_exam = {a["exam_id"]: a for a in attempts}
    out: List[ExamItem] = []
    for e in exams:
        attempt = attempts_by_exam.get(e["id"])
        status = _status(e, now)
        my_status = None
        my_score = None
        if attempt:
            if attempt.get("submitted_at"):
                my_status = "submitted"
                my_score = attempt.get("score")
            elif status == "live":
                my_status = "in_progress"
            else:
                my_status = "missed"
        elif status == "ended" and me["role"] == "student":
            my_status = "missed"
        out.append(
            ExamItem(
                id=e["id"],
                title=e["title"],
                subject=e.get("subject", "General"),
                start_at=aware(e["start_at"]),
                end_at=_end_at(e),
                duration_minutes=e["duration_minutes"],
                status=status,
                question_count=len(e.get("questions", [])),
                total_points=_total_points(e),
                created_by_name=e.get("created_by_name", ""),
                my_status=my_status,
                my_score=my_score,
            )
        )
    return out


@router.post("", response_model=ExamDetail)
async def create_exam(req: ExamCreate, me: Annotated[dict, Depends(get_current_user)]) -> ExamDetail:
    require_role(me, "teacher", "admin")
    for q in req.questions:
        if q.correct_index >= len(q.options):
            raise HTTPException(status_code=422, detail="correct_index must point at an existing option")
    doc = {
        "id": str(uuid.uuid4()),
        "title": req.title.strip(),
        "subject": req.subject.strip() or "General",
        "start_at": req.start_at if req.start_at.tzinfo else req.start_at.replace(tzinfo=timezone.utc),
        "duration_minutes": req.duration_minutes,
        "questions": [
            {"id": str(uuid.uuid4()), "text": q.text.strip(), "options": [o.strip() for o in q.options],
             "correct_index": q.correct_index, "points": q.points}
            for q in req.questions
        ],
        "created_by": me["id"],
        "created_by_name": me["name"],
        "created_at": now_utc(),
    }
    await db.exams.insert_one(doc)
    return _detail(doc, None, include_answers=True)


@router.get("/{exam_id}", response_model=ExamDetail)
async def get_exam(exam_id: str, me: Annotated[dict, Depends(get_current_user)]) -> ExamDetail:
    e = await db.exams.find_one({"id": exam_id})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    include_answers = me["role"] in ("teacher", "admin")
    attempt = None
    if me["role"] == "student":
        attempt = await db.exam_attempts.find_one({"exam_id": exam_id, "student_id": me["id"]})
    return _detail(e, attempt, include_answers=include_answers)


def _detail(e: dict, attempt: Optional[dict], include_answers: bool) -> ExamDetail:
    now = now_utc()
    status = _status(e, now)
    my_status = None
    my_score = None
    if attempt:
        if attempt.get("submitted_at"):
            my_status = "submitted"
            my_score = attempt.get("score")
        elif status == "live":
            my_status = "in_progress"
        else:
            my_status = "missed"
    elif status == "ended":
        my_status = "missed"
    return ExamDetail(
        id=e["id"],
        title=e["title"],
        subject=e.get("subject", "General"),
        start_at=aware(e["start_at"]),
        end_at=_end_at(e),
        duration_minutes=e["duration_minutes"],
        status=status,
        question_count=len(e.get("questions", [])),
        total_points=_total_points(e),
        created_by_name=e.get("created_by_name", ""),
        my_status=my_status,
        my_score=my_score,
        questions=[_question_out(q, include_answers) for q in e.get("questions", [])],
        my_attempt=_attempt_brief(attempt) if attempt else None,
    )


@router.post("/{exam_id}/start", response_model=AttemptBrief)
async def start_exam(exam_id: str, me: Annotated[dict, Depends(get_current_user)]) -> AttemptBrief:
    require_role(me, "student")
    require_subscription(me)
    e = await db.exams.find_one({"id": exam_id})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    now = now_utc()
    start = aware(e["start_at"])
    end = _end_at(e)
    if now < start:
        raise HTTPException(status_code=409, detail="This exam has not opened yet")
    if now > end:
        raise HTTPException(status_code=409, detail="This exam window has closed")
    existing = await db.exam_attempts.find_one({"exam_id": exam_id, "student_id": me["id"]})
    if existing:
        if existing.get("submitted_at"):
            raise HTTPException(status_code=409, detail="You already submitted this exam")
        return _attempt_brief(existing)
    doc = {
        "id": str(uuid.uuid4()),
        "exam_id": exam_id,
        "student_id": me["id"],
        "answers": {},
        "started_at": now,
        "submitted_at": None,
        "auto_submitted": False,
        "score": None,
    }
    await db.exam_attempts.insert_one(doc)
    return _attempt_brief(doc)


@router.post("/{exam_id}/submit", response_model=ExamResultOut)
async def submit_exam(
    exam_id: str, req: SubmitRequest, me: Annotated[dict, Depends(get_current_user)]
) -> ExamResultOut:
    require_role(me, "student")
    e = await db.exams.find_one({"id": exam_id})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    attempt = await db.exam_attempts.find_one({"exam_id": exam_id, "student_id": me["id"]})
    if not attempt:
        raise HTTPException(status_code=404, detail="Start the exam first")
    if attempt.get("submitted_at"):
        raise HTTPException(status_code=409, detail="You already submitted this exam")
    now = now_utc()
    end = _end_at(e)
    if now > end + timedelta(seconds=GRACE_SECONDS):
        raise HTTPException(status_code=409, detail="The exam window has closed")
    score = 0.0
    breakdown: List[BreakdownRow] = []
    for q in e.get("questions", []):
        answer = req.answers.get(q["id"])
        correct = answer is not None and answer == q.get("correct_index")
        if correct:
            score += q.get("points", 1)
        breakdown.append(BreakdownRow(question_id=q["id"], answer=answer, correct=correct))
    auto = now > end
    await db.exam_attempts.update_one(
        {"id": attempt["id"]},
        {"$set": {"answers": req.answers, "score": score, "submitted_at": now, "auto_submitted": auto}},
    )
    return ExamResultOut(
        score=score,
        total=_total_points(e),
        auto_submitted=auto,
        submitted_at=now,
        breakdown=breakdown,
        questions=[_question_out(q, True) for q in e.get("questions", [])],
        answers=req.answers,
    )


@router.get("/{exam_id}/result", response_model=ExamResultOut)
async def my_result(exam_id: str, me: Annotated[dict, Depends(get_current_user)]) -> ExamResultOut:
    require_role(me, "student")
    e = await db.exams.find_one({"id": exam_id})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    attempt = await db.exam_attempts.find_one({"exam_id": exam_id, "student_id": me["id"]})
    if not attempt or not attempt.get("submitted_at"):
        raise HTTPException(status_code=404, detail="No submitted attempt yet")
    breakdown = []
    for q in e.get("questions", []):
        answer = (attempt.get("answers") or {}).get(q["id"])
        breakdown.append(BreakdownRow(
            question_id=q["id"], answer=answer, correct=answer == q.get("correct_index")
        ))
    return ExamResultOut(
        score=attempt.get("score", 0),
        total=_total_points(e),
        auto_submitted=attempt.get("auto_submitted", False),
        submitted_at=aware(attempt["submitted_at"]),
        breakdown=breakdown,
        questions=[_question_out(q, True) for q in e.get("questions", [])],
        answers=attempt.get("answers") or {},
    )


@router.get("/{exam_id}/results", response_model=List[AttemptRow])
async def exam_results(exam_id: str, me: Annotated[dict, Depends(get_current_user)]) -> List[AttemptRow]:
    require_role(me, "teacher", "admin")
    e = await db.exams.find_one({"id": exam_id})
    if not e:
        raise HTTPException(status_code=404, detail="Exam not found")
    attempts = await db.exam_attempts.find({"exam_id": exam_id}).sort("started_at", -1).to_list(300)
    user_ids = list({a["student_id"] for a in attempts})
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": user_ids}}).to_list(300)}
    return [
        AttemptRow(
            attempt_id=a["id"],
            student_id=a["student_id"],
            student_name=users.get(a["student_id"], {}).get("name", "Unknown"),
            started_at=aware(a["started_at"]),
            submitted_at=aware(a["submitted_at"]) if a.get("submitted_at") else None,
            score=a.get("score"),
            total=_total_points(e),
            auto_submitted=a.get("auto_submitted", False),
        )
        for a in attempts
    ]
