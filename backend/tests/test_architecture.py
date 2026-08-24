"""Tests for the additive, backwards-compatible architecture evolution.

Covers new reference collections, professional-profile support on guests, and
verifies existing content endpoints still expose their original shape plus the
new optional metadata fields (without breaking).
"""
import os
import requests
from dotenv import dotenv_values

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
        codes = {c["code"] for c in r.json()}
        assert {"US", "UK"}.issubset(codes)
        for c in r.json():
            assert c["english_variant"]

    def test_skills(self):
        r = requests.get(f"{API}/skills")
        assert r.status_code == 200
        slugs = {s["slug"] for s in r.json()}
        assert "taking-orders" in slugs


class TestBackwardsCompatibleContent:
    def test_situation_has_optional_metadata(self):
        r = requests.get(f"{API}/categories/restaurant")
        assert r.status_code == 200
        by_slug = {s["slug"]: s for s in r.json()["situations"]}
        tao = by_slug["taking-an-order"]
        # New optional fields present and correctly typed.
        assert tao["roles"] == ["waiter"]
        assert "taking-orders" in tao["skills"]
        assert set(tao["country_variants"]) == {"US", "UK"}
        # Original fields untouched.
        assert tao["is_full"] is True and tao["title_en"] == "Taking an order"

    def test_lesson_word_ordering_data_consistent(self):
        r = requests.get(f"{API}/lessons/taking-an-order")
        lesson = r.json()["lesson"]
        for q in lesson["exercises"] + lesson["quiz"]:
            if q["type"] == "word_ordering":
                assert " ".join(sorted(q["words"])) == " ".join(sorted(q["answer"].split(" ")))


class TestProfessionalProfile:
    def test_guest_has_profile_and_placeholders(self):
        r = requests.post(f"{API}/guests", json={"workplace": "bar", "goal": "all", "role": "bartender"})
        assert r.status_code == 200
        g = r.json()
        # Existing shape preserved.
        assert g["onboarding"] == {"workplace": "bar", "goal": "all"}
        assert g["flashcard_interactions"] == [] and g["completed_lessons"] == []
        # New additive structures.
        assert g["professional_profile"]["role"] == "bartender"
        assert g["professional_profile"]["skills"] == []
        assert g["situation_attempts"] == [] and g["mistake_bank"] == [] and g["srs"] == {}
        gid = g["id"]

        # Update profile.
        r = requests.put(f"{API}/guests/{gid}/profile",
                         json={"venue_type": "cocktail-bar", "country": "UK", "skills": ["taking-orders"]})
        assert r.status_code == 200
        prof = r.json()["professional_profile"]
        assert prof["venue_type"] == "cocktail-bar"
        assert prof["country"] == "UK"
        assert prof["skills"] == ["taking-orders"]
        assert prof["role"] == "bartender"  # untouched

    def test_profile_update_missing_guest(self):
        r = requests.put(f"{API}/guests/nope/profile", json={"role": "waiter"})
        assert r.status_code == 404

    def test_guest_create_without_role_still_works(self):
        r = requests.post(f"{API}/guests", json={"workplace": "restaurant", "goal": "vocabulary"})
        assert r.status_code == 200
        assert r.json()["professional_profile"]["role"] is None
