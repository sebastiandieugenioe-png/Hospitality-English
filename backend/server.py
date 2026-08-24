from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
import re
from datetime import datetime, timezone

import seed_content
import seed_reference
import seed_catalog

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Inglés para Hostelería API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class Onboarding(BaseModel):
    workplace: Optional[str] = None
    goal: Optional[str] = None


class GuestCreate(BaseModel):
    # Legacy optional fields (kept for backwards compatibility with old clients).
    workplace: Optional[str] = None
    goal: Optional[str] = None


class ProfileUpdate(BaseModel):
    role: str
    venue_type: str
    target_country: str
    goal: str
    english_level: Optional[str] = None


class FlashcardInteraction(BaseModel):
    learning_item_id: str
    knew: bool


class LessonCompletion(BaseModel):
    situation_slug: str
    score: int
    total: int


class AttemptStart(BaseModel):
    guest_id: str
    situation_slug: str


class AttemptResponse(BaseModel):
    question_id: str
    section: str  # "exercise" | "quiz"
    submitted_answer: object


# ---------- Scoring helpers ----------
def _norm(s):
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s]", "", str(s).lower())).strip()


def _check_answer(q, submitted):
    t = q["type"]
    if t == "multiple_choice":
        if isinstance(submitted, bool):
            return False
        if isinstance(submitted, int) or (isinstance(submitted, str) and str(submitted).isdigit()):
            return int(submitted) == q["answer_index"]
        return _norm(submitted) == _norm(q["options"][q["answer_index"]])
    if t == "fill_gap":
        return _norm(submitted) == _norm(q["answer"])
    if t == "word_ordering":
        built = submitted if isinstance(submitted, str) else " ".join(submitted or [])
        return _norm(built) == _norm(q["answer"])
    return False


async def _lesson_questions(situation_slug):
    """Return {question_id: (section, question_dict)} for a situation's lesson."""
    lesson = await db.lessons.find_one({"situation_slug": situation_slug}, {"_id": 0})
    if not lesson:
        return {}, None
    index = {}
    for q in lesson.get("exercises", []):
        index[q["id"]] = ("exercise", q)
    for q in lesson.get("quiz", []):
        index[q["id"]] = ("quiz", q)
    return index, lesson


def _compute_scores(responses, index):
    """Overall + per-dimension scores from canonical question set (each question counted once)."""
    latest = {}
    for r in responses:
        latest[r["question_id"]] = r
    total = len(index)
    correct = sum(1 for r in latest.values() if r["correct"])
    overall = round(correct / total * 100) if total else 0

    dims = {"english": [0, 0], "comprehension": [0, 0], "service": [0, 0]}
    for qid, (section, q) in index.items():
        dim = q.get("assessment_dimension", "english")
        if dim in dims:
            dims[dim][1] += 1
            r = latest.get(qid)
            if r and r["correct"]:
                dims[dim][0] += 1

    def pct(pair):
        return round(pair[0] / pair[1] * 100) if pair[1] else None

    return {
        "overall": overall,
        "english": pct(dims["english"]),
        "comprehension": pct(dims["comprehension"]),
        "service": pct(dims["service"]),
    }, total, correct


def _is_mastered(scores):
    if scores["overall"] < 80:
        return False
    if scores["service"] is not None and scores["service"] < 70:
        return False
    return True


# ---------- Content endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "Inglés para Hostelería API"}


@api_router.get("/categories")
async def get_categories():
    cats = await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100)
    # attach situation count
    for c in cats:
        c["situation_count"] = await db.situations.count_documents({"category": c["slug"]})
    return cats


@api_router.get("/categories/{slug}")
async def get_category(slug: str):
    cat = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    situations = await db.situations.find({"category": slug}, {"_id": 0}).sort("order", 1).to_list(100)
    cat["situations"] = situations
    return cat


