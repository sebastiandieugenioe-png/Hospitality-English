"""
"First Week at Work" MVP loader.

The JSON file (data/first_week.json) is the single source of truth for scenarios,
translations, the per-scenario practice MC and metadata. Loaded read-only at import
time; content is static so nothing is seeded and nothing duplicates on restart. Only
the guest's progress is persisted (collection first_week_progress).
"""
import json
from pathlib import Path

_PATH = Path(__file__).parent / "data" / "first_week.json"

with open(_PATH, encoding="utf-8") as _f:
    PACK = json.load(_f)

UI = PACK["ui_translations"]
SCENARIOS = sorted(PACK["scenarios"], key=lambda s: s.get("order", 0))
SCENARIO_BY_ID = {s["id"]: s for s in SCENARIOS}
SCENARIO_COUNT = PACK.get("scenario_count", len(SCENARIOS))
INTERFACE_LANGUAGES = PACK.get("interface_languages", [])
CONTENT_VERSION = str(PACK.get("version", 1))
ROLES = PACK.get("roles", ["bartender", "waiter"])


def loc(m, lang, default="es"):
    if not isinstance(m, dict):
        return m
    return m.get(lang) or m.get(default)


def public_scenario(s, lang, role):
    """Localized, answer-free scenario. English targets (useful_phrases_en, examples,
    practice options) are served verbatim; answer_index is never exposed. When a
    scenario has example_by_role, the example awaits a valid role (else None)."""
    if "example_by_role" in s:
        example = s["example_by_role"].get(role) if role in ROLES else None
        example_is_role = True
    else:
        example = s.get("example_en")
        example_is_role = False
    return {
        "id": s["id"],
        "order": s["order"],
        "title": loc(s["title"], lang),
        "roles": s.get("roles", []),
        "what_you_need": loc(s["what_you_need"], lang),
        "useful_phrases_en": s.get("useful_phrases_en", []),
        "example": example,
        "example_is_role": example_is_role,
        "practice": {
            "type": "multiple_choice",
            "prompt": loc(s["practice"]["prompt"], lang),
            "options": s["practice"]["options_en"],
        },
    }
