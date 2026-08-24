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
from datetime import datetime, timezone, timedelta

import seed_content
import seed_reference
import seed_catalog
import seed_pack

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
    interface_language: Optional[str] = None


class LanguageUpdate(BaseModel):
    interface_language: str


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


class ReviewAnswer(BaseModel):
    submitted_answer: object


class ReviewRate(BaseModel):
    rating: str  # again | hard | good | easy


# ---------- Mastery + SRS constants ----------
MASTERY_OVERALL_THRESHOLD = 80
MASTERY_SERVICE_THRESHOLD = 70

DEFAULT_EASE = 2.5
MIN_EASE = 1.3
AGAIN_DELAY_MINUTES = 10
VALID_RATINGS = {"again", "hard", "good", "easy"}

# ---------- i18n ----------
# Central language registry. Add a new language here (+ data/locale files) to
# support it everywhere; components never hardcode the list.
SUPPORTED_LANGUAGES = [
    {"code": "es", "name": "Spanish", "native_name": "Español"},
    {"code": "it", "name": "Italian", "native_name": "Italiano"},
]
SUPPORTED_LANG_CODES = {lang["code"] for lang in SUPPORTED_LANGUAGES}
DEFAULT_LANGUAGE = "es"


def _loc_field(obj, base, lang):
    """Resolve a localized field with silent fallback to Spanish.
    Supports both grouped (translations.<lang>.<base>) and suffix (<base>_<lang>) shapes.
    Never returns undefined for a missing translation; falls back es → None."""
    tr = obj.get("translations") or {}
    if isinstance(tr.get(lang), dict) and tr[lang].get(base) is not None:
        return tr[lang][base]
    if obj.get(f"{base}_{lang}") is not None:
        return obj[f"{base}_{lang}"]
    if isinstance(tr.get("es"), dict) and tr["es"].get(base) is not None:
        return tr["es"][base]
    if obj.get(f"{base}_es") is not None:
        return obj[f"{base}_es"]
    return None


def _loc_options(q, lang):
    """Localized MC options if a translation exists; otherwise the canonical
    options untouched (English target answers must never be translated)."""
    tr = q.get("translations") or {}
    if isinstance(tr.get(lang), dict) and tr[lang].get("options"):
        return tr[lang]["options"]
    if q.get(f"options_{lang}"):
        return q[f"options_{lang}"]
    return q.get("options")


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
    if scores["overall"] < MASTERY_OVERALL_THRESHOLD:
        return False
    if scores["service"] is not None and scores["service"] < MASTERY_SERVICE_THRESHOLD:
        return False
    return True


def _attempt_mastered(attempt):
    """Backwards-compatible mastery read: prefer new canonical field, fall back to legacy."""
    if "met_mastery_threshold" in attempt:
        return bool(attempt["met_mastery_threshold"])
    return bool(attempt.get("mastered"))


# ---------- SRS (spaced repetition) helpers ----------
def _minutes_from_now_iso(minutes):
    return (datetime.now(timezone.utc) + timedelta(minutes=minutes)).isoformat()


