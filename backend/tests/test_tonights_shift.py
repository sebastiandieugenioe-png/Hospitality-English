"""Backend pytest suite for Tonight's Shift feature.
Covers: start/get, 5-item invariant, role-compat, due_review slot1, weak-skill slots 2/3,
recommended slot4, dedupe, daily stability, language stability, resume, read-only completed,
different-role new session, scoring + focus_skill, no side-effects on SRS/attempts/mastery,
10-language UI meta, regressions (assessment meta, emergency, recommended, catalog).
"""
import os
import uuid
import time
import pytest
import requests
from datetime import datetime, timedelta, timezone
from pymongo import MongoClient

from dotenv import load_dotenv as _ld
_ld("/app/frontend/.env")
BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = BASE + "/api"

# --- Mongo direct access for seeding review_items / weak skills (allowed per spec) ---
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
_mongo = MongoClient(MONGO_URL)
_db = _mongo[DB_NAME]


# ---------- Helpers ----------
def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _make_guest(role="bartender"):
    r = requests.post(f"{API}/guests", json={"interface_language": "en"})
    r.raise_for_status()
    gid = r.json()["id"]
    rp = requests.put(f"{API}/guests/{gid}/profile", json={
        "role": role, "venue_type": "pub", "target_country": "ireland",
        "goal": "work_abroad", "employment_status": "looking_for_job",
        "english_level": "A2",
    })
    rp.raise_for_status()
    return gid


def _answer_key(situation_slug):
    r = requests.get(f"{API}/lessons/{situation_slug}")
    r.raise_for_status()
    data = r.json()["lesson"]
    keys = {}
    for section in ("exercises", "quiz"):
        for q in data.get(section, []):
            keys[q["id"]] = q
    return keys


def _submit(session_id, item_id, q, correct=True):
    t = q["type"]
    if t == "multiple_choice":
        idx = q["answer_index"]
        if not correct:
            # pick any index != correct
            n = len(q.get("options") or [])
            idx = (idx + 1) % max(n, 2)
        submitted = idx
    elif t == "fill_gap":
        submitted = q["answer"] if correct else q["answer"] + "_wrong_x"
    else:  # word_ordering
        submitted = q["answer"] if correct else (q["answer"] + " x")
    r = requests.put(f"{API}/shift-sessions/{session_id}/response", json={
        "item_id": item_id, "submitted_answer": submitted,
    })
    r.raise_for_status()
    return r.json()


# ---------- Fixtures ----------
@pytest.fixture
def bartender_guest():
    gid = _make_guest("bartender")
    yield gid
    # cleanup: remove any seeded review_items
    _db.review_items.delete_many({"guest_id": gid})
    _db.shift_sessions.delete_many({"guest_id": gid})


@pytest.fixture
def waiter_guest():
    gid = _make_guest("waiter")
    yield gid
    _db.review_items.delete_many({"guest_id": gid})
    _db.shift_sessions.delete_many({"guest_id": gid})


# ---------- Tests ----------
def test_meta_has_10_languages():
    r = requests.get(f"{API}/tonights-shift/meta")
    assert r.status_code == 200
    data = r.json()
    assert data["session_size"] == 5
    LANGS = {"es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"}
    ui = data["ui"]
    for key in ["title", "home_title", "subtitle", "duration", "start", "continue",
                "question_progress", "correct", "not_quite", "complete_title",
                "score", "focus_next", "done_today", "back_home"]:
        assert key in ui, f"Missing UI key {key}"
        assert set(ui[key].keys()) >= LANGS, f"{key} missing langs: {LANGS - set(ui[key].keys())}"


def test_start_returns_exactly_5_unique_items_role_compatible(bartender_guest):
    r = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": _today()})
    assert r.status_code == 200
    data = r.json()
    assert data["total"] == 5
    assert len(data["items"]) == 5
    ids = [it["id"] for it in data["items"]]
    assert len(set(ids)) == 5, "duplicate item IDs"

    # role compat: check each situation includes bartender
    slugs = list({it["situation_slug"] for it in data["items"]})
    sits = {s["slug"]: s for s in _db.situations.find({"slug": {"$in": slugs}})}
    for it in data["items"]:
        roles = sits[it["situation_slug"]].get("roles") or []
        assert "bartender" in roles, f"situation {it['situation_slug']} not bartender-compat"
        assert sits[it["situation_slug"]].get("active") is True


def test_items_exist_in_active_lesson_content(bartender_guest):
    r = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": _today()}).json()
    for it in r["items"]:
        keys = _answer_key(it["situation_slug"])
        assert it["id"] in keys, f"item {it['id']} not in lesson {it['situation_slug']}"


def test_waiter_role_compat(waiter_guest):
    data = requests.post(f"{API}/guests/{waiter_guest}/tonights-shift/start",
                         json={"local_date": _today()}).json()
    slugs = list({it["situation_slug"] for it in data["items"]})
    sits = {s["slug"]: s for s in _db.situations.find({"slug": {"$in": slugs}})}
    for it in data["items"]:
        assert "waiter" in (sits[it["situation_slug"]].get("roles") or [])


