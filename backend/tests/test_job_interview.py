"""Backend tests for Job Interview English feature + regressions."""
import json
import os
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hostel-english-mvp.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

PACK = json.loads((Path(__file__).resolve().parent.parent / "data" / "job_interview.json").read_text(encoding="utf-8"))
SCENARIOS = PACK["scenarios"]
SCENARIO_BY_ID = {s["id"]: s for s in SCENARIOS}
EXPECTED_LANGS = {"es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"}


def _mk_guest(role="bartender", language="es", goal=None, employment_status=None):
    r = requests.post(f"{API}/guests", json={})
    r.raise_for_status()
    gid = r.json()["id"]
    requests.put(f"{API}/guests/{gid}/language", json={"interface_language": language}).raise_for_status()
    if role:
        payload = {"role": role, "venue_type": "pub", "target_country": "ireland",
                   "goal": goal or "first_hospitality_job"}
        if employment_status:
            payload["employment_status"] = employment_status
        requests.put(f"{API}/guests/{gid}/profile", json=payload).raise_for_status()
    return gid


# --- meta ---
def test_meta_has_10_scenarios_and_all_languages():
    r = requests.get(f"{API}/job-interview/meta")
    assert r.status_code == 200
    data = r.json()
    assert data["scenario_count"] == 10
    # title should be localised for all languages
    assert EXPECTED_LANGS.issubset(set(data["ui"]["title"].keys()))


# --- GET job-interview (role set) ---
def test_get_returns_10_unique_scenarios_with_progress_bartender():
    gid = _mk_guest(role="bartender")
    r = requests.get(f"{API}/guests/{gid}/job-interview")
    assert r.status_code == 200
    d = r.json()
    assert d["role"] == "bartender"
    assert d.get("needs_role") in (False, None)
    assert len(d["scenarios"]) == 10
    ids = [s["id"] for s in d["scenarios"]]
    assert len(set(ids)) == 10
    assert "progress" in d and d["progress"] is not None
    # answer_index must not be exposed on practice
    for s in d["scenarios"]:
        assert "answer_index" not in s["practice"]
        assert len(s["practice"]["options"]) == 3


def test_bartender_vs_waiter_model_answer_variant():
    gid_b = _mk_guest(role="bartender")
    gid_w = _mk_guest(role="waiter")
    db = requests.get(f"{API}/guests/{gid_b}/job-interview").json()
    dw = requests.get(f"{API}/guests/{gid_w}/job-interview").json()
    for i in range(10):
        sid = db["scenarios"][i]["id"]
        src = SCENARIO_BY_ID[sid]["model_answer"]
        assert db["scenarios"][i]["model_answer"] == src["bartender"]
        assert dw["scenarios"][i]["model_answer"] == src["waiter"]
        assert db["scenarios"][i]["model_answer"] != dw["scenarios"][i]["model_answer"]


def test_role_missing_returns_needs_role_and_null_model():
    r = requests.post(f"{API}/guests", json={})
    gid = r.json()["id"]
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    assert d.get("needs_role") is True
    assert len(d["scenarios"]) == 10
    for s in d["scenarios"]:
        assert s["model_answer"] is None


def test_localization_and_english_targets():
    gid = _mk_guest(role="bartender", language="fr")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    s0 = d["scenarios"][0]
    src = SCENARIO_BY_ID[s0["id"]]
    # Localized fields match 'fr'
    assert s0["interviewer_wants"] == src["interviewer_wants"]["fr"]
    assert s0["answer_structure"] == src["answer_structure"]["fr"]
    assert s0["practice"]["prompt"] == src["practice"]["prompt"]["fr"]
    # English targets unchanged
    assert s0["question_en"] == src["question_en"]
    assert s0["useful_phrases_en"] == src["useful_phrases_en"]
    assert s0["practice"]["options"] == src["practice"]["options_en"]


# --- practice grading ---
def test_practice_grading_matches_json_answer_index():
    gid = _mk_guest(role="bartender")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    s0 = d["scenarios"][0]
    correct_idx = SCENARIO_BY_ID[s0["id"]]["practice"]["answer_index"]
    # wrong attempt
    wrong_idx = (correct_idx + 1) % 3
    r = requests.post(f"{API}/guests/{gid}/job-interview/practice",
                      json={"scenario_id": s0["id"], "answer_index": wrong_idx})
    assert r.status_code == 200
    data = r.json()
    assert data["correct"] is False
    assert data["correct_index"] == correct_idx
    # correct attempt (retake)
    r2 = requests.post(f"{API}/guests/{gid}/job-interview/practice",
                       json={"scenario_id": s0["id"], "answer_index": correct_idx})
    assert r2.status_code == 200
    assert r2.json()["correct"] is True


