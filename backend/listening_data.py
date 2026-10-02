"""
Listening MVP loader (WorkEnglish-compatible, vertical = HospitalityEnglish).

data/listening.json is the single read-only source of truth for the 50 listening
items, their translations, UI strings and audio mapping. Content is static, so
nothing is seeded and nothing duplicates on restart. Only listening attempts are
persisted (collection listening_attempts).

The English target (transcript_en / model_response_en) is NEVER translated or
rewritten. answer_index is NEVER exposed to the client before an answer.
"""
import json
from pathlib import Path

_PATH = Path(__file__).parent / "data" / "listening.json"

with open(_PATH, encoding="utf-8") as _f:
    PACK = json.load(_f)

UI = PACK["ui_translations"]
ITEMS = PACK["items"]
ITEM_BY_ID = {it["id"]: it for it in ITEMS}
ITEM_BY_SLUG = {it["situation_slug"]: it for it in ITEMS}
ITEM_COUNT = PACK.get("item_count", len(ITEMS))
INTERFACE_LANGUAGES = PACK.get("interface_languages", [])
CONTENT_VERSION = str(PACK.get("version", 1))
PROFESSION_ID = PACK.get("profession_id", "hospitality")
VOICE_PROFILES = PACK.get("voice_profiles", {})
SESSION_SIZE = (PACK.get("listening_practice") or {}).get("session_size", 5)

# Directory where the 50 pre-generated MP3s live. Served statically by the
# frontend (public/listening/<slug>.mp3); never synthesized at runtime.
AUDIO_DIR = Path(__file__).parent.parent / "frontend" / "public" / "listening"


def loc(m, lang, default="es"):
    if not isinstance(m, dict):
        return m
    return m.get(lang) or m.get(default)


def audio_url(item):
    # audio_asset_key is like "listening/<slug>.mp3"; served from frontend root.
    return "/" + item["audio_asset_key"]


def public_item(item, lang, option_titles):
    """Answer-free localized payload for an item.

    option_titles: {situation_slug: localized_title} for the item's three options.
    answer_index, transcript and model_response are intentionally omitted here.
    """
    options = [
        {"slug": slug, "label": option_titles.get(slug) or slug}
        for slug in item["option_situation_slugs"]
    ]
    return {
        "id": item["id"],
        "situation_slug": item["situation_slug"],
        "role": item["role"],
        "profession_id": item["profession_id"],
        "voice_profile": item["voice_profile"],
        "prompt": loc(UI["listen_prompt"], lang),
        "audio_url": audio_url(item),
        "options": options,
    }


def reveal_payload(item, lang):
    """Post-answer reveal. English targets served verbatim; translations localized."""
    return {
        "transcript_en": item["transcript_en"],
        "transcript_translation": (item.get("transcript_translations") or {}).get(lang),
        "model_response_en": item["model_response_en"],
        "model_response_translation": (item.get("model_response_translations") or {}).get(lang),
    }
