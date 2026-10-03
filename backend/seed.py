"""Dev seed: drops and rebuilds the demo dataset. Run: cd /app/backend && python seed.py"""

import base64
import uuid
from datetime import datetime, timedelta, timezone

from lib.auth import hash_password
from lib.db import db, ensure_indexes

COLLECTIONS = [
    "users", "sessions", "homeworks", "submissions", "exams", "exam_attempts",
    "tutorials", "conversations", "messages", "payment_transactions", "status_checks",
]


def build_pdf(title: str, lines: list[str]) -> bytes:
    """A minimal, valid one-page PDF (correct xref offsets) for demo submissions."""

    def esc(s: str) -> str:
        return s.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")

    body = [title] + lines
    content = "".join(
        f"BT /F1 14 Tf 72 {740 - i * 24} Td ({esc(line)}) Tj ET\n" for i, line in enumerate(body)
    )
    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        "/Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}endstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = "%PDF-1.4\n"
    offsets = []
    for i, obj in enumerate(objs):
        offsets.append(len(out))
        out += f"{i + 1} 0 obj\n{obj}\nendobj\n"
    xref_pos = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n"
    for off in offsets:
        out += f"{off:010d} 00000 n \n"
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF"
    )
    return out.encode()


def make_user(name: str, email: str, password: str, role: str, plan: str = "free", sub_days: int | None = None) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": str(uuid.uuid4()),
        "name": name,
        "email": email,
        "password_hash": hash_password(password),
        "role": role,
        "plan": plan,
        "subscription_end": now + timedelta(days=sub_days) if sub_days else None,
        "created_at": now - timedelta(days=30),
    }


def question(text: str, options: list[str], correct_index: int) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "text": text,
        "options": options,
        "correct_index": correct_index,
        "points": 1,
    }


