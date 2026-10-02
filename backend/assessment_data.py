"""
"Can I Work in English?" assessment pack loader.

The JSON file (data/can_i_work_assessment.json) is the single source of truth for
content, translations, scoring, metadata and result bands. It is loaded read-only at
import time; questions are static so there is nothing to seed and nothing can be
duplicated on restart. Only guest attempts are persisted (in MongoDB).
"""
import json
from pathlib import Path

_PACK_PATH = Path(__file__).parent / "data" / "can_i_work_assessment.json"

with open(_PACK_PATH, encoding="utf-8") as _f:
    PACK = json.load(_f)

AREAS = PACK["areas"]                                   # [{key, weight, translations}]
AREA_ORDER = [a["key"] for a in AREAS]                  # fixed, authoritative order
AREA_WEIGHT = {a["key"]: a["weight"] for a in AREAS}
SCORING = PACK["scoring"]
RESULT_BANDS = PACK["result_bands"]
UI = PACK["ui_translations"]
QUESTIONS = PACK["questions"]                           # {"bartender": [...], "waiter": [...]}
SUPPORTED_LANGUAGES = PACK["supported_languages"]
QUESTIONS_PER_ROLE = PACK.get("questions_per_role", 15)
ESTIMATED_MINUTES = PACK.get("estimated_minutes")

QUESTIONS_BY_ID = {}
for _role, _qs in QUESTIONS.items():
    for _q in _qs:
        QUESTIONS_BY_ID[_q["id"]] = _q


def questions_for_role(role):
    return QUESTIONS.get(role, [])


def result_band(score):
    for b in RESULT_BANDS:
        if b["min"] <= score <= b["max"]:
            return b
    return RESULT_BANDS[-1]