def _days_from_now_iso(days):
    return (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()


def _new_review_item(guest_id, source_id, situation, section, dim, attempt_id):
    now = now_iso()
    return {
        "id": str(uuid.uuid4()),
        "guest_id": guest_id,
        "source_type": "question",
        "source_id": source_id,
        "origin": "mistake",
        "situation_slug": situation["slug"],
        "primary_skill": situation.get("primary_skill"),
        "assessment_dimension": dim,
        "section": section,
        "interval_days": 0,
        "ease_factor": DEFAULT_EASE,
        "consecutive_successes": 0,
        "review_state": "learning",
        "times_seen": 0,
        "times_correct": 0,
        "times_wrong": 1,
        "last_mistake_attempt_id": attempt_id,
        "created_at": now,
        "updated_at": now,
        "last_reviewed_at": None,
        "next_review_at": now,  # due immediately
    }


def _compute_schedule(item, rating):
    """Pure SRS scheduler. Returns fields to $set. Rating is independent of correctness."""
    ease = item.get("ease_factor", DEFAULT_EASE)
    streak = item.get("consecutive_successes", 0)

    if rating == "again":
        return {
            "ease_factor": round(max(MIN_EASE, ease - 0.20), 2),
            "consecutive_successes": 0,
            "interval_days": 0,
            "review_state": "learning",
            "next_review_at": _minutes_from_now_iso(AGAIN_DELAY_MINUTES),
        }

    if rating == "hard":
        ease = max(MIN_EASE, ease - 0.15)
    elif rating == "easy":
        ease = ease + 0.15
    # "good" leaves ease unchanged

    streak += 1
    if streak == 1:
        interval = {"hard": 1, "good": 1, "easy": 3}[rating]
    elif streak == 2:
        interval = {"hard": 3, "good": 3, "easy": 7}[rating]
    else:
        prev = item.get("interval_days") or 1
        mult = {"hard": 1.2, "good": ease, "easy": ease * 1.3}[rating]
        interval = round(prev * mult, 2)

    return {
        "ease_factor": round(ease, 2),
        "consecutive_successes": streak,
        "interval_days": interval,
        "review_state": "review",
        "next_review_at": _days_from_now_iso(interval),
    }


async def _resolve_review_content(items):
    """Resolve canonical question content for a list of review items without N+1 queries.

    Returns a dict {(situation_slug, question_id): (section, question, situation)}.
    """
    slugs = list({it["situation_slug"] for it in items})
    if not slugs:
        return {}
    lessons = await db.lessons.find({"situation_slug": {"$in": slugs}}, {"_id": 0}).to_list(1000)
    situations = await db.situations.find({"slug": {"$in": slugs}}, {"_id": 0}).to_list(1000)
    sit_by_slug = {s["slug"]: s for s in situations}
    resolved = {}
    for lesson in lessons:
        slug = lesson["situation_slug"]
        sit = sit_by_slug.get(slug)
        for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
            for q in lesson.get(key, []):
                resolved[(slug, q["id"])] = (section, q, sit)
    return resolved


def _public_question(q, lang=DEFAULT_LANGUAGE):
    """Question fields safe to render (never leak the answer before responding)."""
    out = {"id": q["id"], "type": q["type"], "prompt": _loc_field(q, "prompt", lang)}
    if q["type"] == "multiple_choice":
        out["options"] = _loc_options(q, lang)
    elif q["type"] == "fill_gap":
        out["sentence"] = q.get("sentence")
    elif q["type"] == "word_ordering":
        out["words"] = q.get("words", [])
    return out


def _correct_answer_text(q, lang=DEFAULT_LANGUAGE):
    if q["type"] == "multiple_choice":
        return _loc_options(q, lang)[q.get("answer_index", 0)]
    return q.get("answer")


# ---------- Content endpoints ----------
@api_router.get("/")
async def root():
    return {"message": "Inglés para Hostelería API"}


@api_router.get("/languages")
async def get_languages():
    return SUPPORTED_LANGUAGES


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
    lang = payload.interface_language if payload.interface_language in SUPPORTED_LANG_CODES else DEFAULT_LANGUAGE
    guest = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "interface_language": lang,
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
    # Existing guests default to Spanish without mutating stored data.
    guest.setdefault("interface_language", DEFAULT_LANGUAGE)
    return guest


@api_router.put("/guests/{guest_id}/language")
async def update_language(guest_id: str, payload: LanguageUpdate):
    if payload.interface_language not in SUPPORTED_LANG_CODES:
        raise HTTPException(status_code=422, detail="Unsupported language")
    result = await db.guests.update_one(
        {"id": guest_id}, {"$set": {"interface_language": payload.interface_language}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    return guest


async def _guest_language(guest_id):
    g = await db.guests.find_one({"id": guest_id}, {"interface_language": 1})
    return (g or {}).get("interface_language", DEFAULT_LANGUAGE)


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

    # Mistake Bank: a wrong answer becomes a spaced-repetition review item.
    if not correct:
        await _upsert_mistake(attempt, payload.question_id, section, dim)

    return {"correct": correct, "feedback": q.get("explanation_es"), "assessment_dimension": dim}


async def _upsert_mistake(attempt, question_id, section, dim):
    """Create/update a review item from a mistake. Unique per
    guest_id + source_type + source_id + situation_slug. times_wrong increments at
    most once per attempt (guarded by last_mistake_attempt_id)."""
    situation = await db.situations.find_one({"slug": attempt["situation_slug"]}, {"_id": 0})
    if not situation:
        return
    key = {
        "guest_id": attempt["guest_id"],
        "source_type": "question",
        "source_id": question_id,
        "situation_slug": attempt["situation_slug"],
    }
    existing = await db.review_items.find_one(key)
    if not existing:
        item = _new_review_item(
            attempt["guest_id"], question_id, situation, section, dim, attempt["id"]
        )
        await db.review_items.insert_one(dict(item))
        return
    updates = {"$set": {"updated_at": now_iso()}}
    if existing.get("last_mistake_attempt_id") != attempt["id"]:
        updates["$inc"] = {"times_wrong": 1}
        updates["$set"]["last_mistake_attempt_id"] = attempt["id"]
    await db.review_items.update_one({"id": existing["id"]}, updates)


@api_router.post("/situation-attempts/{attempt_id}/complete")
async def complete_attempt(attempt_id: str):
    attempt = await db.situation_attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt["status"] == "completed":
        return attempt

    index, _ = await _lesson_questions(attempt["situation_slug"])
    scores, total, correct = _compute_scores(attempt.get("responses", []), index)
    met = _is_mastered(scores)
    await db.situation_attempts.update_one(
        {"id": attempt_id},
        {"$set": {
            "status": "completed", "completed_at": now_iso(), "scores": scores,
            "total_questions": total, "correct_questions": correct,
            # Canonical field + legacy mirror for backwards compatibility.
            "met_mastery_threshold": met, "mastered": met,
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
            if _attempt_mastered(a):
                s["mastered"] = True
    for slug, s in stats.items():
        if s["mastered"]:
            s["status"] = "mastered"
        elif s["best_score"] is not None:
            s["status"] = "completed"
        else:
            s["status"] = "in_progress"
    return stats


# ---------- Spaced Repetition / Mistake Bank ----------
@api_router.get("/guests/{guest_id}/review-items")
async def get_review_items(
    guest_id: str,
    due: bool = Query(False),
    limit: int = Query(50, ge=1, le=200),
):
    """Review items for a guest with canonical content resolved (no N+1).

    - due=true → only items whose next_review_at <= now (the practice queue).
    - due=false → all active review items (the Mistake Bank / history).
    Orphan items (content no longer exists) are skipped from the response.
    """
    guest = await db.guests.find_one({"id": guest_id}, {"interface_language": 1})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)

    query = {"guest_id": guest_id}
    if due:
        query["next_review_at"] = {"$lte": now_iso()}
    items = await db.review_items.find(query, {"_id": 0}).sort("next_review_at", 1).to_list(1000)

    resolved = await _resolve_review_content(items)
    out = []
    for it in items:
        rc = resolved.get((it["situation_slug"], it["source_id"]))
        if not rc:
            continue  # orphan item: skip
        section, q, sit = rc
        out.append({
            **it,
            "situation_title": _loc_field(sit or {}, "title", lang) or (sit or {}).get("title_en"),
            "content": _public_question(q, lang),
        })
    return out[:limit]


@api_router.get("/guests/{guest_id}/review-summary")
async def get_review_summary(guest_id: str):
    """Counts for the practice landing: due total + active mistakes grouped by skill/dimension."""
    if not await db.guests.find_one({"id": guest_id}):
        raise HTTPException(status_code=404, detail="Guest not found")
    items = await db.review_items.find({"guest_id": guest_id}, {"_id": 0}).to_list(1000)
    now = now_iso()
    due = sum(1 for it in items if it.get("next_review_at", now) <= now)
    by_skill = {}
    by_dimension = {}
    for it in items:
        by_skill[it.get("primary_skill")] = by_skill.get(it.get("primary_skill"), 0) + 1
        d = it.get("assessment_dimension", "english")
        by_dimension[d] = by_dimension.get(d, 0) + 1
    return {"total": len(items), "due": due, "by_skill": by_skill, "by_dimension": by_dimension}


async def _review_item_or_404(item_id):
    item = await db.review_items.find_one({"id": item_id})
    if not item:
        raise HTTPException(status_code=404, detail="Review item not found")
    return item


@api_router.post("/review-items/{item_id}/answer")
async def answer_review_item(item_id: str, payload: ReviewAnswer):
    """Backend grades the submitted answer. Does NOT change the SRS schedule
    (rating is a separate, independent step)."""
    item = await _review_item_or_404(item_id)
    index, _ = await _lesson_questions(item["situation_slug"])
    entry = index.get(item["source_id"])
    if not entry:
        raise HTTPException(status_code=404, detail="Question content no longer exists")
    _, q = entry
    lang = await _guest_language(item["guest_id"])
    correct = _check_answer(q, payload.submitted_answer)
    inc = {"times_seen": 1}
    if correct:
        inc["times_correct"] = 1
    await db.review_items.update_one(
        {"id": item_id}, {"$inc": inc, "$set": {"updated_at": now_iso()}}
    )
    return {
        "correct": correct,
        "correct_answer": _correct_answer_text(q, lang),
        "explanation": _loc_field(q, "explanation", lang),
        "assessment_dimension": q.get("assessment_dimension", "english"),
    }


@api_router.post("/review-items/{item_id}/rate")
async def rate_review_item(item_id: str, payload: ReviewRate):
    """Recalculates the SRS schedule from a self-rating. Independent of correctness."""
    if payload.rating not in VALID_RATINGS:
        raise HTTPException(status_code=422, detail="Invalid rating")
    item = await _review_item_or_404(item_id)
    schedule = _compute_schedule(item, payload.rating)
    schedule["last_reviewed_at"] = now_iso()
    schedule["updated_at"] = now_iso()
    await db.review_items.update_one({"id": item_id}, {"$set": schedule})
    return await db.review_items.find_one({"id": item_id}, {"_id": 0})


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
    await seed_pack.seed_pack(db)
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
        await db.review_items.create_index("guest_id")
        await db.review_items.create_index([("guest_id", 1), ("next_review_at", 1)])
        await db.review_items.create_index(
            [("guest_id", 1), ("source_type", 1), ("source_id", 1), ("situation_slug", 1)],
            unique=True,
        )
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")
    logger.info("Content + reference data seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
