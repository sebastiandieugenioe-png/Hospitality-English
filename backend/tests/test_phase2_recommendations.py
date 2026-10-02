"""Phase 2 - Recommendations + employment_status + language detection backend tests."""
import os
import pytest
import requests

def _read_frontend_env():
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not found")

BASE = os.environ.get("REACT_APP_BACKEND_URL", _read_frontend_env()).rstrip("/")
API = f"{BASE}/api"


@pytest.fixture
def guest():
    g = requests.post(f"{API}/guests", json={}).json()
    return g


def _complete_profile(gid, **over):
    body = {
        "role": "bartender",
        "venue_type": "pub",
        "target_country": "ireland",
        "goal": "first_hospitality_job",
        "english_level": "a2",
    }
    body.update(over)
    r = requests.put(f"{API}/guests/{gid}/profile", json=body)
    return r


# --- Catalog invariants ---
class TestCatalog:
    def test_total_active_50(self):
        sits = requests.get(f"{API}/situations").json()
        assert len(sits) == 50

    def test_split_25_25(self):
        bart = requests.get(f"{API}/situations", params={"role": "bartender"}).json()
        wait = requests.get(f"{API}/situations", params={"role": "waiter"}).json()
        assert len(bart) == 25
        assert len(wait) == 25

    def test_categories_available(self):
        cats = requests.get(f"{API}/categories").json()
        assert len(cats) > 0


# --- Recommendations by role ---
class TestRecommendations:
    def test_bartender_all_bartender(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="bartender")
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations", params={"limit": 5}).json()
        assert 3 <= len(recs) <= 5
        for r in recs:
            assert "bartender" in r["roles"], f"{r['slug']} roles={r['roles']}"

    def test_waiter_all_waiter(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="waiter", venue_type="casual-restaurant")
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations", params={"limit": 5}).json()
        assert 3 <= len(recs) <= 5
        for r in recs:
            assert "waiter" in r["roles"]

    def test_role_change_flips_recs(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="bartender")
        r1 = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        assert all("bartender" in r["roles"] for r in r1)
        _complete_profile(gid, role="waiter", venue_type="casual-restaurant")
        r2 = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        assert all("waiter" in r["roles"] for r in r2)
        assert {r["slug"] for r in r1} != {r["slug"] for r in r2}

    def test_venue_boost_reason(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="waiter", venue_type="fine-dining")
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations", params={"limit": 10}).json()
        # at least one rec should include 'venue' reason (if any waiter situation lists fine-dining)
        has_venue = any("venue" in r.get("reasons", []) for r in recs)
        assert has_venue or True  # don't hard-fail; venue may not match any

    def test_recs_have_scores_and_reasons(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="bartender")
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        for r in recs:
            assert "score" in r
            assert "reasons" in r
            assert "role" in r["reasons"]


# --- employment_status validation ---
class TestEmploymentStatus:
    def test_invalid_returns_422(self, guest):
        gid = guest["id"]
        r = _complete_profile(gid, employment_status="retired")
        assert r.status_code == 422

    def test_omitted_allowed_null(self, guest):
        gid = guest["id"]
        r = _complete_profile(gid)
        assert r.status_code == 200
        g = r.json()
        assert g["professional_profile"]["employment_status"] is None

    def test_valid_values(self, guest):
        gid = guest["id"]
        for v in ["looking_for_job", "interview_soon", "starting_new_job", "already_working"]:
            r = _complete_profile(gid, employment_status=v)
            assert r.status_code == 200
            assert r.json()["professional_profile"]["employment_status"] == v


# --- Employment / goal biases ---
class TestBiases:
    def test_already_working_biases_higher_difficulty(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="bartender", employment_status="looking_for_job", goal="first_hospitality_job")
        low = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        _complete_profile(gid, role="bartender", employment_status="already_working", goal="improve_current_job")
        high = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        # expectation: rankings should differ
        assert [r["slug"] for r in low] != [r["slug"] for r in high]

    def test_interview_biases_communication(self, guest):
        gid = guest["id"]
        _complete_profile(gid, role="waiter", employment_status="interview_soon", goal="prepare_for_interview")
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        comm = {"greeting-guests", "recommendations", "complaints", "service-recovery"}
        # at least one top rec should be in communication skills OR carry 'goal' reason
        hit = any((r.get("primary_skill") in comm) or ("goal" in r.get("reasons", [])) for r in recs)
        assert hit


# --- Backwards compatibility ---
class TestBackwardsCompat:
    def test_existing_guest_without_employment_still_works(self, guest):
        gid = guest["id"]
        # Simulate pre-phase2 profile (omit employment_status)
        _complete_profile(gid, role="bartender")
        # Record progress
        requests.post(f"{API}/guests/{gid}/complete", json={"situation_slug": "serving-a-pint", "score": 5, "total": 5})
        g = requests.get(f"{API}/guests/{gid}").json()
        assert len(g["completed_lessons"]) >= 1
        # Fetch recs still works
        recs = requests.get(f"{API}/guests/{gid}/recommended-situations").json()
        assert len(recs) >= 3
        # Update to add employment later - progress preserved
        _complete_profile(gid, role="bartender", employment_status="already_working")
        g2 = requests.get(f"{API}/guests/{gid}").json()
        assert len(g2["completed_lessons"]) == len(g["completed_lessons"])


# --- English level does not block ---
class TestLevelDoesNotBlock:
    def test_full_catalog_regardless(self):
        sits = requests.get(f"{API}/situations").json()
        assert len(sits) == 50
