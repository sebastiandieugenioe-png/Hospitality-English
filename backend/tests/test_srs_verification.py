"""Independent verification (T1) of Mistake Bank / SRS spec items not covered elsewhere."""
import os
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

SLUG = "guest-asks-for-cocktail-recommendation"


def _guest():
    return requests.post(f"{API}/guests", json={}).json()["id"]


def _lesson(slug=SLUG):
    return requests.get(f"{API}/lessons/{slug}").json()["lesson"]


def _start(gid, slug=SLUG):
    return requests.post(f"{API}/situation-attempts/start", json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]


def _wrong_for(q):
    if q["type"] == "multiple_choice":
        return (q["answer_index"] + 1) % len(q["options"])
    if q["type"] == "fill_gap":
        return "definitely-wrong"
    return "wrong order here"


def _right_for(q):
    if q["type"] == "multiple_choice":
        return q["answer_index"]
    return q["answer"]


def _answer(aid, q, section, submitted):
    return requests.put(
        f"{API}/situation-attempts/{aid}/response",
        json={"question_id": q["id"], "section": section, "submitted_answer": submitted},
    )


def _fail_all(gid):
    """Fail every exercise+quiz question of SLUG for a guest; returns attempt_id."""
    aid = _start(gid)
    lesson = _lesson()
    for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
        for q in lesson[key]:
            r = _answer(aid, q, section, _wrong_for(q))
            assert r.status_code == 200, r.text
    return aid


# ---------- review-items listing contract ----------
class TestReviewItemsContract:
    def test_limit_and_no_answer_leak_all_types(self):
        gid = _guest()
        _fail_all(gid)
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) >= 3
        for it in items:
            c = it["content"]
            assert set(c.keys()) <= {"id", "type", "prompt", "options", "sentence", "words"}
            assert "answer" not in c and "answer_index" not in c
            assert c["prompt"]
            assert it["situation_title"]
        limited = requests.get(f"{API}/guests/{gid}/review-items", params={"limit": 2}).json()
        assert len(limited) == 2

    def test_due_true_subset_and_after_rating_not_due(self):
        gid = _guest()
        _fail_all(gid)
        due = requests.get(f"{API}/guests/{gid}/review-items", params={"due": "true"}).json()
        allitems = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(due) == len(allitems) and len(due) > 0
        first = due[0]["id"]
        assert requests.post(f"{API}/review-items/{first}/rate", json={"rating": "good"}).status_code == 200
        due_after = requests.get(f"{API}/guests/{gid}/review-items", params={"due": "true"}).json()
        assert first not in [i["id"] for i in due_after]
        # still present in the full mistake bank (not due but active)
        assert first in [i["id"] for i in requests.get(f"{API}/guests/{gid}/review-items").json()]

    def test_limit_validation(self):
        gid = _guest()
        assert requests.get(f"{API}/guests/{gid}/review-items", params={"limit": 0}).status_code == 422
        assert requests.get(f"{API}/guests/{gid}/review-items", params={"limit": 500}).status_code == 422


# ---------- summary ----------
class TestSummary:
    def test_summary_coherent_and_has_service_dimension(self):
        gid = _guest()
        _fail_all(gid)
        s = requests.get(f"{API}/guests/{gid}/review-summary").json()
        items = requests.get(f"{API}/guests/{gid}/review-items", params={"limit": 200}).json()
        assert s["total"] == len(items) == s["due"]
        assert sum(s["by_dimension"].values()) == s["total"]
        assert sum(s["by_skill"].values()) == s["total"]
        assert "service" in s["by_dimension"]

    def test_summary_404(self):
        assert requests.get(f"{API}/guests/does-not-exist/review-summary").status_code == 404

    def test_empty_guest(self):
        gid = _guest()
        assert requests.get(f"{API}/guests/{gid}/review-items").json() == []
        s = requests.get(f"{API}/guests/{gid}/review-summary").json()
        assert s == {"total": 0, "due": 0, "by_skill": {}, "by_dimension": {}}


