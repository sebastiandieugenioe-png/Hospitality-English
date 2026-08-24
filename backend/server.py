from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone

import seed_content
import seed_reference

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
    workplace: Optional[str] = None
    goal: Optional[str] = None
    # Forward-looking optional fields for the professional-profile evolution.
    role: Optional[str] = None
    venue_type: Optional[str] = None
    country: Optional[str] = None


class ProfileUpdate(BaseModel):
    role: Optional[str] = None
    venue_type: Optional[str] = None
    country: Optional[str] = None
    skills: Optional[List[str]] = None


class FlashcardInteraction(BaseModel):
    learning_item_id: str
    knew: bool


class LessonCompletion(BaseModel):
    situation_slug: str
    score: int
    total: int


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
async def get_skills():
    return await db.skills.find({}, {"_id": 0}).to_list(100)


# ---------- Guest / progress endpoints ----------
@api_router.post("/guests")
async def create_guest(payload: GuestCreate):
    guest = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "onboarding": {"workplace": payload.workplace, "goal": payload.goal},
        # Forward-looking professional profile (additive; empty until set).
        "professional_profile": {
            "role": payload.role,
            "venue_type": payload.venue_type,
            "country": payload.country,
            "skills": [],
        },
        "flashcard_interactions": [],
        "completed_lessons": [],
        # Placeholders for the conversation-training roadmap (not yet used by any feature):
        "situation_attempts": [],
        "mistake_bank": [],
        "srs": {},
    }
    await db.guests.insert_one(dict(guest))
    guest.pop("_id", None)
    return guest


@api_router.put("/guests/{guest_id}/profile")
async def update_profile(guest_id: str, payload: ProfileUpdate):
    updates = {f"professional_profile.{k}": v for k, v in payload.model_dump(exclude_none=True).items()}
    if not updates:
        raise HTTPException(status_code=422, detail="No profile fields provided")
    result = await db.guests.update_one({"id": guest_id}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")
    guest = await db.guests.find_one({"id": guest_id}, {"_id": 0})
    return guest


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
    # Forward-looking indexes (safe / additive).
    try:
        await db.guests.create_index("id")
        await db.categories.create_index("slug")
        await db.situations.create_index("slug")
        await db.situations.create_index("category")
        await db.learning_items.create_index("id")
        await db.learning_items.create_index("situation_slug")
    except Exception as e:
        logger.warning(f"Index creation skipped: {e}")
    logger.info("Content + reference data seeded.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
