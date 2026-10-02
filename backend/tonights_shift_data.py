"""
"Tonight's Shift" MVP spec loader.

The JSON file (data/tonights_shift.json) is the single source of truth for the
selection algorithm parameters, scoring, persistence shape, API contract and UI
translations. Loaded read-only at import time. No new learning content is created:
sessions reference existing stable lesson/quiz item ids.
"""
import json
from pathlib import Path

_SPEC_PATH = Path(__file__).parent / "data" / "tonights_shift.json"

with open(_SPEC_PATH, encoding="utf-8") as _f:
    SPEC = json.load(_f)

UI = SPEC["ui_translations"]
ALGORITHM = SPEC["algorithm"]
SESSION_SIZE = ALGORITHM.get("session_size", 5)
SUPPORTED_ITEM_TYPES = ALGORITHM.get("supported_item_types", [])
INTERFACE_LANGUAGES = SPEC.get("interface_languages", [])
CONTENT_VERSION = str(SPEC.get("version", 1))
