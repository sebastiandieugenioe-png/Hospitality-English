"""Server-side Premium enforcement (attack + functional cases). RevenueCat and Firebase are mocked."""
import asyncio
import os
import sys
import uuid

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import server  # noqa: E402
import premium_access  # noqa: E402
import billing_access  # noqa: E402
import firebase_admin_setup  # noqa: E402

ENT = "hospitality_premium"
REAL_FETCH = premium_access._fetch_active_entitlements
RUN = uuid.uuid4().hex[:8]
USERS = {}  # token -> dict(uid, user_id, guest_id)


def _claims(token):
    if token == "tok_anon":
        return {"uid": f"anon_{RUN}", "firebase": {"sign_in_provider": "anonymous"}}
    if token in USERS:
        return {"uid": USERS[token]["uid"], "firebase": {"sign_in_provider": "google.com"}}
    raise ValueError("invalid token")


async def _fake_fetch(user_id):
    if user_id == USERS.get("tok_premium_b", {}).get("user_id") or user_id == USERS.get("tok_premium_w", {}).get("user_id"):
        return {ENT}
    if user_id == USERS.get("tok_error", {}).get("user_id"):
        return None  # RevenueCat unavailable
    return set()


@pytest.fixture(scope="module")
def client():
    mp = pytest.MonkeyPatch()
    mp.setattr(firebase_admin_setup, "verify_token", _claims)
    mp.setattr(premium_access, "_fetch_active_entitlements", _fake_fetch)
    c = TestClient(server.app)
    c.__enter__()  # single event loop for motor across requests
    for token, role in [("tok_free_b", "bartender"), ("tok_free_w", "waiter"), ("tok_premium_b", "bartender"),
                        ("tok_premium_w", "waiter"), ("tok_error", "bartender")]:
        g = c.post("/api/guests", json={"interface_language": "en"}).json()
        c.put(f"/api/guests/{g['id']}/profile", json={"role": role, "venue_type": "pub", "target_country": "ireland",
                                                    "goal": "first_hospitality_job", "employment_status": "already_working"})
        uid, user_id = f"uid_{token}_{RUN}", f"usr_test_{token}_{RUN}"
        USERS[token] = {"uid": uid, "user_id": user_id, "guest_id": g["id"], "role": role}

    from pymongo import MongoClient
    mdb = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    for u in USERS.values():
        mdb.users.insert_one({"id": u["user_id"], "firebase_uid": u["uid"], "providers": ["google.com"],
                              "profile_ids_by_profession": {"hospitality": u["guest_id"]}})
        mdb.guests.update_one({"id": u["guest_id"]}, {"$set": {"user_id": u["user_id"], "auth_state": "linked"}})
    premium_access._cache.clear()
    yield c
    for u in USERS.values():
        mdb.users.delete_one({"id": u["user_id"]})
    c.__exit__(None, None, None)
    mp.undo()


def H(token):
    return {"Authorization": f"Bearer {token}"} if token else {}


def role_slugs(c, role):
    return [s["slug"] for s in c.get("/api/situations", params={"role": role}).json() if role in (s.get("roles") or [])]


def _lesson_status(c, slug, token):
    return c.get(f"/api/lessons/{slug}", headers=H(token)).status_code


# ---------- attack cases ----------
def test_case1_free_user_free_only_false_still_free(client):
    u = USERS["tok_free_b"]
    free = billing_access.free_slugs("hospitality", "bartender")
    for path in ("listening-practice", "speaking-practice"):
        items = client.get(f"/api/guests/{u['guest_id']}/{path}", params={"free_only": "false"}, headers=H("tok_free_b")).json()["items"]
        assert items and all(i["situation_slug"] in free for i in items)


def test_case2_fake_premium_params_ignored(client):
    u = USERS["tok_free_b"]
    free = billing_access.free_slugs("hospitality", "bartender")
    params = {"free_only": "false", "premium": "true", "is_premium": "true", "entitlement": ENT}
    items = client.get(f"/api/guests/{u['guest_id']}/listening-practice", params=params, headers=H("tok_free_b")).json()["items"]
    assert all(i["situation_slug"] in free for i in items)
    locked = next(s for s in role_slugs(client, "bartender") if s not in free)
    assert client.get(f"/api/lessons/{locked}", params=params, headers=H("tok_free_b")).status_code == 403
    r = client.post("/api/situation-attempts/start", json={"guest_id": u["guest_id"], "situation_slug": locked, "premium": True, "is_premium": True},
                    headers=H("tok_free_b"))
    assert r.status_code == 403


def test_case3_premium_full_pool(client):
    for token, role in (("tok_premium_b", "bartender"), ("tok_premium_w", "waiter")):
        u = USERS[token]
        free = billing_access.free_slugs("hospitality", role)
        slugs = role_slugs(client, role)
        assert len(slugs) == 25
        assert all(_lesson_status(client, s, token) == 200 for s in slugs)
        items = client.get(f"/api/guests/{u['guest_id']}/listening-practice", headers=H(token)).json()["items"]
        assert any(i["situation_slug"] not in free for i in items)


