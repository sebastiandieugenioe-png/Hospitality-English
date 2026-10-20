"""Reproduction tests for the truncated/compacted MC option translations bug.

Root cause: seed_i18n._set_options compacts a SPARSE option-translation map
(`[m[i] for i in sorted(m)]`), so when the i18n bundle only carries some option
indices, the stored translations[<lang>].options list is shorter and positionally
shifted vs the canonical `options`. Grading uses the CANONICAL answer_index.
"""
import os

import pytest
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/")

SLUG = "guest-arrives-at-the-bar"
# quiz[3] -> canonical 4 options, answer_index=1, translations have 1 option
QID_OUT_OF_RANGE = "q_bar_greet_4"
# quiz[0] -> canonical 4 options, answer_index=0, translations have 2 options (idx 1 and 3)
QID_SHIFTED = "q_bar_greet_1"


@pytest.fixture(scope="module")
def guest():
    r = requests.post(f"{BASE_URL}/api/guests", json={"interface_language": "es"}, timeout=30)
    assert r.status_code in (200, 201), r.text
    gid = r.json()["id"]
    requests.put(
        f"{BASE_URL}/api/guests/{gid}/profile",
        json={"role": "bartender", "venue_type": "pub", "target_country": "ireland",
              "goal": "first_hospitality_job"},
        timeout=30,
    )
    return gid


def _lesson():
    r = requests.get(f"{BASE_URL}/api/lessons/{SLUG}", headers=premium_headers(), timeout=30)
    assert r.status_code == 200
    return r.json()["lesson"]


def _q(qid):
    for q in _lesson()["quiz"]:
        if q["id"] == qid:
            return q
    raise AssertionError(f"{qid} not found")


def test_translated_option_count_matches_canonical():
    """The ES/localized option list must have the same length as the canonical list."""
    q = _q(QID_OUT_OF_RANGE)
    canonical = q["options"]
    es = (q.get("translations") or {}).get("es", {}).get("options")
    assert es is not None
    assert len(es) == len(canonical), (
        f"{QID_OUT_OF_RANGE}: canonical={len(canonical)} options but es={len(es)} -> "
        f"answer_index={q['answer_index']} is unreachable in the UI"
    )


def test_answer_index_in_range_of_localized_options():
    q = _q(QID_OUT_OF_RANGE)
    es = q["translations"]["es"]["options"]
    assert q["answer_index"] < len(es), (
        "answer_index points outside the localized option list -> the question can never be "
        "answered correctly in the UI"
    )


def test_localized_options_are_positionally_aligned():
    """Grading is positional, so localized[i] must be the translation of canonical[i]."""
    q = _q(QID_SHIFTED)
    es = q["translations"]["es"]["options"]
    canonical = q["options"]
    assert len(es) == len(canonical), (
        f"{QID_SHIFTED}: es options {es} vs canonical {canonical} -> option 0 shown to the user "
        f"is the translation of canonical option 1, but answer_index={q['answer_index']} grades "
        f"canonical option 0 as correct"
    )


def test_review_item_answer_endpoint_does_not_crash(guest):
    """POST /review-items/{id}/answer must not 500 when answer_index is out of range
    of the localized option list (_correct_answer_text indexes the localized list)."""
    start = requests.post(
        f"{BASE_URL}/api/situation-attempts/start",
        json={"guest_id": guest, "situation_slug": SLUG}, timeout=30,
    )
    assert start.status_code == 200, start.text
    attempt_id = start.json()["attempt_id"]

    q = _q(QID_OUT_OF_RANGE)
    wrong = 0 if q["answer_index"] != 0 else 1
    resp = requests.put(
        f"{BASE_URL}/api/situation-attempts/{attempt_id}/response",
        json={"question_id": QID_OUT_OF_RANGE, "section": "quiz", "submitted_answer": wrong},
        timeout=30,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["correct"] is False

    items = requests.get(f"{BASE_URL}/api/guests/{guest}/review-items", headers=premium_headers(), timeout=30)
    assert items.status_code == 200, items.text
    target = [i for i in items.json() if i["source_id"] == QID_OUT_OF_RANGE]
    assert len(target) == 1, f"expected exactly 1 review item, got {len(target)}"

    item = target[0]
    # answer non-exposure check
    assert set(item["content"].keys()) <= {"id", "type", "prompt", "options"}, item["content"].keys()

    ans = requests.post(
        f"{BASE_URL}/api/review-items/{item['id']}/answer",
        json={"submitted_answer": 0}, timeout=30,
    )
    assert ans.status_code == 200, (
        f"review-items answer returned {ans.status_code}: {ans.text[:300]}"
    )
