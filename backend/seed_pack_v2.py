"""
Importer for Hospitality English Content Pack v2 (30 situations).

Reuses the v1 pack transformations (seed_pack) since the v2 situation/lesson shape
is identical. It only adapts structurally; it never rewrites English learning
content, slugs, stable IDs, canonical answers, answer_index, option order,
assessment_dimension, scoring, mastery, attempts, review_items or SRS.

Operations (per situation, matched ONLY by expected_slug):
  - activate_existing_placeholder: the inactive placeholder MUST already exist by
    exact slug; we activate it and replace its content with the pack lesson.
    If the exact slug is missing we DO NOT create anything -> it is reported as a
    blocker (never a duplicate under a different slug).
  - new: (re)inserted idempotently.

Idempotent: seed_content.seed() wipes situations/lessons/learning_items on startup,
then catalog + pack v1 + pack v2 are (re)applied, so a restart never duplicates.
"""
import json
from pathlib import Path

import seed_pack

V2_PATH = Path(__file__).parent / "data" / "hospitality_english_content_v2_emergent_single_file.json"
_ORDER_BASE = 200  # after the v1 pack (100-112)

# User-authorized: this v2 entry is marked activate_existing_placeholder but no
# placeholder exists under its exact slug, so it is imported as a NEW situation
# with that exact slug (the legacy 'handling-a-complaint-bar' stays untouched).
_FORCE_NEW = {"handling-a-complaint"}


def load_v2():
    with open(V2_PATH, encoding="utf-8") as f:
        return json.load(f)


def _docs_for(situation, order):
    slug = situation["expected_slug"]
    s = dict(situation)
    s["slug"] = slug
    s["active"] = True
    s["is_full"] = True
    sit_doc = seed_pack._situation_doc(s, order)
    sit_doc["order"] = _ORDER_BASE + order
    lesson_doc = seed_pack._lesson_doc(slug, situation["lesson"])
    items = seed_pack._learning_items(s, lesson_doc["phrases"])
    return slug, sit_doc, lesson_doc, items


async def seed_pack_v2(db):
    """Apply the 30 v2 situations. Returns the list of blocker slugs (expected
    placeholders that did not exist by exact slug and were therefore skipped)."""
    pack = load_v2()
    blockers = []
    for i, situation in enumerate(pack["content_pack"]["situations"]):
        slug, sit_doc, lesson_doc, items = _docs_for(situation, i)
        op = situation.get("operation")
        if slug in _FORCE_NEW:
            op = "new"

        if op == "activate_existing_placeholder":
            existing = await db.situations.find_one({"slug": slug})
            if not existing:
                blockers.append(slug)
                continue
            await db.situations.replace_one({"slug": slug}, sit_doc)
        else:  # new
            await db.situations.replace_one({"slug": slug}, sit_doc, upsert=True)

        await db.lessons.replace_one({"situation_slug": slug}, lesson_doc, upsert=True)
        await db.learning_items.delete_many({"situation_slug": slug})
        if items:
            await db.learning_items.insert_many(items)

    if blockers:
        print(f"[seed_pack_v2] BLOCKERS - placeholder slug(s) not found, skipped (no duplicate created): {blockers}")
    return blockers