async def main() -> None:
    now = datetime.now(timezone.utc)
    for c in COLLECTIONS:
        await db[c].drop()
    await ensure_indexes()

    admin = make_user("Admin", "admin@lms.com", "admin123", "admin")
    sarah = make_user("Sarah Collins", "teacher@lms.com", "teacher123", "teacher", "teacher_pro", 30)
    priya = make_user("Priya Sharma", "priya@lms.com", "teacher123", "teacher")
    jordan = make_user("Jordan Lee", "student@lms.com", "student123", "student", "student_pro", 30)
    alex = make_user("Alex Kim", "alex@lms.com", "student123", "student")
    maria = make_user("Maria Garcia", "maria@lms.com", "student123", "student", "student_pro", 30)
    await db.users.insert_many([admin, sarah, priya, jordan, alex, maria])

    # ---- homework + submissions (with real, valid PDFs) ----
    hw1 = {
        "id": str(uuid.uuid4()), "title": "Linear Algebra — Problem Set 1",
        "description": "Solve problems 1–12 from chapter 2. Show every step of your row reduction and upload a single PDF.",
        "due_date": (now + timedelta(days=3)).strftime("%Y-%m-%d"),
        "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=2),
    }
    hw2 = {
        "id": str(uuid.uuid4()), "title": "Physics — Motion Lab Report",
        "description": "Write up the projectile-motion lab: method, data table, error analysis. Include your graphs.",
        "due_date": (now + timedelta(days=7)).strftime("%Y-%m-%d"),
        "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=1),
    }
    hw3 = {
        "id": str(uuid.uuid4()), "title": "History of Computing — Essay Outline",
        "description": "One-page outline for the term essay on a computing pioneer of your choice.",
        "due_date": (now + timedelta(days=10)).strftime("%Y-%m-%d"),
        "created_by": priya["id"], "created_by_name": priya["name"], "created_at": now - timedelta(hours=5),
    }
    await db.homeworks.insert_many([hw1, hw2, hw3])

    pdf1 = build_pdf("Linear Algebra — Problem Set 1", [
        "Jordan Lee — Student ID S-2026-014", "",
        "Q1. Row-reducing the augmented matrix gives the unique", "solution x = 2, y = -1, z = 3.", "",
        "Q2. The vectors are linearly dependent because v3 = 2*v1 - v2, so det = 0.",
    ])
    pdf2 = build_pdf("Linear Algebra — Problem Set 1", [
        "Maria Garcia", "",
        "Q1. Reduced echelon form yields x = 2, y = -1, z = 3.",
        "Q2. det(A) = 0, so the set is linearly dependent.",
    ])
    pdf3 = build_pdf("Physics — Motion Lab Report", [
        "Maria Garcia", "",
        "Method: photogate timer, 5 releases per height.",
        "Result: measured g = 9.71 m/s^2 (1.0% error).",
    ])
    await db.submissions.insert_many([
        {
            "id": str(uuid.uuid4()), "homework_id": hw1["id"], "student_id": jordan["id"],
            "student_name": jordan["name"], "filename": "jordan-pset1.pdf", "size": len(pdf1),
            "data": base64.b64encode(pdf1).decode(), "status": "submitted", "grade": None,
            "feedback": None, "submitted_at": now - timedelta(hours=3), "graded_at": None,
        },
        {
            "id": str(uuid.uuid4()), "homework_id": hw1["id"], "student_id": maria["id"],
            "student_name": maria["name"], "filename": "maria-pset1.pdf", "size": len(pdf2),
            "data": base64.b64encode(pdf2).decode(), "status": "graded", "grade": 88,
            "feedback": "Excellent work — watch your notation in Q2.",
            "submitted_at": now - timedelta(hours=20), "graded_at": now - timedelta(hours=1),
        },
        {
            "id": str(uuid.uuid4()), "homework_id": hw2["id"], "student_id": maria["id"],
            "student_name": maria["name"], "filename": "maria-lab-report.pdf", "size": len(pdf3),
            "data": base64.b64encode(pdf3).decode(), "status": "submitted", "grade": None,
            "feedback": None, "submitted_at": now - timedelta(hours=2), "graded_at": None,
        },
    ])

    # ---- exams: one live now, one starting in 2 minutes, one ended with results ----
    exam_live = {
        "id": str(uuid.uuid4()), "title": "Mathematics Midterm", "subject": "Mathematics",
        "start_at": now - timedelta(minutes=10), "duration_minutes": 60,
        "questions": [
            question("What is the derivative of x^3?", ["3x^2", "x^2", "3x", "x^3/3"], 0),
            question("If A is a 3x3 matrix with det(A) = 0, then A is…", ["Invertible", "Singular", "Orthogonal", "Symmetric"], 1),
            question("The eigenvalues of the identity matrix are…", ["All 0", "All 1", "All -1", "Undefined"], 1),
        ],
        "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=1),
    }
    exam_soon = {
        "id": str(uuid.uuid4()), "title": "Physics Quiz — Live Round", "subject": "Physics",
        "start_at": now + timedelta(minutes=2), "duration_minutes": 15,
        "questions": [
            question("Ignoring air resistance, a projectile's horizontal velocity is…", ["Constant", "Zero", "Increasing", "Negative"], 0),
            question("At the top of its arc, a projectile's vertical velocity is…", ["Maximum", "Zero", "Negative", "Undefined"], 1),
        ],
        "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(hours=6),
    }
    q_hist = [
        question("Who is considered the first computer programmer?", ["Ada Lovelace", "Grace Hopper", "Alan Turing", "Charles Babbage"], 0),
        question("The ENIAC's main computing elements were…", ["Vacuum tubes", "Transistors", "Microchips", "Gears"], 0),
        question("The Apple I was released in…", ["1976", "1981", "1984", "1990"], 0),
    ]
    exam_past = {
        "id": str(uuid.uuid4()), "title": "History of Computing — Weekly Quiz", "subject": "History",
        "start_at": now - timedelta(days=2), "duration_minutes": 45, "questions": q_hist,
        "created_by": priya["id"], "created_by_name": priya["name"], "created_at": now - timedelta(days=3),
    }
    await db.exams.insert_many([exam_live, exam_soon, exam_past])

    await db.exam_attempts.insert_many([
        {
            "id": str(uuid.uuid4()), "exam_id": exam_past["id"], "student_id": jordan["id"],
            "answers": {q_hist[0]["id"]: 0, q_hist[1]["id"]: 0, q_hist[2]["id"]: 1},
            "started_at": exam_past["start_at"] + timedelta(minutes=1),
            "submitted_at": exam_past["start_at"] + timedelta(minutes=20),
            "auto_submitted": False, "score": 2,
        },
        {
            "id": str(uuid.uuid4()), "exam_id": exam_past["id"], "student_id": alex["id"],
            "answers": {q_hist[0]["id"]: 2, q_hist[1]["id"]: 1, q_hist[2]["id"]: 0},
            "started_at": exam_past["start_at"] + timedelta(minutes=2),
            "submitted_at": exam_past["start_at"] + timedelta(minutes=40),
            "auto_submitted": True, "score": 1,
        },
    ])

    # ---- tutorials: three animated lessons + one YouTube embed ----
    await db.tutorials.insert_many([
        {
            "id": str(uuid.uuid4()), "title": "Sorting Algorithms, Visualised", "subject": "Computer Science",
            "kind": "animated", "youtube_id": None,
            "steps": [
                {"title": "The array", "description": "We start with an unsorted list of numbers — each bar is one value.", "viz": "sorting"},
                {"title": "Compare neighbours", "description": "Bubble sort compares adjacent pairs and swaps the larger one rightward.", "viz": "sorting"},
                {"title": "The big bubble", "description": "After one full pass, the largest value has bubbled to the far end.", "viz": "sorting"},
                {"title": "Sorted!", "description": "Repeat the passes and the whole array lands in order — O(n^2) worst case.", "viz": "sorting"},
            ],
            "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=4),
        },
        {
            "id": str(uuid.uuid4()), "title": "Derivatives as Slopes", "subject": "Mathematics",
            "kind": "animated", "youtube_id": None,
            "steps": [
                {"title": "A curve", "description": "This is f(x) — a smooth curve we want to differentiate.", "viz": "graph"},
                {"title": "Pick two points", "description": "The secant line joins two points; its slope is the average rate of change.", "viz": "graph"},
                {"title": "Slide them together", "description": "As the gap shrinks to zero, the secant approaches the tangent.", "viz": "graph"},
                {"title": "The derivative", "description": "The tangent's slope at x is f'(x) — the derivative, drawn live.", "viz": "graph"},
            ],
            "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=3),
        },
        {
            "id": str(uuid.uuid4()), "title": "Projectile Motion", "subject": "Physics",
            "kind": "animated", "youtube_id": None,
            "steps": [
                {"title": "Launch", "description": "A ball leaves the cannon at 45 degrees with fixed speed.", "viz": "projectile"},
                {"title": "Two independent motions", "description": "Horizontally: constant velocity. Vertically: constant gravity.", "viz": "projectile"},
                {"title": "The arc", "description": "Combined, the path is a parabola — the trajectory traced here.", "viz": "projectile"},
                {"title": "Range", "description": "At 45 degrees the range is maximal for a fixed launch speed.", "viz": "projectile"},
            ],
            "created_by": sarah["id"], "created_by_name": sarah["name"], "created_at": now - timedelta(days=2),
        },
        {
            "id": str(uuid.uuid4()), "title": "Fourier Series, Explained", "subject": "Mathematics",
            "kind": "youtube", "youtube_id": "spUNpyF58BY", "steps": [],
            "created_by": priya["id"], "created_by_name": priya["name"], "created_at": now - timedelta(days=1),
        },
    ])

    # ---- chat: one group channel + two direct messages ----
    everyone = [admin["id"], sarah["id"], priya["id"], jordan["id"], alex["id"], maria["id"]]
    conv_group = {
        "id": str(uuid.uuid4()), "type": "group", "name": "CS Cohort — General", "member_ids": everyone,
        "reads": {}, "created_by": admin["id"],
        "created_at": now - timedelta(days=5), "updated_at": now - timedelta(minutes=30),
    }
    conv_dm1 = {
        "id": str(uuid.uuid4()), "type": "dm", "name": None,
        "dm_key": "|".join(sorted([sarah["id"], jordan["id"]])), "member_ids": [sarah["id"], jordan["id"]],
        "reads": {}, "created_by": jordan["id"],
        "created_at": now - timedelta(days=1), "updated_at": now - timedelta(minutes=10),
    }
    conv_dm2 = {
        "id": str(uuid.uuid4()), "type": "dm", "name": None,
        "dm_key": "|".join(sorted([sarah["id"], maria["id"]])), "member_ids": [sarah["id"], maria["id"]],
        "reads": {}, "created_by": maria["id"],
        "created_at": now - timedelta(days=1), "updated_at": now - timedelta(hours=2),
    }
    await db.conversations.insert_many([conv_group, conv_dm1, conv_dm2])

    def msg(conv: dict, sender: dict, text: str, mins_ago: float) -> dict:
        return {
            "id": str(uuid.uuid4()), "conversation_id": conv["id"], "sender_id": sender["id"],
            "sender_name": sender["name"], "sender_role": sender["role"], "text": text,
            "created_at": now - timedelta(minutes=mins_ago),
        }

    await db.messages.insert_many([
        msg(conv_group, sarah, "Welcome to the new term, everyone — check the exam schedule, the midterm window is open now.", 60 * 24 * 4),
        msg(conv_group, jordan, "Thanks! Excited (and nervous) for the midterm.", 60 * 24),
        msg(conv_group, priya, "Reminder: office hours moved to Thursday 3pm this week.", 30),
        msg(conv_dm1, jordan, "Hi Ms Collins — is the problem set due Friday or Saturday?", 15),
        msg(conv_dm1, sarah, "Friday 23:59. Good luck — show your row reduction steps!", 10),
        msg(conv_dm2, maria, "Ms Collins, could you re-check my lab report grade?", 120),
    ])

    print("Seed complete:")
    print("  admin@lms.com / admin123        (admin)")
    print("  teacher@lms.com / teacher123    (teacher, subscribed)")
    print("  priya@lms.com / teacher123      (teacher, free)")
    print("  student@lms.com / student123    (student, subscribed)")
    print("  alex@lms.com / student123       (student, free)")
    print("  maria@lms.com / student123      (student, subscribed)")


if __name__ == "__main__":
    import asyncio

    asyncio.run(main())