# ---------- answer / rate independence ----------
class TestAnswerAndRate:
    def test_counters_and_rating_independent_of_correctness(self):
        gid = _guest()
        _fail_all(gid)
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        it = items[0]
        q = next(
            x for x in _lesson()["exercises"] + _lesson()["quiz"] if x["id"] == it["source_id"]
        )
        # wrong answer in review session
        r = requests.post(f"{API}/review-items/{it['id']}/answer", json={"submitted_answer": _wrong_for(q)}).json()
        assert r["correct"] is False
        assert r["correct_answer"] and r["explanation"]
        # rating "easy" despite a wrong answer must still schedule far in the future
        rated = requests.post(f"{API}/review-items/{it['id']}/rate", json={"rating": "easy"}).json()
        assert rated["interval_days"] == 3 and rated["review_state"] == "review"
        assert rated["ease_factor"] == 2.65
        assert rated["times_seen"] == 1 and rated["times_correct"] == 0
        assert rated["last_reviewed_at"] is not None
        # correct answer bumps times_correct
        r2 = requests.post(f"{API}/review-items/{it['id']}/answer", json={"submitted_answer": _right_for(q)}).json()
        assert r2["correct"] is True
        after = [x for x in requests.get(f"{API}/guests/{gid}/review-items").json() if x["id"] == it["id"]][0]
        assert after["times_seen"] == 2 and after["times_correct"] == 1
        # rating "again" despite a correct answer resets the schedule
        again = requests.post(f"{API}/review-items/{it['id']}/rate", json={"rating": "again"}).json()
        assert again["interval_days"] == 0 and again["consecutive_successes"] == 0
        # NOTE: the "again" branch does not round ease_factor (2.4499999999999997) unlike the others.
        assert again["review_state"] == "learning" and abs(again["ease_factor"] - 2.45) < 1e-6

    def test_rating_case_and_type_validation(self):
        gid = _guest()
        _fail_all(gid)
        iid = requests.get(f"{API}/guests/{gid}/review-items").json()[0]["id"]
        for bad in ["Good", "GOOD", "", "perfect", "1"]:
            assert requests.post(f"{API}/review-items/{iid}/rate", json={"rating": bad}).status_code == 422, bad
        assert requests.post(f"{API}/review-items/{iid}/rate", json={}).status_code == 422


# ---------- mastery mirror + isolation ----------
class TestMasteryAndIsolation:
    def test_perfect_attempt_mirror_and_stats(self):
        gid = _guest()
        aid = _start(gid)
        lesson = _lesson()
        for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
            for q in lesson[key]:
                assert _answer(aid, q, section, _right_for(q)).json()["correct"] is True
        done = requests.post(f"{API}/situation-attempts/{aid}/complete").json()
        assert done["met_mastery_threshold"] is True and done["mastered"] is True
        assert done["scores"]["overall"] == 100
        stats = requests.get(f"{API}/guests/{gid}/situation-stats").json()
        assert stats[SLUG]["status"] == "mastered" and stats[SLUG]["mastered"] is True
        # no mistakes recorded for a perfect attempt
        assert requests.get(f"{API}/guests/{gid}/review-items").json() == []

    def test_isolation_between_guests(self):
        g1, g2 = _guest(), _guest()
        _fail_all(g1)
        assert len(requests.get(f"{API}/guests/{g1}/review-items").json()) > 0
        assert requests.get(f"{API}/guests/{g2}/review-items").json() == []
        assert requests.get(f"{API}/guests/{g2}/review-summary").json()["total"] == 0

    def test_dedup_within_and_across_attempts(self):
        gid = _guest()
        aid = _start(gid)
        q = _lesson()["exercises"][0]
        for _ in range(3):
            _answer(aid, q, "exercise", _wrong_for(q))
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 1 and items[0]["times_wrong"] == 1
        requests.post(f"{API}/situation-attempts/{aid}/complete")
        aid2 = _start(gid)
        assert aid2 != aid
        _answer(aid2, q, "exercise", _wrong_for(q))
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 1 and items[0]["times_wrong"] == 2
