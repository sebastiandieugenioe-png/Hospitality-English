"""Backend tests for First Week at Work feature + light regression checks."""
import os
import json
import uuid
import pytest
import requests
from pathlib import Path

def _load_backend_url():
    url = os.environ.get("REACT_APP_BACKEND_URL", "").strip()
    if not url:
        env_path = Path("/app/frontend/.env")
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("REACT_APP_BACKEND_URL="):
                    url = line.split("=", 1)[1].strip()
                    break
    assert url, "REACT_APP_BACKEND_URL not set"
    return url.rstrip("/")


BASE_URL = _load_backend_url()
API = f"{BASE_URL}/api"

DATA = json.loads((Path(__file__).resolve().parents[1] / "data" / "first_week.json").read_text(encoding="utf-8"))
SCENARIOS = DATA["scenarios"]
SCENARIO_IDS = [s["id"] for s in SCENARIOS]
ANSWERS = {s["id"]: s["practice"]["answer_index"] for s in SCENARIOS}


@pytest.fixture
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def make_guest(s, role=None, employment_status=None, goal=None, lang="en"):
    r = s.post(f"{API}/guests", json={"interface_language": lang})
    assert r.status_code in (200, 201), r.text
    gid = r.json()["id"]
    pr = s.put(f"{API}/guests/{gid}/profile", json={"venue_type": "pub", "target_country": "ireland",
                                                     "role": role or "bartender",
                                                     "employment_status": employment_status or "already_working",
                                                     "goal": goal or "improve_current_job"})
    assert pr.status_code == 200, pr.text
    return gid


# ---------- Meta ----------
def test_meta_has_10_scenarios_and_10_langs(s):
    r = s.get(f"{API}/first-week/meta")
    assert r.status_code == 200
    d = r.json()
    assert d["scenario_count"] == 10
    assert set(d["languages"]) == {"es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"}
    for key in ("title", "situation", "what_you_need", "useful_phrases", "example", "practice", "progress"):
        assert key in d["ui"]
        assert len(d["ui"][key]) == 10


# ---------- GET returns 10 scenarios, hides answer_index ----------
def test_get_first_week_structure(s):
    gid = make_guest(s, role="bartender", lang="es")
    r = s.get(f"{API}/guests/{gid}/first-week")
    assert r.status_code == 200
    d = r.json()
    assert d["scenario_count"] == 10
    assert len(d["scenarios"]) == 10
    ids = [sc["id"] for sc in d["scenarios"]]
    assert len(set(ids)) == 10
    assert ids == SCENARIO_IDS  # ordered by `order`
    # answer_index must not leak
    for sc in d["scenarios"]:
        assert "answer_index" not in sc["practice"]
        assert len(sc["practice"]["options"]) == 3
    # progress doc
    p = d["progress"]
    assert p["completed_scenario_ids"] == []
    assert p["practice_correct_count"] == 0


# ---------- Localization + English fields invariance ----------
def test_localization_and_english_targets_invariant(s):
    gid = make_guest(s, role="waiter", lang="es")
    es = s.get(f"{API}/guests/{gid}/first-week").json()
    # localized vs English
    sc_es = es["scenarios"][0]
    assert sc_es["title"] == SCENARIOS[0]["title"]["es"]
    assert sc_es["what_you_need"] == SCENARIOS[0]["what_you_need"]["es"]
    assert sc_es["practice"]["prompt"] == SCENARIOS[0]["practice"]["prompt"]["es"]
    # English targets
    assert sc_es["useful_phrases_en"] == SCENARIOS[0]["useful_phrases_en"]
    assert sc_es["practice"]["options"] == SCENARIOS[0]["practice"]["options_en"]

    # change language
    rr = s.put(f"{API}/guests/{gid}/language", json={"interface_language": "fr"})
    assert rr.status_code == 200
    fr = s.get(f"{API}/guests/{gid}/first-week").json()
    sc_fr = fr["scenarios"][0]
    assert sc_fr["title"] == SCENARIOS[0]["title"]["fr"]
    assert sc_fr["practice"]["prompt"] == SCENARIOS[0]["practice"]["prompt"]["fr"]
    # English fields unchanged
    assert sc_fr["useful_phrases_en"] == sc_es["useful_phrases_en"]
    assert sc_fr["practice"]["options"] == sc_es["practice"]["options"]

    # all 10 languages have localized title/prompt/what_you_need
    for lang in ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]:
        s.put(f"{API}/guests/{gid}/language", json={"interface_language": lang})
        d = s.get(f"{API}/guests/{gid}/first-week").json()
        sc = d["scenarios"][0]
        assert sc["title"] == SCENARIOS[0]["title"][lang], lang
        assert sc["what_you_need"] == SCENARIOS[0]["what_you_need"][lang], lang
        assert sc["practice"]["prompt"] == SCENARIOS[0]["practice"]["prompt"][lang], lang


# ---------- example_by_role fw_08 ----------
def test_example_by_role_bartender_vs_waiter(s):
    gid_b = make_guest(s, role="bartender")
    gid_w = make_guest(s, role="waiter")
    db = s.get(f"{API}/guests/{gid_b}/first-week").json()
    dw = s.get(f"{API}/guests/{gid_w}/first-week").json()
    fw08_b = next(x for x in db["scenarios"] if x["id"] == "fw_08_learning_products_menu")
    fw08_w = next(x for x in dw["scenarios"] if x["id"] == "fw_08_learning_products_menu")
    src = next(x for x in SCENARIOS if x["id"] == "fw_08_learning_products_menu")
    assert fw08_b["example"] == src["example_by_role"]["bartender"]
    assert fw08_w["example"] == src["example_by_role"]["waiter"]
    assert fw08_b["example"] != fw08_w["example"]


