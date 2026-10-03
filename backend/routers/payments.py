"""Subscription plans + checkout.

Stripe note: the claimable-sandbox flow (Flow A) is unavailable for this pod's
country (IN is not supported by Stripe sandboxes), so checkout runs in instant
demo/test-mode billing — the plan activates on checkout exactly like a
successful test-mode payment would, and every transaction is recorded in the
payment_transactions collection. The request/response shapes below mirror the
Stripe Checkout flow (lookup_key in, session_id + status polling out), so a real
gateway can be wired in behind these same endpoints later.
"""

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing_extensions import Annotated

from lib.auth import aware, get_current_user, now_utc
from lib.db import db

router = APIRouter(prefix="/payments", tags=["payments"])


class Plan(BaseModel):
    lookup_key: str
    name: str
    role: str
    plan_id: str
    amount: float
    currency: str
    interval: str
    features: List[str]


PLANS: List[Plan] = [
    Plan(
        lookup_key="student_monthly",
        name="Student Pro",
        role="student",
        plan_id="student_pro",
        amount=9.0,
        currency="usd",
        interval="month",
        features=[
            "Unlimited live exam attempts",
            "PDF homework submissions with previews",
            "1:1 chat with every teacher",
            "Priority tutorial access",
        ],
    ),
    Plan(
        lookup_key="teacher_monthly",
        name="Teacher Pro",
        role="teacher",
        plan_id="teacher_pro",
        amount=29.0,
        currency="usd",
        interval="month",
        features=[
            "Grading desk with rubric feedback",
            "Schedule synchronized live exams",
            "Unlimited group channels",
            "Gradebook analytics",
        ],
    ),
]


class CheckoutRequest(BaseModel):
    lookup_key: str


class CheckoutOut(BaseModel):
    session_id: str
    demo: bool
    plan_name: str
    plan_id: str
    subscription_end: datetime


class TransactionOut(BaseModel):
    session_id: str
    lookup_key: str
    plan_name: str
    amount: float
    currency: str
    status: str
    payment_status: str
    created_at: datetime


@router.get("/plans", response_model=List[Plan])
async def list_plans() -> List[Plan]:
    return PLANS


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(req: CheckoutRequest, me: Annotated[dict, Depends(get_current_user)]) -> CheckoutOut:
    plan = next((p for p in PLANS if p.lookup_key == req.lookup_key), None)
    if not plan:
        raise HTTPException(status_code=404, detail="Unknown plan")
    if me["role"] != plan.role:
        raise HTTPException(status_code=400, detail=f"Choose the {plan.role} plan for your account")
    now = now_utc()
    sub_end = now + timedelta(days=30)
    session_id = uuid.uuid4().hex
    await db.payment_transactions.insert_one({
        "session_id": session_id,
        "user_id": me["id"],
        "user_email": me["email"],
        "lookup_key": plan.lookup_key,
        "plan_name": plan.name,
        "amount": plan.amount,
        "currency": plan.currency,
        "status": "completed",
        "payment_status": "paid",
        "mode": "test_demo",
        "created_at": now,
    })
    await db.users.update_one(
        {"id": me["id"]},
        {"$set": {"plan": plan.plan_id, "subscription_end": sub_end}},
    )
    return CheckoutOut(
        session_id=session_id,
        demo=True,
        plan_name=plan.name,
        plan_id=plan.plan_id,
        subscription_end=sub_end,
    )


@router.get("/status/{session_id}")
async def payment_status(session_id: str, me: Annotated[dict, Depends(get_current_user)]) -> dict:
    tx = await db.payment_transactions.find_one({"session_id": session_id})
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if me["role"] != "admin" and tx.get("user_id") != me["id"]:
        raise HTTPException(status_code=403, detail="Not your transaction")
    return {
        "session_id": tx["session_id"],
        "status": tx.get("status"),
        "payment_status": tx.get("payment_status"),
    }


@router.get("/transactions", response_model=List[TransactionOut])
async def my_transactions(me: Annotated[dict, Depends(get_current_user)]) -> List[TransactionOut]:
    docs = await db.payment_transactions.find({"user_id": me["id"]}).sort("created_at", -1).to_list(100)
    return [
        TransactionOut(
            session_id=d["session_id"],
            lookup_key=d.get("lookup_key", ""),
            plan_name=d.get("plan_name", ""),
            amount=d.get("amount", 0),
            currency=d.get("currency", "usd"),
            status=d.get("status", ""),
            payment_status=d.get("payment_status", ""),
            created_at=aware(d["created_at"]),
        )
        for d in docs
    ]
