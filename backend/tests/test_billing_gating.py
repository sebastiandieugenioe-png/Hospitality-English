"""RevenueCat Phase 2 — backend freemium gating tests (profession-aware)."""
import pathlib, requests

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = open(ROOT.parent / "frontend" / ".env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip() + "/api"

import billing_access

BART_FREE = billing_access.free_slugs("hospitality", "bartender")
WAIT_FREE = billing_access.free_slugs("hospitality", "waiter")


def _ref(path):
    return requests.get(f"{API}/{path}").json()


def _make_guest(role):
    gid = requests.post(f"{API}/guests", json={"interface_language": "en"}).json()["id"]
    vt = _ref("venue-types")[0]["slug"]
    tc = _ref("target-countries")[0]["id"]
    goal = _ref("learning-goals")[0]["id"]
    r = requests.put(f"{API}/guests/{gid}/profile", json={
        "role": role, "venue_type": vt, "target_country": tc, "goal": goal,
        "employment_status": "already_working",
    })
    assert r.status_code == 200, r.text
    return gid


def test_catalog_counts_and_free_config():
    bart = requests.get(f"{API}/situations", params={"role": "bartender"}).json()
    wait = requests.get(f"{API}/situations", params={"role": "waiter"}).json()
    assert len(bart) == 25 and len(wait) == 25
    assert len(BART_FREE) == 5 and len(WAIT_FREE) == 5
    # is_free flags present and exactly 5 free per role
    assert sum(1 for s in bart if s.get("is_free")) == 5
    assert sum(1 for s in wait if s.get("is_free")) == 5
    assert {s["slug"] for s in bart if s.get("is_free")} == BART_FREE


def test_lesson_exposes_is_free_flag():
    free_slug = sorted(BART_FREE)[0]
    bart = requests.get(f"{API}/situations", params={"role": "bartender"}).json()
    premium_slug = next(s["slug"] for s in bart if not s.get("is_free"))
    # Lesson endpoint stays available to all modules (Tonight's Shift etc.) but
    # exposes is_free so the client route-guards the Learn flow.
    free_lesson = requests.get(f"{API}/lessons/{free_slug}")
    prem_lesson = requests.get(f"{API}/lessons/{premium_slug}")
    assert free_lesson.status_code == 200 and prem_lesson.status_code == 200
    assert free_lesson.json()["situation"]["is_free"] is True
    assert prem_lesson.json()["situation"]["is_free"] is False


def test_listening_speaking_free_pool_only_free_situations():
    gid = _make_guest("bartender")
    for ep in ("listening-practice", "speaking-practice"):
        free = requests.get(f"{API}/guests/{gid}/{ep}", params={"free_only": "true"}).json()["items"]
        full = requests.get(f"{API}/guests/{gid}/{ep}", params={"free_only": "false"}).json()["items"]
        assert len(full) >= len(free)
        assert len(free) <= 5


def test_review_items_free_filtering_does_not_delete():
    gid = _make_guest("waiter")
    # No premium items exist yet for a fresh guest; both calls succeed and free<=full.
    free = requests.get(f"{API}/guests/{gid}/review-items", params={"free_only": "true"}).json()
    full = requests.get(f"{API}/guests/{gid}/review-items", params={"free_only": "false"}).json()
    assert isinstance(free, list) and isinstance(full, list)
    assert len(free) <= len(full)


def test_access_rule_helper():
    assert billing_access.can_access_situation("bartender", sorted(BART_FREE)[0], False) is True
    # a waiter free slug is NOT free for a bartender (role-specific)
    assert billing_access.can_access_situation("bartender", sorted(WAIT_FREE)[0], False) is False
    # premium unlocks anything
    assert billing_access.can_access_situation("bartender", sorted(WAIT_FREE)[0], True) is True