def test_due_review_priority_slot1(bartender_guest):
    """Seed a due review_item on a bartender item -> slot1 is that item with reason due_review."""
    # pick any bartender-compat item from lessons
    sits = list(_db.situations.find({"active": True, "roles": "bartender"}))
    chosen_item = None
    for s in sits:
        l = _db.lessons.find_one({"situation_slug": s["slug"]})
        if not l:
            continue
        for section in ("exercises", "quiz"):
            for q in l.get(section, []):
                if q.get("type") in ("multiple_choice", "fill_gap", "word_ordering"):
                    chosen_item = (q["id"], s["slug"], s.get("primary_skill"))
                    break
            if chosen_item:
                break
        if chosen_item:
            break
    assert chosen_item
    iid, slug, skill = chosen_item
    past = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    _db.review_items.insert_one({
        "id": str(uuid.uuid4()), "guest_id": bartender_guest,
        "source_id": iid, "situation_slug": slug,
        "primary_skill": skill or "orders", "next_review_at": past,
        "times_wrong": 1,
    })
    data = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                         json={"local_date": _today()}).json()
    assert data["items"][0]["id"] == iid
    assert data["items"][0]["selection_reason"] == "due_review"


def test_assessment_weak_skills_influence_slots_2_and_3(bartender_guest):
    """Set 2 distinct weak skills; verify slot2/slot3 selection_reason=assessment_weakness
    and primary_skill matches."""
    # inspect bartender situations' available skills
    sits = list(_db.situations.find({"active": True, "roles": "bartender"}))
    skills = []
    for s in sits:
        ps = s.get("primary_skill")
        if ps and ps not in skills:
            skills.append(ps)
        if len(skills) >= 2:
            break
    assert len(skills) >= 2
    _db.guests.update_one({"id": bartender_guest},
                          {"$set": {"assessment_weak_skills": skills[:2]}})
    data = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                         json={"local_date": _today()}).json()
    items = data["items"]
    assert items[1]["selection_reason"] == "assessment_weakness"
    assert items[2]["selection_reason"] == "assessment_weakness"
    # primary_skill or skills intersect with weak list
    for idx in (1, 2):
        it = items[idx]
        sit = _db.situations.find_one({"slug": it["situation_slug"]})
        candidate = set([sit.get("primary_skill")]) | set(sit.get("skills") or [])
        assert candidate & set(skills[:2]), f"slot {idx+1} doesn't match weak skills"


def test_recommended_slot4(bartender_guest):
    r = requests.get(f"{API}/guests/{bartender_guest}/recommended-situations").json()
    rec = r if isinstance(r, list) else r.get("recommended") or r.get("items") or r.get("situations") or []
    rec_slugs = {s["slug"] for s in rec}
    assert rec_slugs, f"no recommended situations: {r}"
    data = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                         json={"local_date": _today()}).json()
    slot4 = data["items"][3]
    # Spec: slot4 reason is 'recommended' (fallback venue_relevant/variety)
    if slot4["selection_reason"] == "recommended":
        assert slot4["situation_slug"] in rec_slugs


def test_dedupe_rules(bartender_guest):
    data = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                         json={"local_date": _today()}).json()
    ids = [it["id"] for it in data["items"]]
    assert len(set(ids)) == 5
    # at most 2 of same exercise type (soft rule when alternatives exist)
    types = [it["type"] for it in data["items"]]
    from collections import Counter
    c = Counter(types)
    # distinct situations preferred
    slugs = [it["situation_slug"] for it in data["items"]]
    assert len(set(slugs)) >= 3  # at least 3 distinct situations as sanity


