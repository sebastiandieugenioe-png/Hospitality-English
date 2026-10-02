"""
Speaking MVP loader (WorkEnglish-compatible, vertical = HospitalityEnglish).

data/speaking.json is the single read-only source of truth for the 50 speaking
items. Each item reuses the Listening prompt audio (prompt_audio_asset_key). The
English target (prompt_transcript_en / model_response_en) is NEVER rewritten.
Only evaluation results persist (collection speaking_attempts); raw audio is never
stored.
"""
import json
from pathlib import Path

_PATH = Path(__file__).parent / "data" / "speaking.json"

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
SESSION_SIZE = (PACK.get("speaking_practice") or {}).get("session_size", 5)
EVAL_CFG = PACK.get("evaluation", {})
STT_CFG = PACK.get("stt", {})


def loc(m, lang, default="es"):
    if not isinstance(m, dict):
        return m
    return m.get(lang) or m.get(default)


def public_item(item, lang):
    """Item payload for recording. No model_response is exposed here (revealed in
    the result). The prompt audio is the Listening clip; the prompt transcript +
    its translation are shown so the learner understands what was said."""
    return {
        "id": item["id"],
        "situation_slug": item["situation_slug"],
        "role": item["role"],
        "profession_id": item["profession_id"],
        "audio_url": "/" + item["prompt_audio_asset_key"],
        "prompt_transcript_en": item["prompt_transcript_en"],
        "prompt_translation": (item.get("prompt_translations") or {}).get(lang),
        "recording": item.get("recording", {"max_seconds": 30, "min_seconds": 1}),
    }
