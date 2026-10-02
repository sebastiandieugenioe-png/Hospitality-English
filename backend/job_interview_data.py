"""
"Job Interview English" MVP loader.

The JSON file (data/job_interview.json) is the single source of truth for scenarios,
translations, the per-scenario practice MC and metadata. Loaded read-only at import
time; content is static so nothing is seeded and nothing duplicates on restart. Only
the guest's progress is persisted (collection job_interview_progress).
"""
import json
from pathlib import Path

_PATH = Path(__file__).parent / "data" / "job_interview.json"

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
    """Localized, answer-free scenario. English targets (question_en, useful_phrases_en,
    model_answer, practice options) are served verbatim; answer_index is never exposed."""
    model = s["model_answer"].get(role) if role in ROLES else None
    return {
        "id": s["id"],
        "order": s["order"],
        "question_en": s["question_en"],
        "roles": s.get("roles", []),
        "interviewer_wants": loc(s["interviewer_wants"], lang),
        "answer_structure": loc(s["answer_structure"], lang),
        "useful_phrases_en": s.get("useful_phrases_en", []),
        "model_answer": model,
        "practice": {
            "type": "multiple_choice",
            "prompt": loc(s["practice"]["prompt"], lang),
            "options": s["practice"]["options_en"],
        },
    }
