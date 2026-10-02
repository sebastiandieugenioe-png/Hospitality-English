from fastapi import FastAPI, APIRouter, HTTPException, Query, UploadFile, File, Form
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
import hashlib
from datetime import datetime, timezone, timedelta

import seed_content
import seed_reference
import seed_catalog
import seed_pack
import seed_pack_v2
import seed_i18n
import assessment_data as assessment
import emergency_data as emergency
import tonights_shift_data as shift
import job_interview_data as jobint
import first_week_data as firstweek
import listening_data as listening
import speaking_data as speaking
import stt_elevenlabs
import speaking_evaluator

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
    # Phase 2: current employment situation (optional for backwards compatibility).
    employment_status: Optional[str] = None


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


class AssessmentStart(BaseModel):
    guest_id: str


class AssessmentResponse(BaseModel):
    question_id: str
    submitted_answer: object


class SavedPhrase(BaseModel):
    phrase_id: str


class ShiftStart(BaseModel):
    local_date: str  # YYYY-MM-DD from the browser (avoids UTC day drift)


class ShiftResponse(BaseModel):
    item_id: str
    submitted_answer: object


class JobInterviewPractice(BaseModel):
    scenario_id: str
    answer_index: int


class JobInterviewOpen(BaseModel):
    scenario_id: str


class ListeningAnswer(BaseModel):
    listening_item_id: str
    selected_index: int


# ---------- Mastery + SRS constants ----------
MASTERY_OVERALL_THRESHOLD = 80
MASTERY_SERVICE_THRESHOLD = 70

DEFAULT_EASE = 2.5
MIN_EASE = 1.3
AGAIN_DELAY_MINUTES = 10
VALID_RATINGS = {"again", "hard", "good", "easy"}

# ---------- Recommendation (Phase 2) constants ----------
EMPLOYMENT_STATUSES = {"looking_for_job", "interview_soon", "starting_new_job", "already_working"}
LEVEL_ORDER = {"a1": 1, "a2": 2, "b1": 3, "b2": 4, "c1": 5, "c2": 6}
# Skill buckets used only to bias ranking (never to hide content).
REC_COMMUNICATION_SKILLS = {"greeting-guests", "recommendations", "complaints", "service-recovery"}
REC_PRACTICAL_SKILLS = {"taking-orders", "seating-guests", "payments", "menu-knowledge", "drink-knowledge"}

