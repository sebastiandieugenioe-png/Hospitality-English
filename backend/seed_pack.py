"""
Importer for the approved MVP Content Pack (data/mvp_content_pack_v1.json).

This module ONLY adapts the canonical pack to the schema the app already uses
(situations / lessons / learning_items). It never rewrites, translates or
improves the authored content. Stable ids, slugs, canonical answers,
answer_index, assessment_dimension and content_version are preserved as-is.

Localization stays i18n-ready: pack ships English target + Spanish reference.
Italian is intentionally absent, so IT falls back to ES via the existing
getLocalizedField / _loc_field helpers (frontend + backend).

Seeding is idempotent: seed_content.seed() wipes the content collections on
startup before catalog + pack are (re)inserted, so a restart/reseed never
duplicates situations, lessons or learning_items.
"""

import json
from pathlib import Path

PACK_PATH = Path(__file__).parent / "data" / "mvp_content_pack_v1.json"

# venue_type_targets (semantic labels) -> existing venue_types taxonomy ids.
VENUE_TARGET_TO_ID = {
    "cocktail bar": "cocktail-bar",
    "pub": "pub",
    "hotel 4-5 star": "hotel-restaurant",
    "casual restaurant": "casual-restaurant",
    "fine dining": "fine-dining",
}

# Role -> primary content category (mirrors the existing catalog convention).
CATEGORY_BY_ROLE = {"bartender": "bar", "waiter": "restaurant"}

# Dialogue speaker -> Spanish label used by the current Lesson.js renderer.
SPEAKER_LABELS = {
    "customer": "Cliente",
    "guest": "Cliente",
    "bartender": "Bartender",
    "waiter": "Camarero/a",
}

# Order offset so imported situations appear after the hand-authored ones.
_ORDER_BASE = 100


def _map_venues(targets):
    return [VENUE_TARGET_TO_ID[t] for t in targets]


def _phrase(p):
    """Adapt a pack phrase to the learning-item/phrase shape the frontend renders.

    - text_en                -> english_content (direct render)
    - translations.es.text   -> translations.es (string map, read by getText)
    - translations.es.<note> -> <note>_es suffix (read by ServiceNote/getLocalizedField)
    - natural_alternatives_en -> natural_alternatives
    """
    tr_es = (p.get("translations") or {}).get("es") or {}
    item = {
        "id": p["id"],
        "english_content": p["text_en"],
        "translations": {"es": tr_es.get("text")},
    }
    for src, dst in (("service_note", "service_note_es"),
                     ("common_mistake", "common_mistake_es"),
                     ("context", "context_es")):
        if tr_es.get(src) is not None:
            item[dst] = tr_es[src]
    for k in ("service_register", "service_rating"):
        if p.get(k) is not None:
            item[k] = p[k]
    if p.get("natural_alternatives_en"):
        item["natural_alternatives"] = p["natural_alternatives_en"]
    return item


def _dialogue(line):
    tr_es = (line.get("translations") or {}).get("es") or {}
    return {
        "speaker": line["speaker"],
        "speaker_label_es": SPEAKER_LABELS.get(line["speaker"], "Cliente"),
        "english": line["text_en"],
        "spanish": tr_es.get("text"),
    }


def _question(q):
    """Keep the pack question intact (grouped translations.es.{prompt,explanation},
    options, answer/answer_index/words, assessment_dimension). Only rename the
    fill_gap field name to the one the renderer/backend expect."""
    out = dict(q)
    if "sentence_en" in out:
        out["sentence"] = out.pop("sentence_en")
    return out


def _situation_doc(s, order):
    return {
        "slug": s["slug"],
        "category": CATEGORY_BY_ROLE.get(s["roles"][0], "general"),
        "title": s["title_en"],
        "title_en": s["title_en"],
        "translations": s.get("translations", {}),
        "roles": s["roles"],
        "primary_skill": s["primary_skill"],
        "skills": s["skills"],
        "venue_types": _map_venues(s.get("venue_type_targets", [])),
        "level": s["level"],
        "difficulty": s["difficulty"],
        "estimated_minutes": s["estimated_minutes"],
        "service_registers": s.get("service_registers", []),
        "country_variants": [],
        "order": _ORDER_BASE + order,
        "active": s.get("active", True),
        "is_full": s.get("is_full", True),
    }


def _lesson_doc(slug, les):
    return {
        "situation_slug": slug,
        "content_version": les.get("content_version", 1),
        "intro": dict(les["intro"]),
        "phrases": [_phrase(p) for p in les["phrases"]],
        "dialogue": [_dialogue(d) for d in les["dialogue"]],
        "exercises": [_question(q) for q in les["exercises"]],
        "quiz": [_question(q) for q in les["quiz"]],
    }


def _learning_items(s, phrases):
    category = CATEGORY_BY_ROLE.get(s["roles"][0], "general")
    items = []
    for phrase in phrases:
        item = {
            "id": phrase["id"],
            "category_slug": category,
            "situation_slug": s["slug"],
            "type": "phrase",
            "difficulty": s["level"],
            "english_content": phrase["english_content"],
            "translations": phrase["translations"],
            "skills": s["skills"],
            "country_variants": {},
        }
        for k in ("service_register", "service_rating", "service_note_es",
                  "context_es", "natural_alternatives", "common_mistake_es"):
            if k in phrase:
                item[k] = phrase[k]
        items.append(item)
    return items


def load_pack():
    with open(PACK_PATH, encoding="utf-8") as f:
        return json.load(f)


async def seed_pack(db):
    """Insert the pack situations, lessons and learning items into the existing
    collections. Relies on seed_content.seed() having cleared them first."""
    pack = load_pack()
    situations, lessons, learning_items = [], [], []
    for i, s in enumerate(pack["situations"]):
        situations.append(_situation_doc(s, i))
        phrases = _lesson_doc(s["slug"], s["lesson"])["phrases"]
        lessons.append(_lesson_doc(s["slug"], s["lesson"]))
        learning_items.extend(_learning_items(s, phrases))

    if situations:
        await db.situations.insert_many(situations)
    for lesson in lessons:
        await db.lessons.insert_one(dict(lesson))
    if learning_items:
        await db.learning_items.insert_many(learning_items)