def test_role_missing_example_null_but_example_en_still_shown(s):
    # guest with no role (don't set role)
    r = s.post(f"{API}/guests", json={"interface_language": "en"})
    gid = r.json()["id"]
    d = s.get(f"{API}/guests/{gid}/first-week").json()
    assert d["needs_role"] is True
    fw08 = next(x for x in d["scenarios"] if x["id"] == "fw_08_learning_products_menu")
    assert fw08["example"] is None
    # fw_01 has example_en -> still English example
    fw01 = next(x for x in d["scenarios"] if x["id"] == "fw_01_understanding_instructions")
    src = next(x for x in SCENARIOS if x["id"] == "fw_01_understanding_instructions")
    assert fw01["example"] == src["example_en"]


# ---------- Grading ----------
def test_grading_correct_and_incorrect(s):
    gid = make_guest(s, role="bartender")
    sid = "fw_01_understanding_instructions"
    correct_ix = ANSWERS[sid]
    wrong_ix = (correct_ix + 1) % 3
    r_wrong = s.post(f"{API}/guests/{gid}/first-week/practice", json={"scenario_id": sid, "answer_index": wrong_ix}).json()
    assert r_wrong["correct"] is False
    assert r_wrong["correct_index"] == correct_ix
    # Retake correct — overwrite
    r_right = s.post(f"{API}/guests/{gid}/first-week/practice", json={"scenario_id": sid, "answer_index": correct_ix}).json()
    assert r_right["correct"] is True
    # progress: still in completed list (not duplicated), correct_count == 1
    p = r_right["progress"]
    assert p["completed_scenario_ids"].count(sid) == 1
    assert p["practice_correct_count"] == 1


# ---------- Persistence, completion, resume ----------
def test_full_completion_and_persistence(s):
    gid = make_guest(s, role="waiter")
    for sid in SCENARIO_IDS:
        s.post(f"{API}/guests/{gid}/first-week/practice", json={"scenario_id": sid, "answer_index": ANSWERS[sid]})
    d = s.get(f"{API}/guests/{gid}/first-week").json()
    p = d["progress"]
    assert len(p["completed_scenario_ids"]) == 10
    assert p["practice_correct_count"] == 10
    assert p["completed_at"] is not None


def test_language_change_preserves_progress(s):
    gid = make_guest(s, role="bartender", lang="es")
    sid = SCENARIO_IDS[0]
    s.post(f"{API}/guests/{gid}/first-week/practice", json={"scenario_id": sid, "answer_index": ANSWERS[sid]})
    d1 = s.get(f"{API}/guests/{gid}/first-week").json()
    s.put(f"{API}/guests/{gid}/language", json={"interface_language": "de"})
    d2 = s.get(f"{API}/guests/{gid}/first-week").json()
    assert d2["progress"]["completed_scenario_ids"] == d1["progress"]["completed_scenario_ids"]
    assert d2["progress"]["practice_correct_count"] == d1["progress"]["practice_correct_count"]
    assert [x["id"] for x in d2["scenarios"]] == [x["id"] for x in d1["scenarios"]]


def test_open_updates_last_opened(s):
    gid = make_guest(s, role="bartender")
    sid = "fw_05_shift_swap"
    r = s.put(f"{API}/guests/{gid}/first-week/open", json={"scenario_id": sid})
    assert r.status_code == 200
    assert r.json()["last_opened_scenario_id"] == sid


# ---------- Regression ----------
def test_regression_situations_50_25_25(s):
    r = s.get(f"{API}/situations")
    assert r.status_code == 200
    sits = r.json()
    assert len(sits) == 50
    bartender = sum(1 for sit in sits if "bartender" in (sit.get("roles") or []))
    waiter = sum(1 for sit in sits if "waiter" in (sit.get("roles") or []))
    assert bartender == 25
    assert waiter == 25


def test_regression_assessment_meta(s):
    r = s.get(f"{API}/assessment/meta")
    assert r.status_code == 200
    d = r.json()
    # ensure no CEFR terms leak into disclaimer
    disc = json.dumps(d).lower()
    assert "cefr" not in disc


def test_regression_emergency_32_phrases_8_categories(s):
    r = s.get(f"{API}/emergency")
    assert r.status_code == 200
    d = r.json()
    phrases = d.get("phrases") or []
    cats = d.get("categories") or []
    assert len(phrases) == 32
    assert len(cats) == 8


def test_regression_job_interview_meta_10(s):
    r = s.get(f"{API}/job-interview/meta")
    assert r.status_code == 200
    assert r.json().get("scenario_count") == 10


def test_regression_tonights_shift_meta(s):
    r = s.get(f"{API}/tonights-shift/meta")
    assert r.status_code == 200


def test_regression_recommended_3_to_5(s):
    gid = make_guest(s, role="bartender")
    r = s.get(f"{API}/guests/{gid}/recommended-situations")
    assert r.status_code == 200
    items = r.json()
    # Response may be list or dict with items
    if isinstance(items, dict):
        items = items.get("situations") or items.get("items") or []
    assert 3 <= len(items) <= 5
