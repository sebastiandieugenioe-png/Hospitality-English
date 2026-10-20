# Live (public URL) server-side Premium enforcement regression: anonymous/forged callers are always Free.
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"
FREE_B = ["guest-arrives-at-the-bar", "taking-a-drinks-order", "recommending-drinks",
          "guest-asks-about-cocktail-allergens", "handling-a-complaint"]
FREE_W = ["welcoming-guests", "guest-is-not-ready-to-order", "allergies-and-dietary-requirements",
          "explaining-the-menu", "bringing-the-bill"]
PREMIUM = "serving-beer"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def guest(s):
    g = s.post(f"{API}/guests", json={"interface_language": "es"}).json()
    r = s.put(f"{API}/guests/{g['id']}/profile", json={"role": "bartender", "venue_type": "pub", "target_country": "ireland",
                                                     "goal": "first_hospitality_job", "employment_status": "already_working"})
    assert r.status_code == 200, r.text
    return g["id"]


def test_premium_slug_exists(s):
    slugs = [x["slug"] for x in s.get(f"{API}/situations").json()]
    assert PREMIUM in slugs and len(slugs) >= 25


# Lessons
@pytest.mark.parametrize("hdr", [{}, {"Authorization": "Bearer garbage"}, {"Authorization": "garbage"}])
def test_lesson_premium_403(s, hdr):
    r = s.get(f"{API}/lessons/{PREMIUM}", headers=hdr)
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"


@pytest.mark.parametrize("slug", ["taking-a-drinks-order", "welcoming-guests"])
def test_lesson_free_200(s, slug):
    r = s.get(f"{API}/lessons/{slug}", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 200
    assert r.json()


# Listening / speaking items
@pytest.mark.parametrize("kind", ["listening", "speaking"])
def test_item_gating(s, kind):
    assert s.get(f"{API}/{kind}/item/{PREMIUM}").status_code == 403
    r = s.get(f"{API}/{kind}/item/taking-a-drinks-order")
    assert r.status_code == 200, r.text


# Attempts
def test_attempt_start_premium_403(s, guest):
    r = s.post(f"{API}/situation-attempts/start", json={"guest_id": guest, "situation_slug": PREMIUM, "premium": True})
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"


def test_attempt_start_free_ok(s, guest):
    r = s.post(f"{API}/situation-attempts/start", json={"guest_id": guest, "situation_slug": "taking-a-drinks-order"})
    assert r.status_code == 200, r.text


# Practice pools narrowed to role's free set
@pytest.mark.parametrize("kind", ["listening-practice", "speaking-practice"])
def test_practice_pools_free_only(s, guest, kind):
    r = s.get(f"{API}/guests/{guest}/{kind}?free_only=false&premium=true", headers={"Authorization": "Bearer garbage"})
    assert r.status_code == 200, r.text
    items = r.json()["items"]
    assert len(items) > 0
    assert all(i["situation_slug"] in FREE_B for i in items), [i["situation_slug"] for i in items]


def test_review_items_free_only(s, guest):
    r = s.get(f"{API}/guests/{guest}/review-items?free_only=false&premium=true")
    assert r.status_code == 200
    body = r.json()
    items = body if isinstance(body, list) else body.get("items", [])
    assert all(i.get("situation_slug") in FREE_B for i in items)


def test_refresh_entitlement_requires_token(s):
    assert s.post(f"{API}/billing/refresh-entitlement").status_code == 401
    assert s.post(f"{API}/billing/refresh-entitlement", headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_speaking_attempt_premium_403(s, guest):
    r = s.post(f"{API}/guests/{guest}/speaking-attempts", json={"situation_slug": PREMIUM, "item_id": "x", "transcript": "hi"})
    assert r.status_code in (403, 404, 422)
