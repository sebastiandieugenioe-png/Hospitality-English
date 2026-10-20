"""Tests for situation attempts, backend scoring, mastery and progress."""
import os
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

SLUG = "guest-asks-for-cocktail-recommendation"


def _guest():
    return link_premium(requests.post(f"{API}/guests", json={}).json()["id"])


def _lesson(slug=SLUG):
    return requests.get(f"{API}/lessons/{slug}", headers=premium_headers()).json()["lesson"]


def _start(gid, slug=SLUG):
    return requests.post(f"{API}/situation-attempts/start", headers=premium_headers(), json={"guest_id": gid, "situation_slug": slug}).json()


def _answer_all(gid, aid, slug=SLUG, correct=True):
    lesson = _lesson(slug)
    for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
        for q in lesson[key]:
            if q["type"] == "multiple_choice":
                sub = q["answer_index"] if correct else (q["answer_index"] + 1) % len(q["options"])
            elif q["type"] == "fill_gap":
                sub = q["answer"] if correct else "definitely-wrong"
            else:
                sub = q["answer"] if correct else "wrong order here"
            requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": q["id"], "section": section, "submitted_answer": sub})


class TestContentIds:
    def test_ids_unique_within_lesson(self):
        for slug in [SLUG, "taking-an-order", "guest-mentions-a-nut-allergy"]:
            lesson = _lesson(slug)
            ids = [q["id"] for q in lesson["exercises"]] + [q["id"] for q in lesson["quiz"]]
            assert len(ids) == len(set(ids)), f"{slug} has duplicate question ids"
            assert lesson["content_version"] >= 1
            for q in lesson["exercises"] + lesson["quiz"]:
                assert q.get("assessment_dimension") in {"english", "comprehension", "service"}
                assert q.get("id")


class TestAttemptLifecycle:
    def test_start_and_resume(self):
        gid = _guest()
        a1 = _start(gid)
        assert a1["status"] == "in_progress" and a1["lesson_version"] == 1
        a2 = _start(gid)  # refresh
        assert a2["attempt_id"] == a1["attempt_id"], "refresh must resume same attempt"

    def test_invalid_guest(self):
        r = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(), json={"guest_id": "nope", "situation_slug": SLUG})
        assert r.status_code == 404

    def test_invalid_situation(self):
        gid = _guest()
        r = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(), json={"guest_id": gid, "situation_slug": "nope"})
        assert r.status_code == 404

    def test_inactive_situation(self):
        gid = _guest()
        r = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(), json={"guest_id": gid, "situation_slug": "welcoming-guests"})
        assert r.status_code == 400

    def test_invalid_question_id(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": "does-not-exist", "section": "quiz", "submitted_answer": 0})
        assert r.status_code == 422

    def test_question_from_other_lesson_rejected(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": "q_steak", "section": "quiz", "submitted_answer": 0})
        assert r.status_code == 422

    def test_complete_missing_attempt(self):
        assert requests.post(f"{API}/situation-attempts/nope/complete").status_code == 404


class TestBackendScoring:
    def test_multiple_choice_backend_decides(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        lesson = _lesson()
        mc = next(q for q in lesson["exercises"] if q["type"] == "multiple_choice")
        # wrong index but claim nothing (frontend can't force correctness)
        wrong = (mc["answer_index"] + 1) % len(mc["options"])
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": mc["id"], "section": "exercise", "submitted_answer": wrong})
        assert r.json()["correct"] is False
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": mc["id"], "section": "exercise", "submitted_answer": mc["answer_index"]})
        assert r.json()["correct"] is True

    def test_fill_gap_normalization(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        gap = next(q for q in _lesson()["exercises"] if q["type"] == "fill_gap")
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": gap["id"], "section": "exercise", "submitted_answer": f"  {gap['answer'].upper()}. "})
        assert r.json()["correct"] is True

    def test_word_ordering_normalization(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        wo = next(q for q in _lesson()["exercises"] if q["type"] == "word_ordering")
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": wo["id"], "section": "exercise", "submitted_answer": wo["answer"] + "?!"})
        assert r.json()["correct"] is True


class TestScoringAndMastery:
    def test_perfect_attempt_mastered(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        _answer_all(gid, aid, correct=True)
        res = requests.post(f"{API}/situation-attempts/{aid}/complete").json()
        assert res["scores"]["overall"] == 100
        assert res["scores"]["service"] is not None and res["scores"]["service"] >= 70
        assert res["mastered"] is True
        assert res["status"] == "completed"

    def test_taking_an_order_service_null(self):
        gid = _guest(); aid = _start(gid, "taking-an-order")["attempt_id"]
        _answer_all(gid, aid, "taking-an-order", correct=True)
        res = requests.post(f"{API}/situation-attempts/{aid}/complete").json()
        assert res["scores"]["service"] is None  # no service questions
        assert res["scores"]["overall"] == 100 and res["mastered"] is True

    def test_completed_is_immutable(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        _answer_all(gid, aid, correct=True)
        requests.post(f"{API}/situation-attempts/{aid}/complete")
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": "ex_rc_2", "section": "exercise", "submitted_answer": "x"})
        assert r.status_code == 409

    def test_retry_creates_new_attempt(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        _answer_all(gid, aid, correct=True)
        requests.post(f"{API}/situation-attempts/{aid}/complete")
        a2 = _start(gid)  # after completion, new attempt
        assert a2["attempt_id"] != aid
        alls = requests.get(f"{API}/guests/{gid}/attempts").json()
        assert len(alls) == 2

    def test_low_overall_not_mastered(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        _answer_all(gid, aid, correct=False)
        res = requests.post(f"{API}/situation-attempts/{aid}/complete").json()
        assert res["scores"]["overall"] < 80 and res["mastered"] is False

    def test_situation_stats(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        _answer_all(gid, aid, correct=True)
        requests.post(f"{API}/situation-attempts/{aid}/complete")
        stats = requests.get(f"{API}/guests/{gid}/situation-stats").json()
        s = stats[SLUG]
        assert s["status"] == "mastered" and s["mastered"] is True
        assert s["best_score"] == 100 and s["attempts_count"] == 1