@api_router.get("/lessons/{situation_slug}")
async def get_lesson(situation_slug: str):
    situation = await db.situations.find_one({"slug": situation_slug}, {"_id": 0})
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    lesson = await db.lessons.find_one({"situation_slug": situation_slug}, {"_id": 0})
    if not lesson:
        # Situation exists but the full lesson is not authored yet in this phase.
        return {"situation": situation, "available": False}
    return {"situation": situation, "available": True, "lesson": lesson}


# ---------- Reference / taxonomy endpoints (read-only, additive) ----------
@api_router.get("/professional-profiles")
async def get_professional_profiles():
    return await db.professional_profiles.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@api_router.get("/venue-types")
async def get_venue_types():
    return await db.venue_types.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@api_router.get("/target-countries")
async def get_target_countries():
    return await db.target_countries.find({}, {"_id": 0}).sort("order", 1).to_list(100)


@api_router.get("/skills")
async def get_skills(role: str = Query(None), venue_type: str = Query(None)):
    """Active skills, optionally filtered by role, each with a situation_count.

    situation_count reflects how many ACTIVE situations match the role (and venue,
    when provided) for that skill (as primary or secondary).
    """
    if role and not await db.professional_profiles.find_one({"slug": role}):
        raise HTTPException(status_code=422, detail="Invalid role")
    if venue_type and not await db.venue_types.find_one({"slug": venue_type}):
        raise HTTPException(status_code=422, detail="Invalid venue_type")

    query = {"active": True}
    if role:
        query["roles"] = role
    skills = await db.skills.find(query, {"_id": 0}).sort("order", 1).to_list(100)

    for sk in skills:
        sit_q = {"active": True, "skills": sk["id"]}
        if role:
            sit_q["roles"] = role
        situations = await db.situations.find(sit_q, {"_id": 0, "venue_types": 1}).to_list(500)
        if venue_type:
            situations = [s for s in situations if not s.get("venue_types") or venue_type in s["venue_types"]]
        sk["situation_count"] = len(situations)
    return skills


async def _validate_situation_filters(role, skill, venue_type):
    if role and not await db.professional_profiles.find_one({"slug": role}):
        raise HTTPException(status_code=422, detail="Invalid role")
    if skill and not await db.skills.find_one({"id": skill}):
        raise HTTPException(status_code=422, detail="Invalid skill")
    if venue_type and not await db.venue_types.find_one({"slug": venue_type}):
        raise HTTPException(status_code=422, detail="Invalid venue_type")


@api_router.get("/situations")
async def list_situations(role: str = Query(None), skill: str = Query(None), venue_type: str = Query(None)):
    """List ACTIVE situations filtered by role / skill / venue_type.

    Venue rule: a situation with an empty venue_types is valid for any venue;
    otherwise it must include the requested venue_type.
    """
    await _validate_situation_filters(role, skill, venue_type)
    query = {"active": True}
    if role:
        query["roles"] = role
    if skill:
        query["skills"] = skill
    situations = await db.situations.find(query, {"_id": 0}).sort("order", 1).to_list(500)
    if venue_type:
        situations = [s for s in situations if not s.get("venue_types") or venue_type in s["venue_types"]]
    return situations


@api_router.get("/situations/{slug}")
async def get_situation(slug: str):
    situation = await db.situations.find_one({"slug": slug}, {"_id": 0})
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    return situation


@api_router.get("/learning-goals")
async def get_learning_goals():
    return await db.learning_goals.find({}, {"_id": 0}).sort("order", 1).to_list(100)


# ---------- Guest / progress endpoints ----------
@api_router.post("/guests")
async def create_guest(payload: GuestCreate):
    guest = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        # Legacy onboarding kept for backwards compatibility; not the source of truth.
        "onboarding": {"workplace": payload.workplace, "goal": payload.goal},
        # Professional profile: who the user is and where they want to use English.
        "professional_profile": {
            "role": None,
            "venue_type": None,
            "target_country": None,
            "goal": None,
            "english_level": None,
        },
        "onboarding_completed": False,
        # Existing progress (must never be reset).
        "flashcard_interactions": [],
        "completed_lessons": [],
    }
    await db.guests.insert_one(dict(guest))
    guest.pop("_id", None)
    return guest


