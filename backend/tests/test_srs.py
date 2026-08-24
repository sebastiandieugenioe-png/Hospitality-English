"""Tests for Mistake Bank + Spaced Repetition (review_items) and mastery semantics."""
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
    return requests.post(f"{API}/situation-attempts/start", json={"guest_id": gid, "situation_slug": slug}).json()


def _wrong_for(q):
    if q["type"] == "multiple_choice":
        return (q["answer_index"] + 1) % len(q["options"])
    if q["type"] == "fill_gap":
        return "definitely-wrong"
    return "wrong order here"


def _first_exercise(slug=SLUG):
    return _lesson(slug)["exercises"][0]


def _answer(aid, q, section, submitted):
    return requests.put(
        f"{API}/situation-attempts/{aid}/response",
        json={"question_id": q["id"], "section": section, "submitted_answer": submitted},
    ).json()


class TestMistakeCreation:
    def test_wrong_answer_creates_review_item(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        q = _first_exercise()
        r = _answer(aid, q, "exercise", _wrong_for(q))
        assert r["correct"] is False
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 1
        it = items[0]
        assert it["source_type"] == "question" and it["origin"] == "mistake"
        assert it["source_id"] == q["id"] and it["situation_slug"] == SLUG
        assert it["times_wrong"] == 1
        assert it["assessment_dimension"] in {"english", "comprehension", "service"}
        assert it["ease_factor"] == 2.5 and it["review_state"] == "learning"
        assert "content" in it and it["content"]["prompt_es"]
        # answer must not be leaked before responding
        assert "answer" not in it["content"] and "answer_index" not in it["content"]

    def test_correct_answer_creates_no_item(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        q = _first_exercise()
        correct = q["answer_index"] if q["type"] == "multiple_choice" else q["answer"]
        _answer(aid, q, "exercise", correct)
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 0

    def test_times_wrong_dedup_within_same_attempt(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        q = _first_exercise()
        _answer(aid, q, "exercise", _wrong_for(q))
        _answer(aid, q, "exercise", _wrong_for(q))
        _answer(aid, q, "exercise", _wrong_for(q))
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 1 and items[0]["times_wrong"] == 1

    def test_times_wrong_increments_across_attempts(self):
        gid = _guest()
        for _ in range(2):
            aid = _start(gid)["attempt_id"]
            q = _first_exercise()
            _answer(aid, q, "exercise", _wrong_for(q))
            requests.post(f"{API}/situation-attempts/{aid}/complete")
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(items) == 1 and items[0]["times_wrong"] == 2

    def test_guest_isolation(self):
        g1 = _guest(); g2 = _guest()
        aid = _start(g1)["attempt_id"]
        q = _first_exercise()
        _answer(aid, q, "exercise", _wrong_for(q))
        assert len(requests.get(f"{API}/guests/{g1}/review-items").json()) == 1
        assert len(requests.get(f"{API}/guests/{g2}/review-items").json()) == 0


class TestReviewListing:
    def test_due_filter_and_summary(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        q = _first_exercise()
        _answer(aid, q, "exercise", _wrong_for(q))
        due = requests.get(f"{API}/guests/{gid}/review-items", params={"due": "true", "limit": 10}).json()
        assert len(due) == 1  # new mistakes are due immediately
        summ = requests.get(f"{API}/guests/{gid}/review-summary").json()
        assert summ["total"] == 1 and summ["due"] == 1
        assert sum(summ["by_dimension"].values()) == 1

    def test_review_items_missing_guest(self):
        assert requests.get(f"{API}/guests/nope/review-items").status_code == 404
        assert requests.get(f"{API}/guests/nope/review-summary").status_code == 404


class TestAnswerAndRate:
    def _make_item(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        q = _first_exercise()
        _answer(aid, q, "exercise", _wrong_for(q))
        item = requests.get(f"{API}/guests/{gid}/review-items").json()[0]
        return gid, item, q

    def test_answer_backend_grades(self):
        gid, item, q = self._make_item()
        correct = q["answer_index"] if q["type"] == "multiple_choice" else q["answer"]
        r = requests.post(f"{API}/review-items/{item['id']}/answer", json={"submitted_answer": correct}).json()
        assert r["correct"] is True and r["correct_answer"]
        r2 = requests.post(f"{API}/review-items/{item['id']}/answer", json={"submitted_answer": _wrong_for(q)}).json()
        assert r2["correct"] is False
        refreshed = requests.get(f"{API}/guests/{gid}/review-items").json()[0]
        assert refreshed["times_seen"] == 2 and refreshed["times_correct"] == 1

    def test_rate_good_schedules_future(self):
        gid, item, _ = self._make_item()
        r = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "good"}).json()
        assert r["consecutive_successes"] == 1 and r["interval_days"] == 1
        assert r["review_state"] == "review"
        assert r["next_review_at"] > item["next_review_at"]
        # No longer due today
        due = requests.get(f"{API}/guests/{gid}/review-items", params={"due": "true"}).json()
        assert len(due) == 0

    def test_rate_again_relearns(self):
        gid, item, _ = self._make_item()
        r = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "again"}).json()
        assert r["consecutive_successes"] == 0 and r["interval_days"] == 0
        assert r["review_state"] == "learning"
        assert r["ease_factor"] < 2.5

    def test_rate_easy_larger_interval_than_good(self):
        _, item_a, _ = self._make_item()
        _, item_b, _ = self._make_item()
        good = requests.post(f"{API}/review-items/{item_a['id']}/rate", json={"rating": "good"}).json()
        easy = requests.post(f"{API}/review-items/{item_b['id']}/rate", json={"rating": "easy"}).json()
        assert easy["interval_days"] > good["interval_days"]
        assert easy["ease_factor"] > good["ease_factor"]

    def test_rate_hard_lowers_ease(self):
        _, item, _ = self._make_item()
        r = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "hard"}).json()
        assert r["ease_factor"] < 2.5 and r["consecutive_successes"] == 1

    def test_ease_floor(self):
        _, item, _ = self._make_item()
        last = None
        for _ in range(10):
            last = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "again"}).json()
        assert last["ease_factor"] >= 1.3

    def test_consecutive_interval_growth(self):
        _, item, _ = self._make_item()
        r1 = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "good"}).json()
        r2 = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "good"}).json()
        r3 = requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "good"}).json()
        assert r1["interval_days"] == 1 and r2["interval_days"] == 3
        assert r3["interval_days"] > r2["interval_days"]

    def test_invalid_rating(self):
        _, item, _ = self._make_item()
        assert requests.post(f"{API}/review-items/{item['id']}/rate", json={"rating": "meh"}).status_code == 422

    def test_answer_missing_item(self):
        assert requests.post(f"{API}/review-items/nope/answer", json={"submitted_answer": 0}).status_code == 404

    def test_rate_missing_item(self):
        assert requests.post(f"{API}/review-items/nope/rate", json={"rating": "good"}).status_code == 404


class TestMasterySemantics:
    def _answer_all(self, gid, aid, slug=SLUG, correct=True):
        lesson = _lesson(slug)
        for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
            for q in lesson[key]:
                if q["type"] == "multiple_choice":
                    sub = q["answer_index"] if correct else (q["answer_index"] + 1) % len(q["options"])
                elif q["type"] == "fill_gap":
                    sub = q["answer"] if correct else "definitely-wrong"
                else:
                    sub = q["answer"] if correct else "wrong order here"
                _answer(aid, q, section, sub)

    def test_completed_attempt_exposes_met_mastery_threshold(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        self._answer_all(gid, aid, correct=True)
        res = requests.post(f"{API}/situation-attempts/{aid}/complete").json()
        assert res["met_mastery_threshold"] is True
        assert res["mastered"] is True  # legacy mirror kept

    def test_stats_derive_mastery(self):
        gid = _guest(); aid = _start(gid)["attempt_id"]
        self._answer_all(gid, aid, correct=True)
        requests.post(f"{API}/situation-attempts/{aid}/complete")
        stats = requests.get(f"{API}/guests/{gid}/situation-stats").json()
        assert stats[SLUG]["mastered"] is True and stats[SLUG]["status"] == "mastered"
