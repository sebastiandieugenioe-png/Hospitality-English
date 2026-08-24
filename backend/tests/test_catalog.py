"""Content integrity + functional tests for the Skills -> Situations -> Lessons catalog."""
import os
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

VALID_LEVELS = {"a1", "a2", "b1", "b2"}
VALID_DIFF = {1, 2, 3}
PILOT = [
    "guest-asks-for-cocktail-recommendation",
    "guest-wants-something-less-sweet",
    "guest-says-cocktail-is-too-sweet",
    "guest-asks-for-food-recommendation",
    "guest-mentions-a-nut-allergy",
    "food-is-taking-longer-than-expected",
]


def _skills():
    return requests.get(f"{API}/skills").json()


def _situations(**params):
    return requests.get(f"{API}/situations", params=params).json()


class TestSkillsFiltering:
    def test_bartender_skills(self):
        ids = {s["id"] for s in requests.get(f"{API}/skills", params={"role": "bartender"}).json()}
        assert {"recommendations", "cocktail-descriptions", "complaints"}.issubset(ids)

    def test_waiter_skills(self):
        ids = {s["id"] for s in requests.get(f"{API}/skills", params={"role": "waiter"}).json()}
        assert {"recommendations", "food-descriptions", "seating-guests"}.issubset(ids)

    def test_bartender_does_not_see_seating_guests(self):
        ids = {s["id"] for s in requests.get(f"{API}/skills", params={"role": "bartender"}).json()}
        assert "seating-guests" not in ids

    def test_waiter_does_not_see_cocktail_descriptions(self):
        ids = {s["id"] for s in requests.get(f"{API}/skills", params={"role": "waiter"}).json()}
        assert "cocktail-descriptions" not in ids

    def test_invalid_role_422(self):
        assert requests.get(f"{API}/skills", params={"role": "chef"}).status_code == 422


class TestSituationsFiltering:
    def test_by_skill(self):
        slugs = {s["slug"] for s in _situations(role="bartender", skill="recommendations")}
        assert "guest-asks-for-cocktail-recommendation" in slugs
        assert "guest-wants-something-less-sweet" in slugs

    def test_by_role(self):
        waiter = {s["slug"] for s in _situations(role="waiter")}
        bartender = {s["slug"] for s in _situations(role="bartender")}
        assert "guest-asks-for-food-recommendation" in waiter
        assert "guest-asks-for-cocktail-recommendation" not in waiter
        assert "guest-asks-for-cocktail-recommendation" in bartender

    def test_by_venue(self):
        slugs = {s["slug"] for s in _situations(role="bartender", venue_type="cocktail-bar")}
        assert "guest-asks-for-cocktail-recommendation" in slugs

    def test_empty_venue_types_visible_everywhere(self):
        # All active pilot situations declare venues; assert the rule directly:
        for s in _situations():
            if not s.get("venue_types"):
                # would be visible for any venue filter
                any_venue = {x["slug"] for x in _situations(venue_type="cafe")}
                assert s["slug"] in any_venue

    def test_invalid_filters_422(self):
        assert requests.get(f"{API}/situations", params={"skill": "nope"}).status_code == 422
        assert requests.get(f"{API}/situations", params={"venue_type": "moon"}).status_code == 422


class TestContentIntegrity:
    def test_skills_unique_and_roles_valid(self):
        skills = _skills()
        ids = [s["id"] for s in skills]
        assert len(ids) == len(set(ids)), "skill ids must be unique"
        valid_roles = {p["slug"] for p in requests.get(f"{API}/professional-profiles").json()}
        for s in skills:
            assert set(s["roles"]).issubset(valid_roles), f"{s['id']} has invalid roles"

    def test_active_situations_integrity(self):
        skill_ids = {s["id"] for s in _skills()}
        venue_ids = {v["slug"] for v in requests.get(f"{API}/venue-types").json()}
        role_ids = {p["slug"] for p in requests.get(f"{API}/professional-profiles").json()}
        situations = _situations()  # all active
        slugs = [s["slug"] for s in situations]
        assert len(slugs) == len(set(slugs)), "situation slugs must be unique"
        for s in situations:
            assert s["roles"] and set(s["roles"]).issubset(role_ids), f"{s['slug']} roles invalid"
            assert s["primary_skill"] in skill_ids, f"{s['slug']} primary_skill invalid"
            assert s["primary_skill"] in s["skills"], f"{s['slug']} primary_skill not in skills[]"
            assert set(s["skills"]).issubset(skill_ids), f"{s['slug']} secondary skills invalid"
            assert set(s.get("venue_types", [])).issubset(venue_ids), f"{s['slug']} venue_types invalid"
            assert s["level"] in VALID_LEVELS, f"{s['slug']} level invalid"
            assert s["difficulty"] in VALID_DIFF, f"{s['slug']} difficulty invalid"
            # lesson must be accessible
            r = requests.get(f"{API}/lessons/{s['slug']}")
            assert r.status_code == 200 and r.json().get("available") is True, f"{s['slug']} lesson missing"

    def test_taking_an_order_no_regression(self):
        d = requests.get(f"{API}/lessons/taking-an-order").json()
        assert d["available"] is True
        assert len(d["lesson"]["phrases"]) == 5
        assert len(d["lesson"]["quiz"]) == 5
        sit = requests.get(f"{API}/situations/taking-an-order").json()
        assert sit["primary_skill"] == "taking-orders" and "waiter" in sit["roles"]

    def test_six_new_lessons_load(self):
        for slug in PILOT:
            d = requests.get(f"{API}/lessons/{slug}").json()
            assert d["available"] is True, f"{slug} lesson not available"
            lesson = d["lesson"]
            assert 5 <= len(lesson["phrases"]) <= 8
            assert 6 <= len(lesson["dialogue"]) <= 10
            assert len(lesson["quiz"]) == 5
            types = {e["type"] for e in lesson["exercises"]}
            assert types == {"multiple_choice", "fill_gap", "word_ordering"}
            for q in lesson["exercises"] + lesson["quiz"]:
                if q["type"] == "word_ordering":
                    # Chips may be multi-word; compare underlying token multisets.
                    joined = " ".join(q["words"]).split()
                    assert sorted(joined) == sorted(q["answer"].split(" ")), f"{slug} {q['id']} word mismatch"

    def test_service_english_metadata_optional(self):
        # New lesson carries service metadata; legacy learning items still work without it.
        lesson = requests.get(f"{API}/lessons/guest-says-cocktail-is-too-sweet").json()["lesson"]
        with_meta = [p for p in lesson["phrases"] if p.get("service_rating")]
        assert with_meta, "expected at least one phrase with Service English metadata"
        bad = [p for p in lesson["phrases"] if p.get("service_rating") == "inappropriate"]
        assert bad and bad[0].get("natural_alternatives"), "inappropriate phrase should offer alternatives"