def test_case4_guest_free_pool(client):
    g = client.post("/api/guests", json={"interface_language": "en"}).json()
    client.put(f"/api/guests/{g['id']}/profile", json={"role": "waiter", "venue_type": "pub", "target_country": "ireland",
                                                     "goal": "first_hospitality_job", "employment_status": "already_working"})
    free = billing_access.free_slugs("hospitality", "waiter")
    for tok in (None, "tok_anon"):
        items = client.get(f"/api/guests/{g['id']}/speaking-practice", params={"free_only": "false"}, headers=H(tok)).json()["items"]
        assert all(i["situation_slug"] in free for i in items)
        locked = next(s for s in role_slugs(client, "waiter") if s not in free)
        assert _lesson_status(client, locked, tok) == 403


def test_case5_revenuecat_error_never_premium(client):
    u = USERS["tok_error"]
    free = billing_access.free_slugs("hospitality", "bartender")
    items = client.get(f"/api/guests/{u['guest_id']}/listening-practice", params={"free_only": "false"}, headers=H("tok_error")).json()["items"]
    assert all(i["situation_slug"] in free for i in items)
    assert u["user_id"] not in premium_access._cache  # unknown is never cached


def test_case5b_missing_secret_or_http_error_fails_closed(monkeypatch):
    real = premium_access.__dict__.get("_real_fetch") or REAL_FETCH
    monkeypatch.delenv("REVENUECAT_SECRET_API_KEY", raising=False)
    assert asyncio.run(real("usr_x")) is None
    monkeypatch.setenv("REVENUECAT_SECRET_API_KEY", "sk_test_dummy")

    class Boom:
        def __init__(self, *a, **k): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *a): return False
        async def get(self, *a, **k): raise premium_access.httpx.ConnectError("down")
    monkeypatch.setattr(premium_access.httpx, "AsyncClient", Boom)
    assert asyncio.run(real("usr_x")) is None


def test_case6_unknown_user_and_invalid_token(client):
    locked = next(s for s in role_slugs(client, "bartender") if s not in billing_access.free_slugs("hospitality", "bartender"))
    assert _lesson_status(client, locked, "tok_nonexistent") == 403
    assert client.post("/api/billing/refresh-entitlement", headers=H("tok_nonexistent")).status_code == 401


def test_case7_cross_user_guest_cannot_borrow_entitlement(client):
    free_u, prem = USERS["tok_free_b"], USERS["tok_premium_b"]
    free = billing_access.free_slugs("hospitality", "bartender")
    # Premium token used on someone else's guest -> not premium for that guest.
    items = client.get(f"/api/guests/{free_u['guest_id']}/listening-practice", params={"free_only": "false"}, headers=H("tok_premium_b")).json()["items"]
    assert all(i["situation_slug"] in free for i in items)
    # Free token on the premium user's guest -> still free.
    items = client.get(f"/api/guests/{prem['guest_id']}/listening-practice", params={"free_only": "false"}, headers=H("tok_free_b")).json()["items"]
    assert all(i["situation_slug"] in free for i in items)


# ---------- functional ----------
@pytest.mark.parametrize("token,role", [("tok_free_b", "bartender"), ("tok_free_w", "waiter")])
def test_free_role_exactly_5_accessible(client, token, role):
    ok = [s for s in role_slugs(client, role) if _lesson_status(client, s, token) == 200]
    assert sorted(ok) == sorted(billing_access.free_slugs("hospitality", role))


def test_review_items_free_filtered(client):
    u = USERS["tok_free_b"]
    items = client.get(f"/api/guests/{u['guest_id']}/review-items", params={"free_only": "false"}, headers=H("tok_free_b")).json()
    free = billing_access.free_slugs("hospitality", "bartender")
    assert all(i["situation_slug"] in free for i in items)


def test_item_endpoints_protected(client):
    free = billing_access.free_slugs("hospitality", "bartender")
    locked = next(s for s in role_slugs(client, "bartender") if s not in free)
    for kind in ("listening", "speaking"):
        assert client.get(f"/api/{kind}/item/{locked}", headers=H("tok_free_b")).status_code in (403, 404)
        assert client.get(f"/api/{kind}/item/{locked}", headers=H("tok_premium_b")).status_code in (200, 404)


def test_refresh_endpoint_own_user_only(client):
    r = client.post("/api/billing/refresh-entitlement", headers=H("tok_premium_b"), json={"user_id": USERS["tok_free_b"]["user_id"]})
    assert r.status_code == 200 and r.json() == {"premium": True}
    r = client.post("/api/billing/refresh-entitlement", headers=H("tok_free_b"), json={"user_id": USERS["tok_premium_b"]["user_id"]})
    assert r.json() == {"premium": False}