# ---------- i18n ----------
# Central language registry. Add a new language here (+ data/locale files) to
# support it everywhere; components never hardcode the list.
SUPPORTED_LANGUAGES = [
    {"code": "es", "name": "Spanish", "native_name": "Español"},
    {"code": "it", "name": "Italian", "native_name": "Italiano"},
    {"code": "fr", "name": "French", "native_name": "Français"},
    {"code": "pt", "name": "Portuguese", "native_name": "Português"},
    {"code": "de", "name": "German", "native_name": "Deutsch"},
    {"code": "pl", "name": "Polish", "native_name": "Polski"},
    {"code": "ro", "name": "Romanian", "native_name": "Română"},
    {"code": "uk", "name": "Ukrainian", "native_name": "Українська"},
    {"code": "nl", "name": "Dutch", "native_name": "Nederlands"},
    {"code": "en", "name": "English", "native_name": "English"},
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
    """Localized MC options if a complete translation exists; otherwise the canonical
    options untouched (English target answers must never be translated). Any length
    mismatch falls back to canonical so answer_index alignment can never break."""
    canonical = q.get("options") or []
    tr = q.get("translations") or {}
    if isinstance(tr.get(lang), dict):
        loc = tr[lang].get("options")
        if loc and len(loc) == len(canonical):
            return loc
    suffix = q.get(f"options_{lang}")
    if suffix and len(suffix) == len(canonical):
        return suffix
    return canonical


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
        opts = _loc_options(q, lang)
        idx = q.get("answer_index", 0)
        if 0 <= idx < len(opts):
            return opts[idx]
        canonical = q.get("options") or []
        return canonical[idx] if 0 <= idx < len(canonical) else None
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
        c["situation_count"] = await db.situations.count_documents({"category": c["slug"], "active": True})
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
            "employment_status": None,
        },
        "onboarding_completed": False,
        # Existing progress (must never be reset).
        "flashcard_interactions": [],
        "completed_lessons": [],
        "saved_emergency_phrase_ids": [],
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
    if payload.employment_status is not None and payload.employment_status not in EMPLOYMENT_STATUSES:
        invalid.append("employment_status")
    if invalid:
        raise HTTPException(status_code=422, detail=f"Invalid values for: {', '.join(invalid)}")

    profile = {
        "role": payload.role,
        "venue_type": payload.venue_type,
        "target_country": payload.target_country,
        "goal": payload.goal,
        "english_level": payload.english_level,
        "employment_status": payload.employment_status,
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
    # Legacy guests without the field are treated as an empty saved list.
    guest.setdefault("saved_emergency_phrase_ids", [])
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

    lang = await _guest_language(attempt["guest_id"])
    return {"correct": correct, "feedback": _loc_field(q, "explanation", lang), "assessment_dimension": dim}


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
    return await _compute_situation_stats(guest_id)


async def _compute_situation_stats(guest_id):
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


# ---------- Recommendations (Phase 2: onboarding with real consequences) ----------
def _rec_score(sit, profile, stats, weak_skills):
    """Deterministic, interpretable ranking score for a situation given a guest profile.

    Weight tiers are banded so each criterion dominates the next, in the required order:
    role > progress > weaknesses > goal/employment > venue > english level.
    Never hides content (every active situation is still scored & reachable via catalog).
    """
    role = profile.get("role")
    venue = profile.get("venue_type")
    goal = profile.get("goal")
    emp = profile.get("employment_status")
    level = profile.get("english_level")
    sit_skills = set(sit.get("skills") or [])
    primary = sit.get("primary_skill")
    difficulty = sit.get("difficulty") or 1
    score = 0.0
    reasons = []

    # 1) Role: the strongest signal.
    if role and role in (sit.get("roles") or []):
        score += 1000.0
        reasons.append("role")

    # 2) Progress: surface what is not completed yet; demote mastered.
    status = stats.get(sit["slug"], {}).get("status", "not_started")
    score += {"not_started": 200.0, "in_progress": 120.0, "completed": 40.0, "mastered": 0.0}.get(status, 200.0)
    if status in ("not_started", "in_progress"):
        reasons.append("new")

    # 3) Weaknesses from the mistake bank.
    if primary and primary in weak_skills:
        score += 80.0
        reasons.append("weakness")
    elif sit_skills & weak_skills:
        score += 40.0
        reasons.append("weakness")

    # 4) Goal + employment status bias practice focus (never a hard filter).
    focus = set()
    if goal == "prepare_for_interview" or emp == "interview_soon" or goal == "improve_guest_communication":
        focus |= REC_COMMUNICATION_SKILLS
    if emp == "starting_new_job":
        focus |= REC_PRACTICAL_SKILLS
    if emp == "already_working" or goal == "improve_current_job":
        score += difficulty * 15.0  # bias towards more advanced service situations
    if emp == "looking_for_job" or goal == "first_hospitality_job":
        focus |= REC_PRACTICAL_SKILLS
        score += max(0, 3 - difficulty) * 15.0  # bias towards fundamentals
    if focus and (primary in focus or (sit_skills & focus)):
        score += 60.0
        reasons.append("goal")

    # 5) Venue: match when metadata exists; empty venue_types stays neutral.
    vt = sit.get("venue_types") or []
    if venue and vt and venue in vt:
        score += 30.0
        reasons.append("venue")

    # 6) English level: prefer situations near the guest's level.
    if level and sit.get("level"):
        want, have = LEVEL_ORDER.get(level), LEVEL_ORDER.get(sit.get("level"))
        if want and have:
            score += max(0.0, 20.0 - abs(want - have) * 10.0)

    return score, reasons


async def _rank_situations_for_guest(guest, stats=None):
    """Deterministic ranking of all active situations for a guest (shared by
    Recommended for you and Tonight's Shift). Returns a list sorted best-first:
    [(score, order, situation, reasons)]."""
    guest_id = guest["id"]
    profile = guest.get("professional_profile") or {}
    situations = await db.situations.find({"active": True}, {"_id": 0}).to_list(500)
    if stats is None:
        stats = await _compute_situation_stats(guest_id)
    review = await db.review_items.find({"guest_id": guest_id}, {"_id": 0, "primary_skill": 1}).to_list(2000)
    weak_skills = {it.get("primary_skill") for it in review if it.get("primary_skill")}
    weak_skills |= {s for s in (guest.get("assessment_weak_skills") or []) if s}

    scored = []
    for s in situations:
        sc, reasons = _rec_score(s, profile, stats, weak_skills)
        scored.append((sc, s.get("order") or 0, s, reasons))
    scored.sort(key=lambda x: (-x[0], x[1]))
    return scored


@api_router.get("/guests/{guest_id}/recommended-situations")
async def recommended_situations(guest_id: str, limit: int = Query(5, ge=1, le=10)):
    """~3-5 situations ranked for this guest. Deterministic and localized.
    The full catalog always stays reachable; this is personalization only."""
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    stats = await _compute_situation_stats(guest_id)
    scored = await _rank_situations_for_guest(guest, stats)

    # Explicit contract: always between 3 and 5 recommendations.
    n = min(5, max(3, limit))
    out = []
    for sc, _order, s, reasons in scored[:n]:
        out.append({
            "slug": s["slug"],
            "title": _loc_field(s, "title", lang) or s.get("title_en"),
            "description": _loc_field(s, "description", lang),
            "category": s.get("category"),
            "primary_skill": s.get("primary_skill"),
            "level": s.get("level"),
            "roles": s.get("roles") or [],
            "status": stats.get(s["slug"], {}).get("status", "not_started"),
            "score": round(sc, 1),
            "reasons": reasons,
        })
    return out


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


# ---------- "Can I Work in English?" Assessment ----------
def _assessment_public_q(q, lang):
    """Localized, answer-free question for the client. Options honour the pack's
    per-question localization policy (preserve_english_target_verbatim keeps the 4
    English options; translate_from_es uses localized_options). answer_index/order
    are never exposed or changed."""
    tr = q.get("translations") or {}

    def loc(field):
        if isinstance(tr.get(lang), dict) and tr[lang].get(field) is not None:
            return tr[lang][field]
        if isinstance(tr.get("es"), dict):
            return tr["es"].get(field)
        return None

    out = {"id": q["id"], "type": q["type"], "area": q["area"], "prompt": loc("prompt")}
    if q["type"] == "multiple_choice":
        lo = q.get("localized_options") or {}
        out["options"] = lo.get(lang) or q.get("options") or []
    elif q["type"] == "fill_gap":
        out["sentence"] = q.get("sentence_en")
    elif q["type"] == "word_ordering":
        out["words"] = q.get("words", [])
    return out


def _score_assessment(role, responses):
    """Score EXACTLY per the pack's scoring block. Returns area_scores, overall,
    weak_areas (lowest 2), weak_skills (up to 3), strong_areas (top 2), incorrect ids."""
    qs = assessment.questions_for_role(role)
    latest = {}
    for r in responses:
        latest[r["question_id"]] = r  # push order: later submissions win

    order = assessment.AREA_ORDER
    correct_in = {k: 0 for k in order}
    total_in = {k: 0 for k in order}
    incorrect_ids = []
    last_incorrect_at = {k: "" for k in order}

    for q in qs:
        area = q["area"]
        total_in[area] += 1
        r = latest.get(q["id"])
        ok = bool(r and _check_answer(q, r.get("submitted_answer")))
        if ok:
            correct_in[area] += 1
        else:
            incorrect_ids.append(q["id"])
            at = (r or {}).get("answered_at", "")
            if at > last_incorrect_at[area]:
                last_incorrect_at[area] = at

    area_scores = {k: (round(100 * correct_in[k] / total_in[k]) if total_in[k] else 0) for k in order}
    overall = round(sum(area_scores[k] * assessment.AREA_WEIGHT[k] for k in order))

    # Weak areas: lowest 2 scores; ties → more recent incorrect, then fixed order.
    ranked = list(order)                                       # fixed order (stable base)
    ranked.sort(key=lambda k: last_incorrect_at[k], reverse=True)
    ranked.sort(key=lambda k: area_scores[k])
    weak_areas = ranked[:2]

    # Strong areas: top 2 scores; fixed order as tie-break.
    strong = list(order)
    strong.sort(key=lambda k: area_scores[k], reverse=True)
    strong_areas = strong[:2]

    # Weak skills: count primary_skill/skills on incorrect answers inside weak areas.
    counts = {}
    first_seen = {}
    seq = 0
    weak_set = set(weak_areas)
    incorrect_set = set(incorrect_ids)
    for q in qs:
        if q["area"] in weak_set and q["id"] in incorrect_set:
            for sk in [q.get("primary_skill")] + (q.get("skills") or []):
                if not sk:
                    continue
                counts[sk] = counts.get(sk, 0) + 1
                if sk not in first_seen:
                    first_seen[sk] = seq
                    seq += 1
    weak_skills = [s for s, _c in sorted(counts.items(), key=lambda kv: (-kv[1], first_seen[kv[0]]))][:3]

    return {
        "area_scores": area_scores,
        "overall": overall,
        "weak_areas": weak_areas,
        "strong_areas": strong_areas,
        "weak_skills": weak_skills,
        "incorrect_ids": incorrect_ids,
    }


def _assessment_result_payload(attempt, baseline_score, current_score):
    band = assessment.result_band(attempt.get("overall_score", 0))
    return {
        "attempt_id": attempt["id"],
        "role": attempt["role"],
        "overall_score": attempt.get("overall_score", 0),
        "area_scores": attempt.get("area_scores", {}),
        "band_key": band["key"],
        "weak_areas": attempt.get("weak_areas", []),
        "strong_areas": attempt.get("strong_areas", []),
        "weak_skills": attempt.get("weak_skills", []),
        "incorrect_question_ids": attempt.get("incorrect_question_ids", []),
        "is_baseline": attempt.get("is_baseline", False),
        "baseline_score": baseline_score,
        "current_score": current_score,
    }


@api_router.get("/assessment/meta")
async def assessment_meta():
    """Static assessment metadata (not mandatory). UI strings, areas, bands — all
    localized client-side from the per-language maps."""
    return {
        "mandatory": False,
        "estimated_minutes": assessment.ESTIMATED_MINUTES,
        "questions_per_role": assessment.QUESTIONS_PER_ROLE,
        "supported_languages": assessment.SUPPORTED_LANGUAGES,
        "ui": assessment.UI,
        "areas": assessment.AREAS,
        "result_bands": assessment.RESULT_BANDS,
    }


@api_router.post("/assessment/start")
async def assessment_start(payload: AssessmentStart):
    guest = await db.guests.find_one({"id": payload.guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    role = (guest.get("professional_profile") or {}).get("role")
    if role not in ("bartender", "waiter"):
        raise HTTPException(status_code=400, detail="Assessment requires a role (bartender or waiter)")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    qs = assessment.questions_for_role(role)

    existing = await db.assessment_attempts.find_one(
        {"guest_id": payload.guest_id, "status": "in_progress"}, {"_id": 0}
    )
    if existing:
        attempt_id = existing["id"]
        role = existing["role"]
        qs = assessment.questions_for_role(role)
    else:
        attempt = {
            "id": str(uuid.uuid4()),
            "guest_id": payload.guest_id,
            "role": role,
            "status": "in_progress",
            "started_at": now_iso(),
            "completed_at": None,
            "responses": [],
        }
        await db.assessment_attempts.insert_one(dict(attempt))
        attempt_id = attempt["id"]

    return {
        "attempt_id": attempt_id,
        "role": role,
        "total": len(qs),
        "questions": [_assessment_public_q(q, lang) for q in qs],
    }


@api_router.put("/assessment-attempts/{attempt_id}/response")
async def assessment_response(attempt_id: str, payload: AssessmentResponse):
    attempt = await db.assessment_attempts.find_one({"id": attempt_id})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    if attempt["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="Attempt is not in progress")
    q = assessment.QUESTIONS_BY_ID.get(payload.question_id)
    if not q or q.get("role") != attempt["role"]:
        raise HTTPException(status_code=422, detail="Question does not belong to this assessment")

    resp = {
        "question_id": payload.question_id,
        "submitted_answer": payload.submitted_answer,
        "answered_at": now_iso(),
    }
    await db.assessment_attempts.update_one(
        {"id": attempt_id}, {"$pull": {"responses": {"question_id": payload.question_id}}}
    )
    await db.assessment_attempts.update_one(
        {"id": attempt_id}, {"$push": {"responses": resp}}
    )
    updated = await db.assessment_attempts.find_one({"id": attempt_id}, {"_id": 0, "responses": 1})
    return {"ok": True, "answered": len(updated.get("responses", []))}


@api_router.post("/assessment-attempts/{attempt_id}/complete")
async def assessment_complete(attempt_id: str):
    attempt = await db.assessment_attempts.find_one({"id": attempt_id}, {"_id": 0})
    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt not found")
    guest_id = attempt["guest_id"]

    if attempt["status"] != "completed":
        prior_completed = await db.assessment_attempts.count_documents(
            {"guest_id": guest_id, "status": "completed"}
        )
        is_baseline = prior_completed == 0
        scores = _score_assessment(attempt["role"], attempt.get("responses", []))
        await db.assessment_attempts.update_one(
            {"id": attempt_id},
            {"$set": {
                "status": "completed",
                "completed_at": now_iso(),
                "overall_score": scores["overall"],
                "area_scores": scores["area_scores"],
                "incorrect_question_ids": scores["incorrect_ids"],
                "weak_areas": scores["weak_areas"],
                "strong_areas": scores["strong_areas"],
                "weak_skills": scores["weak_skills"],
                "is_baseline": is_baseline,
            }},
        )
        # Profile summary (baseline set once; current updated every completion).
        guest_set = {
            "assessment_current_score": scores["overall"],
            "assessment_last_completed_at": now_iso(),
            "assessment_weak_areas": scores["weak_areas"],
            "assessment_weak_skills": scores["weak_skills"],
        }
        if is_baseline:
            guest_set["assessment_baseline_score"] = scores["overall"]
        await db.guests.update_one({"id": guest_id}, {"$set": guest_set})
        attempt = await db.assessment_attempts.find_one({"id": attempt_id}, {"_id": 0})

    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0}) or {}
    return _assessment_result_payload(
        attempt,
        baseline_score=guest.get("assessment_baseline_score"),
        current_score=guest.get("assessment_current_score"),
    )


@api_router.get("/guests/{guest_id}/assessment-summary")
async def assessment_summary(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    latest = await db.assessment_attempts.find_one(
        {"guest_id": guest_id, "status": "completed"}, {"_id": 0}, sort=[("completed_at", -1)]
    )
    return {
        "has_assessment": guest.get("assessment_baseline_score") is not None,
        "baseline_score": guest.get("assessment_baseline_score"),
        "current_score": guest.get("assessment_current_score"),
        "last_completed_at": guest.get("assessment_last_completed_at"),
        "weak_areas": guest.get("assessment_weak_areas", []),
        "weak_skills": guest.get("assessment_weak_skills", []),
        "latest": latest,
    }


# ---------- Emergency Phrases ----------
@api_router.get("/emergency")
async def emergency_pack():
    """Full Emergency Phrases pack (static). phrase_en is the English target and is
    served verbatim; meaning/use_note keep their per-language maps so the client can
    localize and search without a round-trip."""
    return {
        "ui": emergency.UI,
        "categories": emergency.CATEGORY_LIST,
        "phrases": emergency.PHRASES,
        "content_count": emergency.CONTENT_COUNT,
        "categories_count": emergency.CATEGORIES_COUNT,
    }


@api_router.get("/guests/{guest_id}/saved-phrases")
async def list_saved_phrases(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0, "saved_emergency_phrase_ids": 1})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    return {"saved_emergency_phrase_ids": guest.get("saved_emergency_phrase_ids", [])}


@api_router.post("/guests/{guest_id}/saved-phrases")
async def add_saved_phrase(guest_id: str, payload: SavedPhrase):
    if payload.phrase_id not in emergency.PHRASE_IDS:
        raise HTTPException(status_code=422, detail="Unknown phrase_id")
    result = await db.guests.update_one(
        {"id": guest_id}, {"$addToSet": {"saved_emergency_phrase_ids": payload.phrase_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0, "saved_emergency_phrase_ids": 1})
    return {"saved_emergency_phrase_ids": guest.get("saved_emergency_phrase_ids", [])}


@api_router.delete("/guests/{guest_id}/saved-phrases/{phrase_id}")
async def remove_saved_phrase(guest_id: str, phrase_id: str):
    result = await db.guests.update_one(
        {"id": guest_id}, {"$pull": {"saved_emergency_phrase_ids": phrase_id}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0, "saved_emergency_phrase_ids": 1})
    return {"saved_emergency_phrase_ids": guest.get("saved_emergency_phrase_ids", [])}


# ---------- Tonight's Shift (daily 5-question practice) ----------
LOCAL_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_STATUS_RANK = {"not_started": 0, "in_progress": 1, "completed": 2, "mastered": 3}


def _item_matches_skill(item, skill):
    return bool(skill) and (item["primary_skill"] == skill or skill in (item.get("skills") or []))


def _pick_item(ordered, state):
    """Pick the first candidate honouring dedupe rules: never duplicate item_id;
    prefer a distinct situation and at most 2 of the same exercise type, relaxing
    those soft preferences only if needed to fill the slot."""
    avail = [c for c in ordered if c["item_id"] not in state["used_ids"]]
    if not avail:
        return None

    def ok(c, strict_sit, strict_type):
        if strict_sit and c["situation_slug"] in state["used_slugs"]:
            return False
        if strict_type and state["type_counts"].get(c["type"], 0) >= 2:
            return False
        return True

    for strict_sit, strict_type in ((True, True), (False, True), (True, False), (False, False)):
        for c in avail:
            if ok(c, strict_sit, strict_type):
                return c
    return avail[0]


async def _select_shift_items(guest, local_date):
    """Implements algorithm.slot_order exactly. Deterministic, no runtime AI/random.
    Reads review_items (due) for selection but never writes them."""
    guest_id = guest["id"]
    profile = guest.get("professional_profile") or {}
    role = profile.get("role")
    venue = profile.get("venue_type")
    level = profile.get("english_level")
    weak = [s for s in (guest.get("assessment_weak_skills") or []) if s]

    lessons = await db.lessons.find({}, {"_id": 0}).to_list(1000)
    sits = {s["slug"]: s for s in await db.situations.find({"active": True}, {"_id": 0}).to_list(500)}
    all_items = []
    for l in lessons:
        slug = l["situation_slug"]
        sit = sits.get(slug)
        if not sit:
            continue
        for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
            for q in l.get(key, []):
                if q.get("type") not in shift.SUPPORTED_ITEM_TYPES:
                    continue
                all_items.append({
                    "item_id": q["id"], "situation_slug": slug, "source_section": section,
                    "type": q["type"], "primary_skill": sit.get("primary_skill"),
                    "skills": sit.get("skills") or [], "roles": sit.get("roles") or [],
                    "venue_types": sit.get("venue_types") or [], "level": sit.get("level"),
                    "difficulty": sit.get("difficulty") or 1, "order": sit.get("order") or 0,
                })
    pool = [i for i in all_items if (not role or role in i["roles"])] or all_items

    def tb(i):
        return int(hashlib.sha256(f"{guest_id}|{local_date}|{i['item_id']}".encode()).hexdigest(), 16)

    stats = await _compute_situation_stats(guest_id)

    def incomplete_rank(i):
        return _STATUS_RANK.get(stats.get(i["situation_slug"], {}).get("status", "not_started"), 0)

    now = now_iso()
    due = await db.review_items.find(
        {"guest_id": guest_id, "next_review_at": {"$lte": now}}, {"_id": 0}
    ).sort("next_review_at", 1).to_list(500)
    pool_by_id = {i["item_id"]: i for i in pool}
    due_items = [pool_by_id[r["source_id"]] for r in due if r.get("source_id") in pool_by_id]

    scored = await _rank_situations_for_guest(guest, stats)
    rec_slugs = [s["slug"] for _sc, _o, s, _r in scored[:5]]
    rec_pos = {slug: i for i, slug in enumerate(rec_slugs)}

    hist = await db.review_items.find({"guest_id": guest_id}, {"_id": 0}).to_list(2000)
    hist_counts = {}
    for h in hist:
        sk = h.get("primary_skill")
        if sk:
            hist_counts[sk] = hist_counts.get(sk, 0) + (h.get("times_wrong") or 1)
    hist_skills = [s for s, _c in sorted(hist_counts.items(), key=lambda kv: (-kv[1], kv[0]))]

    want_lvl = LEVEL_ORDER.get(level) if level else None

    def by_skill(skill):
        c = [i for i in pool if _item_matches_skill(i, skill)]
        c.sort(key=lambda i: (incomplete_rank(i), tb(i)))
        return c

    def recommended_incomplete():
        c = [i for i in pool if i["situation_slug"] in rec_pos]
        c.sort(key=lambda i: (rec_pos.get(i["situation_slug"], 99), incomplete_rank(i), tb(i)))
        return c

    def venue_relevant():
        c = [i for i in pool if venue and i["venue_types"] and venue in i["venue_types"]]
        c.sort(key=lambda i: (incomplete_rank(i), tb(i)))
        return c

    def variety():
        c = list(pool)

        def lvl(i):
            have = LEVEL_ORDER.get(i["level"])
            return abs(want_lvl - have) if (want_lvl and have) else 0
        c.sort(key=lambda i: (incomplete_rank(i), lvl(i), tb(i)))
        return c

    chosen = []
    state = {"used_ids": set(), "used_slugs": set(), "type_counts": {}}

    def commit(item, reason):
        chosen.append((item, reason))
        state["used_ids"].add(item["item_id"])
        state["used_slugs"].add(item["situation_slug"])
        state["type_counts"][item["type"]] = state["type_counts"].get(item["type"], 0) + 1

    def take(candidate_lists, reason):
        for cands in candidate_lists:
            p = _pick_item(cands, state)
            if p:
                commit(p, reason)
                return True
        return False

    # Slot 1: earliest due review; fallbacks assessment_weak_skill_1 → recommended → variety.
    take([
        due_items,
        by_skill(weak[0]) if weak else [],
        recommended_incomplete(),
        variety(),
    ], "due_review")

    # Slot 2: assessment weakness #1; fallbacks historical weak → recommended → variety.
    take([
        by_skill(weak[0]) if weak else [],
        by_skill(hist_skills[0]) if hist_skills else [],
        recommended_incomplete(),
        variety(),
    ], "assessment_weakness")

    # Slot 3: next distinct weak skill (assessment first, then mistake evidence).
    used_skills = {it["primary_skill"] for it, r in chosen if r == "assessment_weakness"}
    distinct = [s for s in weak if s not in used_skills] + \
               [s for s in hist_skills if s not in used_skills and s not in weak]
    picked = False
    for sk in distinct:
        if _pick_item(by_skill(sk), state):
            picked = take([by_skill(sk)], "assessment_weakness")
            break
    if not picked:
        take([recommended_incomplete(), variety()], "assessment_weakness")

    # Slot 4: from Recommended for you; fallbacks venue_relevant → variety.
    take([recommended_incomplete(), venue_relevant(), variety()], "recommended")

    # Slot 5: variety; fallback any role-compatible.
    take([variety(), list(pool)], "variety")

    # Guarantee exactly SESSION_SIZE items (fill from the full catalogue if needed).
    if len(chosen) < shift.SESSION_SIZE:
        for i in sorted(all_items, key=lambda x: tb(x)):
            if len(chosen) >= shift.SESSION_SIZE:
                break
            if i["item_id"] not in state["used_ids"]:
                commit(i, "variety")

    return [{
        "item_id": it["item_id"], "situation_slug": it["situation_slug"],
        "source_section": it["source_section"], "selection_reason": reason,
        "primary_skill": it["primary_skill"], "skills": it["skills"],
    } for it, reason in chosen[:shift.SESSION_SIZE]]


async def _shift_resolve_questions(item_refs):
    """Map each item_ref to its canonical lesson question dict."""
    slugs = list({r["situation_slug"] for r in item_refs})
    lessons = await db.lessons.find({"situation_slug": {"$in": slugs}}, {"_id": 0}).to_list(1000)
    by_id = {}
    for l in lessons:
        for key in ("exercises", "quiz"):
            for q in l.get(key, []):
                by_id[q["id"]] = q
    return by_id


async def _shift_session_payload(session, lang):
    by_id = await _shift_resolve_questions(session["item_refs"])
    items = []
    answered = {r["item_id"]: r for r in session.get("responses", [])}
    for ref in session["item_refs"]:
        q = by_id.get(ref["item_id"])
        if not q:
            continue
        pub = _public_question(q, lang)
        pub["situation_slug"] = ref["situation_slug"]
        pub["selection_reason"] = ref["selection_reason"]
        pub["answered"] = ref["item_id"] in answered
        items.append(pub)
    return {
        "session_id": session["id"],
        "status": session["status"],
        "local_date": session["local_date"],
        "role": session["role"],
        "total": len(session["item_refs"]),
        "items": items,
        "answered_count": len(answered),
        "correct_count": session.get("correct_count"),
        "focus_skill": session.get("focus_skill"),
    }


@api_router.post("/guests/{guest_id}/tonights-shift/start")
async def tonights_shift_start(guest_id: str, payload: ShiftStart):
    if not LOCAL_DATE_RE.match(payload.local_date or ""):
        raise HTTPException(status_code=422, detail="local_date must be YYYY-MM-DD")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    role = (guest.get("professional_profile") or {}).get("role") or "none"
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)

    key = {"guest_id": guest_id, "local_date": payload.local_date, "role": role}
    existing = await db.shift_sessions.find_one(key, {"_id": 0})
    if existing:
        # Resume in-progress or return the read-only completed session for today.
        return await _shift_session_payload(existing, lang)

    item_refs = await _select_shift_items(guest, payload.local_date)
    session = {
        "id": str(uuid.uuid4()),
        "guest_id": guest_id,
        "local_date": payload.local_date,
        "role": role,
        "status": "in_progress",
        "started_at": now_iso(),
        "completed_at": None,
        "item_refs": item_refs,
        "responses": [],
        "correct_count": None,
        "focus_skill": None,
        "content_version": shift.CONTENT_VERSION,
    }
    await db.shift_sessions.insert_one(dict(session))
    return await _shift_session_payload(session, lang)


@api_router.get("/guests/{guest_id}/tonights-shift")
async def tonights_shift_today(guest_id: str, local_date: str = Query(...), role: str = Query(None)):
    if not LOCAL_DATE_RE.match(local_date or ""):
        raise HTTPException(status_code=422, detail="local_date must be YYYY-MM-DD")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    r = role or (guest.get("professional_profile") or {}).get("role") or "none"
    session = await db.shift_sessions.find_one(
        {"guest_id": guest_id, "local_date": local_date, "role": r}, {"_id": 0}
    )
    if not session:
        return {"exists": False}
    payload = await _shift_session_payload(session, lang)
    payload["exists"] = True
    return payload


@api_router.put("/shift-sessions/{session_id}/response")
async def tonights_shift_response(session_id: str, payload: ShiftResponse):
    session = await db.shift_sessions.find_one({"id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="Session is not in progress")
    ref = next((r for r in session["item_refs"] if r["item_id"] == payload.item_id), None)
    if not ref:
        raise HTTPException(status_code=422, detail="Item does not belong to this session")

    by_id = await _shift_resolve_questions([ref])
    q = by_id.get(payload.item_id)
    if not q:
        raise HTTPException(status_code=422, detail="Item content not found")
    correct = _check_answer(q, payload.submitted_answer)
    response = {
        "item_id": payload.item_id,
        "situation_slug": ref["situation_slug"],
        "primary_skill": ref.get("primary_skill"),
        "submitted_answer": payload.submitted_answer,
        "correct": correct,
        "answered_at": now_iso(),
    }
    # Replace any prior answer for this item (no SRS / mastery / attempts writes).
    await db.shift_sessions.update_one(
        {"id": session_id}, {"$pull": {"responses": {"item_id": payload.item_id}}}
    )
    await db.shift_sessions.update_one(
        {"id": session_id}, {"$push": {"responses": response}}
    )
    lang = session.get("role") and await _guest_language(session["guest_id"])
    return {
        "correct": correct,
        "feedback": _loc_field(q, "explanation", lang or DEFAULT_LANGUAGE),
        "correct_answer": _correct_answer_text(q, lang or DEFAULT_LANGUAGE),
    }


@api_router.post("/shift-sessions/{session_id}/complete")
async def tonights_shift_complete(session_id: str):
    session = await db.shift_sessions.find_one({"id": session_id}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session["status"] != "completed":
        latest = {}
        for r in session.get("responses", []):
            latest[r["item_id"]] = r
        order = [ref["item_id"] for ref in session["item_refs"]]
        correct_count = sum(1 for r in latest.values() if r.get("correct"))

        # focus_skill: skill with the most incorrect answers; ties use slot order.
        err_counts = {}
        err_order = {}
        for pos, iid in enumerate(order):
            r = latest.get(iid)
            if r and not r.get("correct"):
                sk = r.get("primary_skill")
                if sk:
                    err_counts[sk] = err_counts.get(sk, 0) + 1
                    err_order.setdefault(sk, pos)
        focus_skill = None
        if err_counts:
            focus_skill = sorted(err_counts.items(), key=lambda kv: (-kv[1], err_order[kv[0]]))[0][0]
        else:
            guest = await db.guests.find_one({"id": session["guest_id"]}, {"_id": 0}) or {}
            cw = [s for s in (guest.get("assessment_weak_skills") or []) if s]
            focus_skill = cw[0] if cw else None

        await db.shift_sessions.update_one(
            {"id": session_id},
            {"$set": {
                "status": "completed",
                "completed_at": now_iso(),
                "correct_count": correct_count,
                "focus_skill": focus_skill,
            }},
        )
        session = await db.shift_sessions.find_one({"id": session_id}, {"_id": 0})

    lang = await _guest_language(session["guest_id"])
    payload = await _shift_session_payload(session, lang)
    payload["total"] = shift.SESSION_SIZE
    return payload


@api_router.get("/tonights-shift/meta")
async def tonights_shift_meta():
    return {"ui": shift.UI, "session_size": shift.SESSION_SIZE, "languages": shift.INTERFACE_LANGUAGES}


# ---------- Job Interview English ----------
async def _job_interview_progress(guest_id, role):
    return await db.job_interview_progress.find_one(
        {"guest_id": guest_id, "role": role}, {"_id": 0}
    )


def _job_interview_payload(guest, lang):
    role = (guest.get("professional_profile") or {}).get("role")
    needs_role = role not in jobint.ROLES
    scenarios = [jobint.public_scenario(s, lang, role) for s in jobint.SCENARIOS]
    return role, needs_role, scenarios


@api_router.get("/job-interview/meta")
async def job_interview_meta():
    return {"ui": jobint.UI, "scenario_count": jobint.SCENARIO_COUNT, "languages": jobint.INTERFACE_LANGUAGES}


@api_router.get("/guests/{guest_id}/job-interview")
async def job_interview_get(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    role, needs_role, scenarios = _job_interview_payload(guest, lang)

    progress = None
    if not needs_role:
        progress = await _job_interview_progress(guest_id, role)
        if not progress:
            # Lazily start progress on first open (resume-friendly, upsert-safe).
            progress = {
                "guest_id": guest_id, "role": role,
                "completed_scenario_ids": [], "last_opened_scenario_id": None,
                "practice_answers": {}, "practice_correct_count": 0,
                "started_at": now_iso(), "completed_at": None, "updated_at": now_iso(),
                "content_version": jobint.CONTENT_VERSION,
            }
            await db.job_interview_progress.update_one(
                {"guest_id": guest_id, "role": role}, {"$setOnInsert": progress}, upsert=True
            )
            progress = await _job_interview_progress(guest_id, role)
    return {
        "role": role,
        "needs_role": needs_role,
        "scenario_count": jobint.SCENARIO_COUNT,
        "scenarios": scenarios,
        "progress": progress,
    }


@api_router.put("/guests/{guest_id}/job-interview/open")
async def job_interview_open(guest_id: str, payload: JobInterviewOpen):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    role = (guest.get("professional_profile") or {}).get("role")
    if role not in jobint.ROLES:
        raise HTTPException(status_code=400, detail="Job Interview requires a role")
    if payload.scenario_id not in jobint.SCENARIO_BY_ID:
        raise HTTPException(status_code=422, detail="Unknown scenario_id")
    await db.job_interview_progress.update_one(
        {"guest_id": guest_id, "role": role},
        {"$set": {"last_opened_scenario_id": payload.scenario_id, "updated_at": now_iso()},
         "$setOnInsert": {
             "guest_id": guest_id, "role": role, "completed_scenario_ids": [],
             "practice_answers": {}, "practice_correct_count": 0,
             "started_at": now_iso(), "completed_at": None,
             "content_version": jobint.CONTENT_VERSION,
         }},
        upsert=True,
    )
    return await _job_interview_progress(guest_id, role)


@api_router.post("/guests/{guest_id}/job-interview/practice")
async def job_interview_practice(guest_id: str, payload: JobInterviewPractice):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    role = (guest.get("professional_profile") or {}).get("role")
    if role not in jobint.ROLES:
        raise HTTPException(status_code=400, detail="Job Interview requires a role")
    scenario = jobint.SCENARIO_BY_ID.get(payload.scenario_id)
    if not scenario:
        raise HTTPException(status_code=422, detail="Unknown scenario_id")

    correct_index = scenario["practice"]["answer_index"]
    correct = payload.answer_index == correct_index

    progress = await _job_interview_progress(guest_id, role) or {
        "guest_id": guest_id, "role": role, "completed_scenario_ids": [],
        "last_opened_scenario_id": None, "practice_answers": {}, "practice_correct_count": 0,
        "started_at": now_iso(), "completed_at": None, "content_version": jobint.CONTENT_VERSION,
    }
    answers = dict(progress.get("practice_answers") or {})
    answers[payload.scenario_id] = {"answer_index": payload.answer_index, "correct": correct}
    correct_count = sum(1 for a in answers.values() if a.get("correct"))
    completed_ids = list(dict.fromkeys((progress.get("completed_scenario_ids") or []) + [payload.scenario_id]))
    completed_at = progress.get("completed_at")
    if len(completed_ids) >= jobint.SCENARIO_COUNT and not completed_at:
        completed_at = now_iso()

    await db.job_interview_progress.update_one(
        {"guest_id": guest_id, "role": role},
        {"$set": {
            "practice_answers": answers,
            "practice_correct_count": correct_count,
            "completed_scenario_ids": completed_ids,
            "last_opened_scenario_id": payload.scenario_id,
            "completed_at": completed_at,
            "updated_at": now_iso(),
        },
         "$setOnInsert": {
             "guest_id": guest_id, "role": role,
             "started_at": progress.get("started_at") or now_iso(),
             "content_version": jobint.CONTENT_VERSION,
         }},
        upsert=True,
    )
    return {
        "correct": correct,
        "correct_index": correct_index,
        "progress": await _job_interview_progress(guest_id, role),
    }


# ---------- First Week at Work ----------
async def _first_week_progress(guest_id, role):
    return await db.first_week_progress.find_one({"guest_id": guest_id, "role": role}, {"_id": 0})


@api_router.get("/first-week/meta")
async def first_week_meta():
    return {"ui": firstweek.UI, "scenario_count": firstweek.SCENARIO_COUNT, "languages": firstweek.INTERFACE_LANGUAGES}


@api_router.get("/guests/{guest_id}/first-week")
async def first_week_get(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    role = (guest.get("professional_profile") or {}).get("role")
    needs_role = role not in firstweek.ROLES  # shared content still available
    key_role = role if role in firstweek.ROLES else "none"
    scenarios = [firstweek.public_scenario(s, lang, role) for s in firstweek.SCENARIOS]

    progress = await _first_week_progress(guest_id, key_role)
    if not progress:
        progress = {
            "guest_id": guest_id, "role": key_role,
            "completed_scenario_ids": [], "last_opened_scenario_id": None,
            "practice_answers": {}, "practice_correct_count": 0,
            "started_at": now_iso(), "completed_at": None, "updated_at": now_iso(),
            "content_version": firstweek.CONTENT_VERSION,
        }
        await db.first_week_progress.update_one(
            {"guest_id": guest_id, "role": key_role}, {"$setOnInsert": progress}, upsert=True
        )
        progress = await _first_week_progress(guest_id, key_role)
    return {
        "role": role,
        "needs_role": needs_role,
        "scenario_count": firstweek.SCENARIO_COUNT,
        "scenarios": scenarios,
        "progress": progress,
    }


@api_router.put("/guests/{guest_id}/first-week/open")
async def first_week_open(guest_id: str, payload: JobInterviewOpen):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    if payload.scenario_id not in firstweek.SCENARIO_BY_ID:
        raise HTTPException(status_code=422, detail="Unknown scenario_id")
    role = (guest.get("professional_profile") or {}).get("role")
    key_role = role if role in firstweek.ROLES else "none"
    await db.first_week_progress.update_one(
        {"guest_id": guest_id, "role": key_role},
        {"$set": {"last_opened_scenario_id": payload.scenario_id, "updated_at": now_iso()},
         "$setOnInsert": {
             "guest_id": guest_id, "role": key_role, "completed_scenario_ids": [],
             "practice_answers": {}, "practice_correct_count": 0,
             "started_at": now_iso(), "completed_at": None,
             "content_version": firstweek.CONTENT_VERSION,
         }},
        upsert=True,
    )
    return await _first_week_progress(guest_id, key_role)


@api_router.post("/guests/{guest_id}/first-week/practice")
async def first_week_practice(guest_id: str, payload: JobInterviewPractice):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    scenario = firstweek.SCENARIO_BY_ID.get(payload.scenario_id)
    if not scenario:
        raise HTTPException(status_code=422, detail="Unknown scenario_id")
    role = (guest.get("professional_profile") or {}).get("role")
    key_role = role if role in firstweek.ROLES else "none"

    correct_index = scenario["practice"]["answer_index"]
    correct = payload.answer_index == correct_index

    progress = await _first_week_progress(guest_id, key_role) or {
        "guest_id": guest_id, "role": key_role, "completed_scenario_ids": [],
        "last_opened_scenario_id": None, "practice_answers": {}, "practice_correct_count": 0,
        "started_at": now_iso(), "completed_at": None, "content_version": firstweek.CONTENT_VERSION,
    }
    answers = dict(progress.get("practice_answers") or {})
    answers[payload.scenario_id] = {"answer_index": payload.answer_index, "correct": correct}
    correct_count = sum(1 for a in answers.values() if a.get("correct"))
    completed_ids = list(dict.fromkeys((progress.get("completed_scenario_ids") or []) + [payload.scenario_id]))
    completed_at = progress.get("completed_at")
    if len(completed_ids) >= firstweek.SCENARIO_COUNT and not completed_at:
        completed_at = now_iso()

    await db.first_week_progress.update_one(
        {"guest_id": guest_id, "role": key_role},
        {"$set": {
            "practice_answers": answers,
            "practice_correct_count": correct_count,
            "completed_scenario_ids": completed_ids,
            "last_opened_scenario_id": payload.scenario_id,
            "completed_at": completed_at,
            "updated_at": now_iso(),
        },
         "$setOnInsert": {
             "guest_id": guest_id, "role": key_role,
             "started_at": progress.get("started_at") or now_iso(),
             "content_version": firstweek.CONTENT_VERSION,
         }},
        upsert=True,
    )
    return {
        "correct": correct,
        "correct_index": correct_index,
        "progress": await _first_week_progress(guest_id, key_role),
    }


# ---------- Listening MVP (WorkEnglish-compatible, vertical = hospitality) ----------
async def _situation_titles(slugs, lang):
    """Map of {slug: localized situation title} for option labels."""
    docs = await db.situations.find(
        {"slug": {"$in": list(slugs)}}, {"_id": 0, "slug": 1, "title_en": 1, "translations": 1, "title": 1}
    ).to_list(1000)
    out = {}
    for d in docs:
        out[d["slug"]] = _loc_field(d, "title", lang) or d.get("title_en") or d["slug"]
    return out


async def _listening_item_public(item, lang):
    titles = await _situation_titles(item["option_situation_slugs"], lang)
    return listening.public_item(item, lang, titles)


async def _rank_listening_items_for_guest(guest):
    """Deterministic ranking of the 50 (hospitality) listening items for a guest.

    Priority: not-yet-correct in listening > situation relevance (role/progress/
    weakness/goal via the shared ranker) > role match > voice_profile soft signal.
    """
    guest_id = guest["id"]
    profile = guest.get("professional_profile") or {}
    role = profile.get("role")
    target_country = profile.get("target_country")

    # Situation relevance score (reuses the shared, deterministic ranker).
    scored = await _rank_situations_for_guest(guest)
    sit_score = {s["slug"]: sc for sc, _o, s, _r in scored}
    sit_order = {s["slug"]: (s.get("order") or 0) for _sc, _o, s, _r in scored}

    # Prior listening performance per item.
    attempts = await db.listening_attempts.find(
        {"guest_id": guest_id}, {"_id": 0, "listening_item_id": 1, "correct": 1}
    ).to_list(5000)
    correct_ids = {a["listening_item_id"] for a in attempts if a.get("correct")}
    attempted_ids = {a["listening_item_id"] for a in attempts}

    country_profile = {
        "ireland": "irish_clear", "uk": "british_clear", "united_kingdom": "british_clear",
        "usa": "american_clear", "united_states": "american_clear",
    }.get((target_country or "").lower())

    ranked = []
    for item in listening.ITEMS:
        slug = item["situation_slug"]
        score = sit_score.get(slug, 0.0)
        if item["id"] not in correct_ids:
            score += 500.0  # prefer not-yet-correct
        if item["id"] not in attempted_ids:
            score += 100.0  # slight preference for brand-new items
        if role and item["role"] == role:
            score += 400.0
        if country_profile and item["voice_profile"] == country_profile:
            score += 20.0  # soft signal only; never blocks
        ranked.append((score, sit_order.get(slug, 0), item))
    ranked.sort(key=lambda x: (-x[0], x[1]))
    return [it for _s, _o, it in ranked]


@api_router.get("/listening/meta")
async def listening_meta():
    return {
        "ui": listening.UI,
        "item_count": listening.ITEM_COUNT,
        "languages": listening.INTERFACE_LANGUAGES,
        "profession_id": listening.PROFESSION_ID,
        "session_size": listening.SESSION_SIZE,
    }


@api_router.get("/listening/item/{situation_slug}")
async def listening_item(situation_slug: str, lang: str = Query(DEFAULT_LANGUAGE)):
    item = listening.ITEM_BY_SLUG.get(situation_slug)
    if not item:
        raise HTTPException(status_code=404, detail="No listening item for this situation")
    if lang not in SUPPORTED_LANG_CODES:
        lang = DEFAULT_LANGUAGE
    return await _listening_item_public(item, lang)


@api_router.get("/guests/{guest_id}/listening-practice")
async def listening_practice(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    ranked = await _rank_listening_items_for_guest(guest)
    chosen = ranked[: listening.SESSION_SIZE]
    items = [await _listening_item_public(it, lang) for it in chosen]
    return {"session_size": listening.SESSION_SIZE, "profession_id": listening.PROFESSION_ID, "items": items}


@api_router.post("/guests/{guest_id}/listening-attempts")
async def listening_attempt(guest_id: str, payload: ListeningAnswer):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    item = listening.ITEM_BY_ID.get(payload.listening_item_id)
    if not item:
        raise HTTPException(status_code=422, detail="Unknown listening_item_id")

    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    correct = payload.selected_index == item["answer_index"]
    attempt = {
        "id": str(uuid.uuid4()),
        "guest_id": guest_id,
        "profession_id": listening.PROFESSION_ID,  # hospitality in V1
        "listening_item_id": item["id"],
        "situation_slug": item["situation_slug"],
        "selected_index": payload.selected_index,
        "correct": correct,
        "attempted_at": now_iso(),
        "interface_language": lang,
    }
    await db.listening_attempts.insert_one(dict(attempt))

    # Maintain summary counters on the guest (recomputed to avoid drift).
    attempted_count = await db.listening_attempts.count_documents({"guest_id": guest_id})
    correct_count = await db.listening_attempts.count_documents({"guest_id": guest_id, "correct": True})
    await db.guests.update_one(
        {"id": guest_id},
        {"$set": {"listening_attempted_count": attempted_count, "listening_correct_count": correct_count}},
    )

    return {
        "correct": correct,
        "correct_index": item["answer_index"],
        "correct_slug": item["situation_slug"],
        "reveal": listening.reveal_payload(item, lang),
        "summary": {"attempted": attempted_count, "correct": correct_count},
    }


@api_router.get("/guests/{guest_id}/listening-summary")
async def listening_summary(guest_id: str):
    attempted = await db.listening_attempts.count_documents({"guest_id": guest_id})
    correct = await db.listening_attempts.count_documents({"guest_id": guest_id, "correct": True})
    return {"attempted": attempted, "correct": correct, "item_count": listening.ITEM_COUNT}



# ---------- Speaking MVP (WorkEnglish-compatible, vertical = hospitality) ----------
async def _rank_speaking_items_for_guest(guest):
    """Deterministic ranking of the 50 (hospitality) speaking items for a guest.
    Priority: previous needs_practice/partial/missed > situation relevance (shared
    ranker: role/progress/weakness/goal) > role match."""
    guest_id = guest["id"]
    profile = guest.get("professional_profile") or {}
    role = profile.get("role")

    scored = await _rank_situations_for_guest(guest)
    sit_score = {s["slug"]: sc for sc, _o, s, _r in scored}
    sit_order = {s["slug"]: (s.get("order") or 0) for _sc, _o, s, _r in scored}

    attempts = await db.speaking_attempts.find(
        {"guest_id": guest_id}, {"_id": 0, "speaking_item_id": 1, "overall": 1}
    ).to_list(5000)
    # latest overall per item (attempts are chronological by insertion)
    latest = {}
    for a in attempts:
        latest[a["speaking_item_id"]] = a.get("overall")
    attempted_ids = set(latest.keys())

    ranked = []
    for item in speaking.ITEMS:
        slug = item["situation_slug"]
        score = sit_score.get(slug, 0.0)
        ov = latest.get(item["id"])
        if ov in ("needs_practice", None):  # not-yet-strong / never tried
            score += 500.0
        if item["id"] not in attempted_ids:
            score += 100.0
        if role and item["role"] == role:
            score += 400.0
        ranked.append((score, sit_order.get(slug, 0), item))
    ranked.sort(key=lambda x: (-x[0], x[1]))
    return [it for _s, _o, it in ranked]


@api_router.get("/speaking/meta")
async def speaking_meta():
    return {
        "ui": speaking.UI,
        "item_count": speaking.ITEM_COUNT,
        "languages": speaking.INTERFACE_LANGUAGES,
        "profession_id": speaking.PROFESSION_ID,
        "session_size": speaking.SESSION_SIZE,
    }


@api_router.get("/speaking/item/{situation_slug}")
async def speaking_item(situation_slug: str, lang: str = Query(DEFAULT_LANGUAGE)):
    item = speaking.ITEM_BY_SLUG.get(situation_slug)
    if not item:
        raise HTTPException(status_code=404, detail="No speaking item for this situation")
    if lang not in SUPPORTED_LANG_CODES:
        lang = DEFAULT_LANGUAGE
    return speaking.public_item(item, lang)


@api_router.get("/guests/{guest_id}/speaking-practice")
async def speaking_practice(guest_id: str):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    ranked = await _rank_speaking_items_for_guest(guest)
    items = [speaking.public_item(it, lang) for it in ranked[: speaking.SESSION_SIZE]]
    return {"session_size": speaking.SESSION_SIZE, "profession_id": speaking.PROFESSION_ID, "items": items}


@api_router.get("/guests/{guest_id}/speaking-summary")
async def speaking_summary(guest_id: str):
    attempted = await db.speaking_attempts.count_documents({"guest_id": guest_id})
    strong = await db.speaking_attempts.count_documents({"guest_id": guest_id, "overall": "strong"})
    return {"attempted": attempted, "strong": strong, "item_count": speaking.ITEM_COUNT}


@api_router.post("/guests/{guest_id}/speaking-attempts")
async def speaking_attempt(
    guest_id: str,
    speaking_item_id: str = Form(...),
    duration_ms: int = Form(0),
    audio: UploadFile = File(...),
):
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")
    item = speaking.ITEM_BY_ID.get(speaking_item_id)
    if not item:
        raise HTTPException(status_code=422, detail="Unknown speaking_item_id")

    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Empty audio")

    # 1) STT (ElevenLabs Scribe v2) — raw audio is only held in memory, never stored.
    try:
        stt = stt_elevenlabs.transcribe(audio_bytes, filename=audio.filename or "audio.webm")
    except Exception as e:
        logger.error(f"STT failed: {e}")
        raise HTTPException(status_code=502, detail="Transcription failed")
    del audio_bytes  # drop raw audio immediately after transcription

    user_transcript = stt["text"]

    # 2) Evaluation (OpenAI structured output) — backend only.
    try:
        ev = await speaking_evaluator.evaluate(
            profession_id=item["profession_id"],
            role=item["role"],
            situation_slug=item["situation_slug"],
            prompt_transcript_en=item["prompt_transcript_en"],
            model_response_en=item["model_response_en"],
            user_transcript=user_transcript,
        )
    except Exception as e:
        logger.error(f"Speaking evaluation failed: {e}")
        raise HTTPException(status_code=502, detail="Evaluation failed")

    lang = guest.get("interface_language", DEFAULT_LANGUAGE)
    attempt = {
        "id": str(uuid.uuid4()),
        "guest_id": guest_id,
        "profession_id": speaking.PROFESSION_ID,  # hospitality in V1
        "speaking_item_id": item["id"],
        "situation_slug": item["situation_slug"],
        "role": item["role"],
        "transcript_en": user_transcript,
        "stt_language_probability": stt.get("language_probability"),
        "stt_avg_logprob": stt.get("avg_logprob"),
        "understandable": ev["understandable"],
        "situation_handled": ev["situation_handled"],
        "professional_service_english": ev["professional_service_english"],
        "grammar_vocabulary": ev["grammar_vocabulary"],
        "naturalness": ev["naturalness"],
        "issue_codes": ev["issue_codes"],
        "improved_response_en": ev["improved_response_en"],
        "overall": ev["overall"],
        "attempted_at": now_iso(),
        "interface_language": lang,
        "duration_ms": duration_ms,
    }
    await db.speaking_attempts.insert_one(dict(attempt))  # raw audio NOT persisted

    attempted_count = await db.speaking_attempts.count_documents({"guest_id": guest_id})
    strong_count = await db.speaking_attempts.count_documents({"guest_id": guest_id, "overall": "strong"})
    await db.guests.update_one(
        {"id": guest_id},
        {"$set": {"speaking_attempted_count": attempted_count, "speaking_strong_count": strong_count}},
    )

    return {
        "transcript_en": user_transcript,
        "understandable": ev["understandable"],
        "situation_handled": ev["situation_handled"],
        "professional_service_english": ev["professional_service_english"],
        "grammar_vocabulary": ev["grammar_vocabulary"],
        "naturalness": ev["naturalness"],
        "issue_codes": ev["issue_codes"],
        "improved_response_en": ev["improved_response_en"],
        "overall": ev["overall"],
        "model_response_en": item["model_response_en"],
        "summary": {"attempted": attempted_count, "strong": strong_count},
    }



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
    await seed_pack_v2.seed_pack_v2(db)
    await seed_i18n.apply_i18n_bundle(db)
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
        await db.assessment_attempts.create_index("guest_id")
        await db.assessment_attempts.create_index([("guest_id", 1), ("status", 1)])
        await db.assessment_attempts.create_index([("guest_id", 1), ("completed_at", -1)])
        await db.shift_sessions.create_index(
            [("guest_id", 1), ("local_date", 1), ("role", 1)], unique=True
        )
        await db.job_interview_progress.create_index(
            [("guest_id", 1), ("role", 1)], unique=True
        )
        await db.first_week_progress.create_index(
            [("guest_id", 1), ("role", 1)], unique=True
        )
        await db.listening_attempts.create_index("guest_id")
        await db.listening_attempts.create_index([("guest_id", 1), ("listening_item_id", 1)])
        await db.listening_attempts.create_index([("guest_id", 1), ("correct", 1)])
        await db.speaking_attempts.create_index("guest_id")
        await db.speaking_attempts.create_index([("guest_id", 1), ("speaking_item_id", 1)])
        await db.speaking_attempts.create_index([("guest_id", 1), ("overall", 1)])
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")
    logger.info("Content + reference data seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