# --- progress persist + complete ---
def test_complete_all_10_sets_completion_and_persistence():
    gid = _mk_guest(role="bartender")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    for s in d["scenarios"]:
        src = SCENARIO_BY_ID[s["id"]]
        requests.post(f"{API}/guests/{gid}/job-interview/practice",
                      json={"scenario_id": s["id"], "answer_index": src["practice"]["answer_index"]}).raise_for_status()
    d2 = requests.get(f"{API}/guests/{gid}/job-interview").json()
    prog = d2["progress"]
    assert len(prog["completed_scenario_ids"]) == 10
    assert prog["practice_correct_count"] == 10
    assert prog.get("completed_at")


def test_language_change_preserves_progress():
    gid = _mk_guest(role="bartender", language="es")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    s0 = d["scenarios"][0]
    correct_idx = SCENARIO_BY_ID[s0["id"]]["practice"]["answer_index"]
    requests.post(f"{API}/guests/{gid}/job-interview/practice",
                  json={"scenario_id": s0["id"], "answer_index": correct_idx}).raise_for_status()
    requests.put(f"{API}/guests/{gid}/language", json={"interface_language": "de"}).raise_for_status()
    d2 = requests.get(f"{API}/guests/{gid}/job-interview").json()
    prog = d2["progress"]
    assert s0["id"] in prog["completed_scenario_ids"]
    assert prog["practice_correct_count"] >= 1
    # localization changed
    s0_de = next(x for x in d2["scenarios"] if x["id"] == s0["id"])
    assert s0_de["interviewer_wants"] == SCENARIO_BY_ID[s0["id"]]["interviewer_wants"]["de"]
    assert s0_de["question_en"] == s0["question_en"]  # English stays


def test_retake_overwrites_without_removing_from_completed():
    gid = _mk_guest(role="waiter")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    s0 = d["scenarios"][0]
    src = SCENARIO_BY_ID[s0["id"]]
    correct_idx = src["practice"]["answer_index"]
    wrong_idx = (correct_idx + 1) % 3
    # correct first
    requests.post(f"{API}/guests/{gid}/job-interview/practice",
                  json={"scenario_id": s0["id"], "answer_index": correct_idx}).raise_for_status()
    d1 = requests.get(f"{API}/guests/{gid}/job-interview").json()
    assert d1["progress"]["practice_correct_count"] == 1
    assert s0["id"] in d1["progress"]["completed_scenario_ids"]
    # overwrite with wrong
    requests.post(f"{API}/guests/{gid}/job-interview/practice",
                  json={"scenario_id": s0["id"], "answer_index": wrong_idx}).raise_for_status()
    d2 = requests.get(f"{API}/guests/{gid}/job-interview").json()
    assert s0["id"] in d2["progress"]["completed_scenario_ids"]  # not removed
    assert d2["progress"]["practice_correct_count"] == 0  # recomputed


def test_open_scenario_updates_last_opened():
    gid = _mk_guest(role="bartender")
    d = requests.get(f"{API}/guests/{gid}/job-interview").json()
    sid = d["scenarios"][2]["id"]
    r = requests.put(f"{API}/guests/{gid}/job-interview/open", json={"scenario_id": sid})
    assert r.status_code == 200
    d2 = requests.get(f"{API}/guests/{gid}/job-interview").json()
    assert d2["progress"]["last_opened_scenario_id"] == sid


# --- REGRESSION ---
def test_situations_still_50():
    r = requests.get(f"{API}/situations")
    assert r.status_code == 200
    arr = r.json()
    assert len(arr) == 50
    bart = [s for s in arr if "bartender" in (s.get("roles") or [])]
    waiter = [s for s in arr if "waiter" in (s.get("roles") or [])]
    assert len(bart) == 25
    assert len(waiter) == 25


def test_assessment_meta_ok():
    r = requests.get(f"{API}/assessment/meta")
    assert r.status_code == 200
    data = r.json()
    assert "ui" in data
    # disclaimer should not mention CEFR
    disc_bundle = data["ui"].get("disclaimer", {})
    if isinstance(disc_bundle, dict):
        for v in disc_bundle.values():
            assert "CEFR" not in str(v).upper() or "cefr" not in str(v)


def test_emergency_ok():
    r = requests.get(f"{API}/emergency")
    assert r.status_code == 200
    d = r.json()
    assert len(d.get("phrases", [])) == 32
    assert len(d.get("categories", [])) == 8


def test_tonights_shift_meta_ok():
    r = requests.get(f"{API}/tonights-shift/meta")
    assert r.status_code == 200
    assert r.json().get("session_size") == 5


def test_recommended_returns_3_to_5():
    gid = _mk_guest(role="bartender")
    r = requests.get(f"{API}/guests/{gid}/recommended-situations", params={"limit": 5})
    assert r.status_code == 200
    arr = r.json()
    assert 3 <= len(arr) <= 5
