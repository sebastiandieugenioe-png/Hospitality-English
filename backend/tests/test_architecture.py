"""Tests for the additive, backwards-compatible architecture evolution.

Covers new reference collections, professional-profile support on guests, and
verifies existing content endpoints still expose their original shape plus the
new optional metadata fields (without breaking).
"""
import os
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"


class TestReferenceData:
    def test_professional_profiles(self):
        r = requests.get(f"{API}/professional-profiles")
        assert r.status_code == 200
        profiles = r.json()
        slugs = {p["slug"] for p in profiles}
        assert {"bartender", "waiter"}.issubset(slugs)
        for p in profiles:
            assert "_id" not in p
            assert p["name_en"] and p["name_es"]
            assert isinstance(p["related_categories"], list)

    def test_venue_types(self):
        r = requests.get(f"{API}/venue-types")
        assert r.status_code == 200
        assert len(r.json()) >= 4
        assert all("_id" not in v for v in r.json())

    def test_target_countries(self):
        r = requests.get(f"{API}/target-countries")
        assert r.status_code == 200
        ids = {c["id"] for c in r.json()}
        assert {"ireland", "united_kingdom", "united_states", "international"}.issubset(ids)
        for c in r.json():
            assert c["english_variant"] and c["name_es"] and c["flag"]

    def test_skills(self):
        r = requests.get(f"{API}/skills")
        assert r.status_code == 200
        ids = {s["id"] for s in r.json()}
        assert "taking-orders" in ids

    def test_learning_goals(self):
        r = requests.get(f"{API}/learning-goals")
        assert r.status_code == 200
        ids = {g["id"] for g in r.json()}
        assert {"first_hospitality_job", "work_abroad"}.issubset(ids)
        assert all(g["name_es"] for g in r.json())


class TestBackwardsCompatibleContent:
    def test_situation_has_optional_metadata(self):
        r = requests.get(f"{API}/categories/restaurant")
        assert r.status_code == 200
        by_slug = {s["slug"]: s for s in r.json()["situations"]}
        tao = by_slug["taking-an-order"]
        # New optional fields present and correctly typed.
        assert tao["roles"] == ["waiter"]
        assert "taking-orders" in tao["skills"]
        assert set(tao["country_variants"]) == {"united_states", "united_kingdom"}
        # Original fields untouched.
        assert tao["is_full"] is True and tao["title_en"] == "Taking an order"

    def test_lesson_word_ordering_data_consistent(self):
        r = requests.get(f"{API}/lessons/taking-an-order", headers=premium_headers())
        lesson = r.json()["lesson"]
        for q in lesson["exercises"] + lesson["quiz"]:
            if q["type"] == "word_ordering":
                assert " ".join(sorted(q["words"])) == " ".join(sorted(q["answer"].split(" ")))


class TestProfessionalProfile:
    def test_new_guest_has_empty_profile(self):
        r = requests.post(f"{API}/guests", json={})
        assert r.status_code == 200
        g = r.json()
        prof = g["professional_profile"]
        assert prof == {"role": None, "venue_type": None, "target_country": None, "goal": None, "english_level": None}
        assert g["onboarding_completed"] is False
        # Placeholders are no longer part of the definitive architecture.
        assert "situation_attempts" not in g and "mistake_bank" not in g and "srs" not in g

    def test_profile_update_missing_guest(self):
        r = requests.put(f"{API}/guests/nope/profile", json={
            "role": "waiter", "venue_type": "fine-dining", "target_country": "ireland", "goal": "work_abroad"})
        assert r.status_code == 404
