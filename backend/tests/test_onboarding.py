"""Tests for the Professional Onboarding feature (profile persistence + backwards compat)."""
import os
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

VALID = {"role": "bartender", "venue_type": "cocktail-bar", "target_country": "ireland", "goal": "work_abroad"}


def _create_guest():
    r = requests.post(f"{API}/guests", json={})
    assert r.status_code == 200
    return r.json()["id"]


class TestOnboarding:
    def test_create_new_guest(self):
        r = requests.post(f"{API}/guests", json={})
        assert r.status_code == 200
        g = r.json()
        assert isinstance(g["id"], str) and len(g["id"]) > 10
        assert g["onboarding_completed"] is False
        assert g["completed_lessons"] == [] and g["flashcard_interactions"] == []

    def test_complete_profile_and_persist(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json=VALID)
        assert r.status_code == 200, r.text
        g = r.json()
        assert g["onboarding_completed"] is True
        assert g["professional_profile"] == {**VALID, "english_level": None, "employment_status": None}
        # Persistence: re-fetch.
        g2 = requests.get(f"{API}/guests/{gid}").json()
        assert g2["professional_profile"] == {**VALID, "english_level": None, "employment_status": None}
        assert g2["onboarding_completed"] is True

    def test_invalid_role_rejected(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json={**VALID, "role": "anything"})
        assert r.status_code == 422
        assert "role" in r.json()["detail"]

    def test_invalid_venue_rejected(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json={**VALID, "venue_type": "space-station"})
        assert r.status_code == 422
        assert "venue_type" in r.json()["detail"]

    def test_invalid_country_rejected(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json={**VALID, "target_country": "narnia"})
        assert r.status_code == 422
        assert "target_country" in r.json()["detail"]

    def test_invalid_goal_rejected(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json={**VALID, "goal": "become_rich"})
        assert r.status_code == 422
        assert "goal" in r.json()["detail"]

    def test_missing_required_field_422(self):
        gid = _create_guest()
        r = requests.put(f"{API}/guests/{gid}/profile", json={"role": "waiter"})
        assert r.status_code == 422


class TestExistingGuestBackwardsCompat:
    def _seed_old_guest_with_progress(self):
        gid = _create_guest()
        # Simulate an existing user's progress.
        requests.post(f"{API}/guests/{gid}/flashcard",
                      json={"learning_item_id": "li_take_order_ready", "knew": True})
        requests.post(f"{API}/guests/{gid}/complete",
                      json={"situation_slug": "taking-an-order", "score": 5, "total": 5})
        return gid

    def test_old_guest_keeps_completed_lessons(self):
        gid = self._seed_old_guest_with_progress()
        requests.put(f"{API}/guests/{gid}/profile", json=VALID)
        g = requests.get(f"{API}/guests/{gid}").json()
        assert len(g["completed_lessons"]) == 1
        assert g["completed_lessons"][0]["situation_slug"] == "taking-an-order"

    def test_old_guest_keeps_flashcard_interactions(self):
        gid = self._seed_old_guest_with_progress()
        requests.put(f"{API}/guests/{gid}/profile", json=VALID)
        g = requests.get(f"{API}/guests/{gid}").json()
        assert len(g["flashcard_interactions"]) == 1
        assert g["flashcard_interactions"][0]["learning_item_id"] == "li_take_order_ready"

    def test_completing_onboarding_does_not_change_guest_id(self):
        gid = self._seed_old_guest_with_progress()
        r = requests.put(f"{API}/guests/{gid}/profile", json=VALID)
        assert r.json()["id"] == gid


class TestNoRegressions:
    def test_reference_endpoints_ok(self):
        for path in ["professional-profiles", "venue-types", "target-countries", "skills", "learning-goals"]:
            assert requests.get(f"{API}/{path}").status_code == 200

    def test_lesson_endpoints_ok(self):
        assert requests.get(f"{API}/categories").status_code == 200
        assert requests.get(f"{API}/lessons/taking-an-order", headers=premium_headers()).json()["available"] is True
        # welcoming-guests is a free waiter situation and is fully authored.
        assert requests.get(f"{API}/lessons/welcoming-guests", headers=premium_headers()).json()["available"] is True
