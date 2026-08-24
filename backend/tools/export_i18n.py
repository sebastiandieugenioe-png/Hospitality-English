"""Reproducible, read-only export of the remaining translatable MVP content.

Produces mvp_i18n_export_v1.json. Does NOT modify any code or content, does not
translate, and excludes all user/guest/progress/SRS data.

Exports:
  - the 7 legacy active situations (active AND not part of mvp_content_pack_v1)
    with full situation + lesson + learning_items docs
  - UI i18n translations (es + it) merged as {key: {es, it}}
  - visible hardcoded strings still outside the i18n system (simple scan result)
  - taxonomies (professional_profiles, venue_types, target_countries,
    learning_goals, skills) as-is (include their es/it fields)
  - supported languages config
  - fallback description
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).parent.parent
FRONTEND = BACKEND.parent / "frontend"
PACK_PATH = BACKEND / "data" / "mvp_content_pack_v1.json"
OUT_PATH = BACKEND / "data" / "mvp_i18n_export_v1.json"

env = dotenv_values(str(BACKEND / ".env"))

# Visible strings still hardcoded outside the i18n t() system (simple scan).
HARDCODED_VISIBLE_STRINGS = [
    {"file": "pages/Category.js", "line": 34, "text": "Volver al inicio", "context": "Back-to-home link (Category page)"},
    {"file": "pages/Category.js", "line": 37, "text": "Cargando…", "context": "Loading state text (Category page)"},
    {"file": "pages/Category.js", "line": 38, "text": "No se encontró la categoría.", "context": "Error/empty state text (Category page)"},
    {"file": "pages/Category.js", "line": 87, "text": "Disponible", "context": "Situation available badge (Category page)"},
    {"file": "pages/Category.js", "line": 99, "text": "Pronto", "context": "Situation coming-soon badge (Category page)"},
    {"file": "pages/Lesson.js", "line": 160, "text": "Cerrar lección", "context": "Close-lesson button aria-label"},
    {"file": "pages/Lesson.js", "line": 415, "text": "Voltear tarjeta", "context": "Flip-flashcard button aria-label"},
    {"file": "pages/Lesson.js", "line": 828, "text": "Atrás", "context": "Back button aria-label"},
    {"file": "pages/Onboarding.js", "line": 207, "text": "Back", "context": "Onboarding back button aria-label (English, not localized)"},
]

SUPPORTED_LANGUAGES = [
    {"code": "es", "name": "Spanish", "native_name": "Español", "flag": "🇪🇸", "is_default_fallback": True},
    {"code": "it", "name": "Italian", "native_name": "Italiano", "flag": "🇮🇹", "is_default_fallback": False},
]

FALLBACK = {
    "default_language": "es",
    "resolution_order": ["requested_language", "es (DEFAULT_LANGUAGE)"],
    "description": "Requested language → localized value if present → fallback to Spanish (es). Italian missing for a field falls back to Spanish; English target content is never localized.",
    "helpers": {
        "frontend": [
            "t(key, vars) — UI strings from locales/{es,it}.json (lib/i18n.js)",
            "getLocalizedField(obj, base, lang) — supports translations.<lang>.<base> and <base>_<lang>",
            "getText(translationsMap, lang) — string map translations.<lang>",
            "getLocalizedOptions(q, lang)",
        ],
        "backend": [
            "_loc_field(obj, base, lang) — supports grouped and suffix shapes, silent es fallback",
            "_loc_options(q, lang)",
            "_guest_language(guest)",
        ],
    },
    "field_shapes_supported": [
        "grouped: translations.<lang>.<base>",
        "suffix: <base>_<lang>",
        "string map: translations.<lang> (phrases / dialogue text)",
    ],
}


def _clean(doc):
    if isinstance(doc, dict):
        return {k: _clean(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, list):
        return [_clean(x) for x in doc]
    return doc


def load_ui_translations():
    es = json.load(open(FRONTEND / "src" / "locales" / "es.json", encoding="utf-8"))
    it = json.load(open(FRONTEND / "src" / "locales" / "it.json", encoding="utf-8"))
    keys = sorted(set(es) | set(it))
    return {k: {"es": es.get(k), "it": it.get(k)} for k in keys}


async def main():
    pack_slugs = {s["slug"] for s in json.load(open(PACK_PATH, encoding="utf-8"))["situations"]}

    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]

    # Legacy active situations = active AND not in the imported content pack.
    legacy_situations = []
    async for sit in db.situations.find({"active": True}):
        if sit["slug"] in pack_slugs:
            continue
        slug = sit["slug"]
        lesson = await db.lessons.find_one({"situation_slug": slug})
        items = [_clean(i) async for i in db.learning_items.find({"situation_slug": slug})]
        legacy_situations.append({
            "situation": _clean(sit),
            "lesson": _clean(lesson) if lesson else None,
            "learning_items": items,
        })
    legacy_situations.sort(key=lambda x: x["situation"].get("order", 0))
    legacy_slugs = [x["situation"]["slug"] for x in legacy_situations]

    taxonomies = {}
    for col in ["professional_profiles", "venue_types", "target_countries", "learning_goals", "skills"]:
        taxonomies[col] = [_clean(d) async for d in db[col].find({})]

    ui = load_ui_translations()

    export = {
        "meta": {
            "export_name": "mvp_i18n_export_v1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "source_db": env["DB_NAME"],
            "notes": "Read-only export. Excludes guests/progress/attempts/review_items/SRS. The 13 Content Pack situations are intentionally excluded (already exported in mvp_content_pack_v1).",
            "excluded_pack_slugs": sorted(pack_slugs),
            "counts": {
                "legacy_active_situations": len(legacy_situations),
                "ui_translation_keys": len(ui),
                "hardcoded_visible_strings": len(HARDCODED_VISIBLE_STRINGS),
                "taxonomies": {k: len(v) for k, v in taxonomies.items()},
                "supported_languages": len(SUPPORTED_LANGUAGES),
            },
        },
        "legacy_active_situations_slugs": legacy_slugs,
        "legacy_active_situations": legacy_situations,
        "ui_translations": ui,
        "hardcoded_visible_strings": HARDCODED_VISIBLE_STRINGS,
        "taxonomies": taxonomies,
        "supported_languages": SUPPORTED_LANGUAGES,
        "fallback": FALLBACK,
    }

    OUT_PATH.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUT_PATH)
    print("legacy slugs:", legacy_slugs)
    print("ui keys:", len(ui))
    print("hardcoded:", len(HARDCODED_VISIBLE_STRINGS))
    print("taxonomy counts:", {k: len(v) for k, v in taxonomies.items()})
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
