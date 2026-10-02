"""
"Emergency Phrases" pack loader.

The JSON file (data/emergency_phrases.json) is the single source of truth for
phrases, translations, categories and metadata. Loaded read-only at import time;
content is static so nothing is seeded and nothing can be duplicated on restart.
Only the guest's saved phrase ids are persisted (on the guest document).
"""
import json
from pathlib import Path

_PACK_PATH = Path(__file__).parent / "data" / "emergency_phrases.json"

with open(_PACK_PATH, encoding="utf-8") as _f:
    PACK = json.load(_f)

UI = PACK["ui_translations"]
CATEGORIES = PACK["categories"]                 # {key: {order, translations}}
PHRASES = PACK["phrases"]                        # list of phrase dicts
CONTENT_COUNT = PACK.get("content_count", len(PHRASES))
CATEGORIES_COUNT = PACK.get("categories_count", len(CATEGORIES))
INTERFACE_LANGUAGES = PACK.get("interface_languages", [])

CATEGORY_LIST = sorted(
    [{"key": k, "order": v.get("order", 0), "translations": v.get("translations", {})} for k, v in CATEGORIES.items()],
    key=lambda c: c["order"],
)
PHRASE_IDS = {p["id"] for p in PHRASES}
