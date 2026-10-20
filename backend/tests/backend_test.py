"""Backend API tests for Inglés para Hostelería MVP (content + guest progress)."""
import os
import pytest
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Content endpoints ----------
class TestContent:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        assert "message" in r.json()

    def test_categories(self, client):
        r = client.get(f"{API}/categories")
        assert r.status_code == 200
        cats = r.json()
        assert isinstance(cats, list)
        assert len(cats) == 7, f"expected 7 categories, got {len(cats)}"
        for c in cats:
            assert "_id" not in c
            assert "slug" in c and "situation_count" in c
            assert isinstance(c["situation_count"], int)
        slugs = [c["slug"] for c in cats]
        assert "restaurant" in slugs

    def test_category_restaurant(self, client):
        r = client.get(f"{API}/categories/restaurant")
        assert r.status_code == 200
        cat = r.json()
        assert cat["slug"] == "restaurant"
        sits = cat["situations"]
        assert len(sits) > 0
        by_slug = {s["slug"]: s for s in sits}
        assert "taking-an-order" in by_slug
        assert by_slug["taking-an-order"].get("is_full") is True
        assert all("_id" not in s for s in sits)

    def test_category_not_found(self, client):
        r = client.get(f"{API}/categories/does-not-exist")
        assert r.status_code == 404

    def test_lesson_taking_an_order(self, client):
        r = client.get(f"{API}/lessons/taking-an-order", headers=premium_headers())
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is True
        lesson = d["lesson"]
        assert lesson["intro"]["summary_es"]
        assert len(lesson["intro"]["objectives_es"]) == 3
        assert len(lesson["phrases"]) == 5
        for p in lesson["phrases"]:
            assert p["id"] and p["english_content"] and p["translations"]["es"]
        assert isinstance(lesson["dialogue"], list) and len(lesson["dialogue"]) > 0
        assert len(lesson["exercises"]) == 3
        types = {e["type"] for e in lesson["exercises"]}
        assert types == {"multiple_choice", "fill_gap", "word_ordering"}
        assert len(lesson["quiz"]) == 5
        for q in lesson["exercises"] + lesson["quiz"]:
            assert q.get("prompt_es")
            assert q.get("explanation_es")
            if q["type"] == "multiple_choice":
                assert isinstance(q["answer_index"], int)
                assert 0 <= q["answer_index"] < len(q["options"])
            elif q["type"] == "fill_gap":
                assert q["answer"] and q["sentence"]
            else:
                assert " ".join(sorted(q["words"])) == " ".join(sorted(q["answer"].split(" ")))

    def test_welcoming_guests_now_authored(self, client):
        # Authored in the 50-situation catalog and Free for waiters (no auth needed).
        r = client.get(f"{API}/lessons/welcoming-guests")
        assert r.status_code == 200
        d = r.json()
        assert d["available"] is True
        assert d["situation"]["slug"] == "welcoming-guests"
        assert d["lesson"]

    def test_lesson_unknown_situation(self, client):
        r = client.get(f"{API}/lessons/nope-nope", headers=premium_headers())
        assert r.status_code == 404


# ---------- Guest / progress endpoints ----------
class TestGuestFlow:
    def test_full_guest_lifecycle(self, client):
        # CREATE
        r = client.post(f"{API}/guests", json={"workplace": "restaurant", "goal": "all"})
        assert r.status_code == 200, r.text
        g = r.json()
        assert "_id" not in g
        gid = g["id"]
        assert isinstance(gid, str) and len(gid) > 10
        assert g["onboarding"] == {"workplace": "restaurant", "goal": "all"}
        assert g["flashcard_interactions"] == []
        assert g["completed_lessons"] == []

        # GET
        r = client.get(f"{API}/guests/{gid}")
        assert r.status_code == 200
        assert r.json()["id"] == gid

        # UPDATE onboarding
        r = client.put(f"{API}/guests/{gid}/onboarding", json={"workplace": "hotel", "goal": "speaking"})
        assert r.status_code == 200
        assert r.json()["onboarding"] == {"workplace": "hotel", "goal": "speaking"}

        # flashcard
        r = client.post(f"{API}/guests/{gid}/flashcard",
                        json={"learning_item_id": "TEST_phrase_1", "knew": True})
        assert r.status_code == 200 and r.json() == {"ok": True}

        # completion
        r = client.post(f"{API}/guests/{gid}/complete",
                        json={"situation_slug": "taking-an-order", "score": 4, "total": 5})
        assert r.status_code == 200 and r.json() == {"ok": True}

        # persistence check
        r = client.get(f"{API}/guests/{gid}")
        data = r.json()
        assert len(data["flashcard_interactions"]) == 1
        assert data["flashcard_interactions"][0]["learning_item_id"] == "TEST_phrase_1"
        assert data["flashcard_interactions"][0]["knew"] is True
        assert len(data["completed_lessons"]) == 1
        assert data["completed_lessons"][0] == {
            **{"situation_slug": "taking-an-order", "score": 4, "total": 5},
            "at": data["completed_lessons"][0]["at"],
        }
        assert data["onboarding"]["workplace"] == "hotel"

    def test_guest_not_found(self, client):
        assert client.get(f"{API}/guests/missing-id").status_code == 404
        assert client.put(f"{API}/guests/missing-id/onboarding", json={"workplace": "a", "goal": "b"}).status_code == 404
        assert client.post(f"{API}/guests/missing-id/flashcard", json={"learning_item_id": "x", "knew": False}).status_code == 404
        assert client.post(f"{API}/guests/missing-id/complete", json={"situation_slug": "x", "score": 1, "total": 2}).status_code == 404

    def test_validation_errors(self, client):
        r = client.post(f"{API}/guests", json={})
        assert r.status_code == 200  # both fields optional by design
        gid = r.json()["id"]
        bad = client.post(f"{API}/guests/{gid}/flashcard", json={"knew": True})
        assert bad.status_code == 422
        bad2 = client.post(f"{API}/guests/{gid}/complete", json={"situation_slug": "x", "score": "abc", "total": 5})
        assert bad2.status_code == 422