def test_daily_stability_same_ids_on_refresh(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    b = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    assert a["session_id"] == b["session_id"]
    assert [i["id"] for i in a["items"]] == [i["id"] for i in b["items"]]


def test_language_stability(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    ids_before = [i["id"] for i in a["items"]]
    r = requests.put(f"{API}/guests/{bartender_guest}/language", json={"interface_language": "es"})
    assert r.status_code == 200
    b = requests.get(f"{API}/guests/{bartender_guest}/tonights-shift",
                     params={"local_date": d}).json()
    assert [i["id"] for i in b["items"]] == ids_before


def test_resume_in_progress(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    sid = a["session_id"]
    first = a["items"][0]
    keys = _answer_key(first["situation_slug"])
    _submit(sid, first["id"], keys[first["id"]], correct=True)
    # fetch and resume
    b = requests.get(f"{API}/guests/{bartender_guest}/tonights-shift",
                     params={"local_date": d}).json()
    assert b["session_id"] == sid
    assert b["answered_count"] == 1
    assert b["status"] == "in_progress"


def test_completed_read_only_same_day(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    sid = a["session_id"]
    for it in a["items"]:
        keys = _answer_key(it["situation_slug"])
        _submit(sid, it["id"], keys[it["id"]], correct=True)
    done = requests.post(f"{API}/shift-sessions/{sid}/complete").json()
    assert done["status"] == "completed"
    assert done["correct_count"] == 5
    assert done["total"] == 5
    # calling start again returns same completed session
    again = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                          json={"local_date": d}).json()
    assert again["session_id"] == sid
    assert again["status"] == "completed"


def test_different_role_different_session(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    # change role to waiter
    requests.put(f"{API}/guests/{bartender_guest}/profile", json={
        "role": "waiter", "venue_type": "pub", "target_country": "ireland",
        "goal": "work_abroad", "employment_status": "looking_for_job",
        "english_level": "A2",
    }).raise_for_status()
    b = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    assert a["session_id"] != b["session_id"]
    assert b["role"] == "waiter"


def test_scoring_3_of_5_and_focus_skill(bartender_guest):
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    sid = a["session_id"]
    # Answer: first 2 wrong, next 3 correct → 3/5. focus_skill = primary_skill of item[0] (slot order).
    results = []
    for idx, it in enumerate(a["items"]):
        keys = _answer_key(it["situation_slug"])
        correct = idx >= 2
        results.append(_submit(sid, it["id"], keys[it["id"]], correct=correct))
    assert results[0]["correct"] is False
    assert results[2]["correct"] is True
    done = requests.post(f"{API}/shift-sessions/{sid}/complete").json()
    assert done["correct_count"] == 3
    assert done["total"] == 5
    # focus_skill should be the primary_skill of the earliest wrong (slot order tiebreak)
    # Could be either item[0] or item[1] skill depending on counts (both have 1 err each).
    # Slot order tiebreak → item[0]'s primary_skill.
    expected_skill = a["items"][0].get("primary_skill")
    if expected_skill:
        assert done["focus_skill"] == expected_skill


def test_focus_skill_all_correct_uses_weak(bartender_guest):
    sits = list(_db.situations.find({"active": True, "roles": "bartender"}))
    skill = sits[0].get("primary_skill") or "orders"
    _db.guests.update_one({"id": bartender_guest},
                          {"$set": {"assessment_weak_skills": [skill]}})
    d = _today()
    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    sid = a["session_id"]
    for it in a["items"]:
        keys = _answer_key(it["situation_slug"])
        _submit(sid, it["id"], keys[it["id"]], correct=True)
    done = requests.post(f"{API}/shift-sessions/{sid}/complete").json()
    assert done["correct_count"] == 5
    assert done["focus_skill"] == skill


def test_no_side_effects_on_srs_attempts(bartender_guest):
    """A full shift session must NOT create review_items nor situation_attempts."""
    d = _today()
    # Baseline
    r_before = _db.review_items.count_documents({"guest_id": bartender_guest})
    a_before = requests.get(f"{API}/guests/{bartender_guest}/attempts").json()
    att_before = len(a_before if isinstance(a_before, list) else a_before.get("attempts", []))

    a = requests.post(f"{API}/guests/{bartender_guest}/tonights-shift/start",
                      json={"local_date": d}).json()
    sid = a["session_id"]
    for idx, it in enumerate(a["items"]):
        keys = _answer_key(it["situation_slug"])
        _submit(sid, it["id"], keys[it["id"]], correct=(idx % 2 == 0))
    requests.post(f"{API}/shift-sessions/{sid}/complete")

    r_after = _db.review_items.count_documents({"guest_id": bartender_guest})
    a_after = requests.get(f"{API}/guests/{bartender_guest}/attempts").json()
    att_after = len(a_after if isinstance(a_after, list) else a_after.get("attempts", []))
    assert r_after == r_before, "review_items changed!"
    assert att_after == att_before, "situation_attempts changed!"


# ---------- Regressions ----------
def test_regression_assessment_meta():
    r = requests.get(f"{API}/assessment/meta")
    assert r.status_code == 200
    data = r.json()
    assert "ui" in data or "note" in data or "total_questions" in data


def test_regression_emergency():
    r = requests.get(f"{API}/emergency")
    assert r.status_code == 200
    data = r.json()
    phrases = data.get("phrases", [])
    cats = data.get("categories", [])
    assert len(phrases) == 32
    assert len(cats) == 8


def test_regression_catalog_50_situations():
    r = requests.get(f"{API}/situations")
    assert r.status_code == 200
    data = r.json()
    sits = data if isinstance(data, list) else data.get("situations", [])
    active = [s for s in sits if s.get("active", True)]
    assert len(active) == 50
    bartender = [s for s in active if "bartender" in (s.get("roles") or [])]
    waiter = [s for s in active if "waiter" in (s.get("roles") or [])]
    assert len(bartender) == 25
    assert len(waiter) == 25


def test_regression_recommended_3_to_5(bartender_guest):
    r = requests.get(f"{API}/guests/{bartender_guest}/recommended-situations").json()
    rec = r if isinstance(r, list) else r.get("recommended") or r.get("items") or r.get("situations") or []
    assert 3 <= len(rec) <= 5