@api_router.put("/guests/{guest_id}/profile")
async def update_profile(guest_id: str, payload: ProfileUpdate):
    guest = await db.guests.find_one({"id": guest_id})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    # Validate every id against its taxonomy so we never store unknown values.
    invalid = []
    if not await db.professional_profiles.find_one({"slug": payload.role}):
        invalid.append("role")
    if not await db.venue_types.find_one({"slug": payload.venue_type}):
        invalid.append("venue_type")
    if not await db.target_countries.find_one({"id": payload.target_country}):
        invalid.append("target_country")
    if not await db.learning_goals.find_one({"id": payload.goal}):
        invalid.append("goal")
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid values for: {', '.join(invalid)}")

    profile = {
        "role": payload.role,
        "venue_type": payload.venue_type,
        "target_country": payload.target_country,
        "goal": payload.goal,
        "english_level": payload.english_level,
    }
    await db.guests.update_one(
        {"id": guest_id},
        {"$set": {"professional_profile": profile, "onboarding_completed": True}},
    )
    return await db.guests.find_one({"id": guest_id}, {"_id": 0})


@api_router.get("/guests/{guest_id}")
async def get_guest(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return guest


@api_router.put("/guests/{guest_id}/onboarding")
async def update_onboarding(guest_id: str, payload: Onboarding):
    result = await db.guests.update_one(
        {"id": guest_id},
        {"$set": {"onboarding": {"workplace": payload.workplace, "goal": payload.goal}}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    return guest


@api_router.post("/guests/{guest_id}/flashcard")
async def record_flashcard(guest_id: str, payload: FlashcardInteraction):
    interaction = {
        "learning_item_id": payload.learning_item_id,
        "knew": payload.knew,
        "at": now_iso(),
    }
    result = await db.guests.update_one(
        {"id": guest_id},
        {"$push": {"flashcard_interactions": interaction}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"ok": True}


@api_router.post("/guests/{guest_id}/complete")
async def record_completion(guest_id: str, payload: LessonCompletion):
    completion = {
        "situation_slug": payload.situation_slug,
        "score": payload.score,
        "total": payload.total,
        "at": now_iso(),
    }
    result = await db.guests.update_one(
        {"id": guest_id},
        {"$push": {"completed_lessons": completion}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"ok": True}


# ---------- Situation attempts (independent collection) ----------
@api_router.post("/situation-attempts/start")
async def start_attempt(payload: AttemptStart):
    if not await db.guests.find_one({"id": payload.guest_id}):
        raise HTTPException(status_code=404, detail="Guest not found")
    situation = await db.situations.find_one({"slug": payload.situation_slug}, {"_id": 0})
    if not situation:
        raise HTTPException(status_code=404, detail="Situation not found")
    if not situation.get("active"):
        raise HTTPException(status_code=400, detail="Situation is not active")

    existing = await db.situation_attempts.find_one(
        {"guest_id": payload.guest_id, "situation_slug": payload.situation_slug, "status": "in_progress"},
        {"_id": 0},
    )
    _, lesson = await _lesson_questions(payload.situation_slug)
    lesson_version = (lesson or {}).get("content_version", 1)
    if existing:
        return {"attempt_id": existing["id"], "status": existing["status"], "lesson_version": existing["lesson_version"]}

    attempt = {
        "id": str(uuid.uuid4()),
        "guest_id": payload.guest_id,
        "situation_slug": payload.situation_slug,
        "role": (situation.get("roles") or [None])[0],
        "primary_skill": situation.get("primary_skill"),
        "lesson_version": lesson_version,
        "status": "in_progress",
        "started_at": now_iso(),
        "completed_at": None,
        "responses": [],
        "scores": {"overall": None, "english": None, "comprehension": None, "service": None},
        "total_questions": 0,
        "correct_questions": 0,
    }
    await db.situation_attempts.insert_one(dict(attempt))
    return {"attempt_id": attempt["id"], "status": "in_progress", "lesson_version": lesson_version}


@api_router.put("/situation-attempts/{attempt_id}/response")
async def submit_response(attempt_id: str, payload: AttemptResponse):
    attempt = await db.situation_attempts.find_one({"id": attempt_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="Attempt is not in progress")

    index, _ = await _lesson_questions(attempt["situation_slug"])
    if payload.question_id not in index:
        raise HTTPException(status_code=422, detail="Question does not belong to this lesson")
    section, q = index[payload.question_id]
    if section != payload.section:
        raise HTTPException(status_code=422, detail="Section mismatch for question")

    correct = _check_answer(q, payload.submitted_answer)
    dim = q.get("assessment_dimension", "english")
    response = {
        "question_id": payload.question_id,
        "section": section,
        "assessment_dimension": dim,
        "submitted_answer": payload.submitted_answer,
        "correct": correct,
        "answered_at": now_iso(),
    }
    await db.situation_attempts.update_one(
        {"id": attempt_id}, {"$pull": {"responses": {"question_id": payload.question_id}}}
    )
    await db.situation_attempts.update_one(
        {"id": attempt_id}, {"$push": {"responses": response}}
    )
    return {"correct": correct, "feedback": q.get("explanation_es"), "assessment_dimension": dim}


@api_router.post("/situation-attempts/{attempt_id}/complete")
async def complete_attempt(attempt_id: str):
    attempt = await db.situation_attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt["status"] == "completed":
        return attempt

    index, _ = await _lesson_questions(attempt["situation_slug"])
    scores, total, correct = _compute_scores(attempt.get("responses", []), index)
    mastered = _is_mastered(scores)
    await db.situation_attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "status": "completed", "completed_at": now_iso(), "scores": scores,
            "total_questions": total, "correct_questions": correct, "mastered": mastered,
        }},
    )
    return await db.situation_attempts.find_one({"id": attempt_id}, {"_id": 0})


@api_router.get("/guests/{guest_id}/attempts")
async def list_attempts(guest_id: str):
    return await db.situation_attempts.find({"guest_id": guest_id}, {"_id": 0}).sort("started_at", -1).to_list(1000)


@api_router.get("/guests/{guest_id}/situation-stats")
async def situation_stats(guest_id: str):
    attempts = await db.situation_attempts.find({"guest_id": guest_id}, {"_id": 0}).to_list(1000)
    stats = {}
    for a in attempts:
        slug = a["situation_slug"]
        s = stats.setdefault(slug, {
            "status": "not_started", "attempts_count": 0, "best_score": None,
            "latest_score": None, "mastered": False, "latest_attempt_at": None,
        })
        s["attempts_count"] += 1
        started = a.get("started_at")
        if s["latest_attempt_at"] is None or (started and started > s["latest_attempt_at"]):
            s["latest_attempt_at"] = started
            if a["status"] == "completed":
                s["latest_score"] = a["scores"]["overall"]
        if a["status"] == "completed":
            ov = a["scores"]["overall"]
            if s["best_score"] is None or ov > s["best_score"]:
                s["best_score"] = ov
            if a.get("mastered"):
                s["mastered"] = True
    for slug, s in stats.items():
        if s["mastered"]:
            s["status"] = "mastered"
        elif s["best_score"] is not None:
            s["status"] = "completed"
        else:
            s["status"] = "in_progress"
    return stats


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_seed():
    await seed_content.seed(db)
    await seed_reference.seed_reference(db)
    await seed_catalog.seed_catalog(db)
    # Forward-looking indexes (safe / additive).
    try:
        await db.guests.create_index("id")
        await db.categories.create_index("slug")
        await db.situations.create_index("slug")
        await db.situations.create_index("category")
        await db.learning_items.create_index("id")
        await db.learning_items.create_index("situation_slug")
        await db.situation_attempts.create_index("guest_id")
        await db.situation_attempts.create_index([("guest_id", 1), ("situation_slug", 1)])
        await db.situation_attempts.create_index([("guest_id", 1), ("status", 1)])
        await db.situation_attempts.create_index([("guest_id", 1), ("primary_skill", 1)])
        await db.situation_attempts.create_index("completed_at")
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")
    logger.info("Content + reference data seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
