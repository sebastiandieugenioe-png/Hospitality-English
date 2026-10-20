"""LIVE server-side Premium enforcement check (real Firebase + real RevenueCat, public URL).

Uses synthetic users only: a custom-token Firebase user, a users doc whose id is the
RevenueCat App User ID, and a temporary RevenueCat promotional entitlement that is
revoked and the customer deleted at the end. Skips if the secret is not configured.
Never prints secrets.
"""
import os
import time
import uuid
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
FRONT_ENV = (ROOT.parent / "frontend" / ".env").read_text()


def _front(key):
    return FRONT_ENV.split(f"{key}=")[1].split()[0].strip().strip('"')


API = f"{_front('REACT_APP_BACKEND_URL')}/api"
RC = "https://api.revenuecat.com/v1"
SECRET = (os.environ.get("REVENUECAT_SECRET_API_KEY") or "").strip()
ENT = "hospitality_premium"

pytestmark = pytest.mark.skipif(not SECRET, reason="REVENUECAT_SECRET_API_KEY not configured")


def _rc(method, path, **kw):
    return requests.request(method, f"{RC}{path}", headers={"Authorization": f"Bearer {SECRET}", "Content-Type": "application/json"}, timeout=15, **kw)


def _id_token(uid):
    import firebase_admin_setup
    from firebase_admin import auth as fb_auth
    firebase_admin_setup._init()
    custom = fb_auth.create_custom_token(uid).decode()
    r = requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={_front('REACT_APP_FIREBASE_API_KEY')}",
                      json={"token": custom, "returnSecureToken": True}, timeout=15)
    r.raise_for_status()
    return r.json()["idToken"]


@pytest.fixture(scope="module")
def env():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    run = uuid.uuid4().hex[:8]
    people = {}
    for name, role in (("free", "bartender"), ("prem", "bartender")):
        g = requests.post(f"{API}/guests", json={"interface_language": "en"}).json()
        requests.put(f"{API}/guests/{g['id']}/profile", json={"role": role, "venue_type": "pub", "target_country": "ireland",
                                                             "goal": "first_hospitality_job", "employment_status": "already_working"}).raise_for_status()
        uid, user_id = f"e2e_{name}_{run}", f"usr_e2e_{name}_{run}"
        db.users.insert_one({"id": user_id, "firebase_uid": uid, "providers": ["custom"], "professions": ["hospitality"],
                             "profile_ids_by_profession": {"hospitality": g["id"]}, "status": "active"})
        db.guests.update_one({"id": g["id"]}, {"$set": {"user_id": user_id, "auth_state": "linked"}})
        people[name] = {"uid": uid, "user_id": user_id, "guest_id": g["id"], "token": _id_token(uid)}
    yield people
    from firebase_admin import auth as fb_auth
    for p in people.values():
        _rc("POST", f"/subscribers/{p['user_id']}/entitlements/{ENT}/revoke_promotionals")
        _rc("DELETE", f"/subscribers/{p['user_id']}")
        db.users.delete_one({"id": p["user_id"]})
        try:
            fb_auth.delete_user(p["uid"])
        except Exception:
            pass


def H(p):
    return {"Authorization": f"Bearer {p['token']}"}


def _free():
    return {"guest-arrives-at-the-bar", "taking-a-drinks-order", "recommending-drinks",
            "guest-asks-about-cocktail-allergens", "handling-a-complaint"}


def _bar_slugs():
    return [s["slug"] for s in requests.get(f"{API}/situations", params={"role": "bartender"}).json() if "bartender" in (s.get("roles") or [])]


def _pool(p, kind, extra=None):
    params = {"free_only": "false", **(extra or {})}
    return [i["situation_slug"] for i in requests.get(f"{API}/guests/{p['guest_id']}/{kind}-practice", params=params, headers=H(p)).json()["items"]]


def test_1_real_free_user(env):
    f = env["free"]
    r = requests.post(f"{API}/billing/refresh-entitlement", headers=H(f))
    assert r.status_code == 200 and r.json() == {"premium": False}
    slugs = _bar_slugs()
    assert len(slugs) == 25
    ok = [s for s in slugs if requests.get(f"{API}/lessons/{s}", headers=H(f)).status_code == 200]
    assert set(ok) == _free()
    for kind in ("listening", "speaking"):
        assert set(_pool(f, kind, {"premium": "true", "is_premium": "true"})) <= _free()
    locked = next(s for s in slugs if s not in _free())
    r = requests.get(f"{API}/lessons/{locked}", headers=H(f))
    assert r.status_code == 403 and r.json()["detail"] == "premium_required"


def test_2_real_premium_via_refresh(env):
    p = env["prem"]
    # Warm the negative cache first, then grant -> refresh must reflect Premium immediately.
    assert requests.post(f"{API}/billing/refresh-entitlement", headers=H(p)).json() == {"premium": False}
    locked = next(s for s in _bar_slugs() if s not in _free())
    assert requests.get(f"{API}/lessons/{locked}", headers=H(p)).status_code == 403
    g = _rc("POST", f"/subscribers/{p['user_id']}/entitlements/{ENT}/promotional", json={"duration": "daily"})
    assert g.status_code in (200, 201), g.status_code
    sub = _rc("GET", f"/subscribers/{p['user_id']}").json()["subscriber"]
    assert ENT in sub["entitlements"]  # identity = users.id on RevenueCat
    assert requests.post(f"{API}/billing/refresh-entitlement", headers=H(p)).json() == {"premium": True}
    slugs = _bar_slugs()
    assert all(requests.get(f"{API}/lessons/{s}", headers=H(p)).status_code == 200 for s in slugs)
    assert any(s not in _free() for s in _pool(p, "listening"))


def test_3_cross_user_cannot_borrow(env):
    f, p = env["free"], env["prem"]
    as_free_on_prem_guest = [i["situation_slug"] for i in requests.get(
        f"{API}/guests/{p['guest_id']}/listening-practice", params={"free_only": "false"}, headers=H(f)).json()["items"]]
    assert set(as_free_on_prem_guest) <= _free()
    as_prem_on_free_guest = [i["situation_slug"] for i in requests.get(
        f"{API}/guests/{f['guest_id']}/listening-practice", params={"free_only": "false"}, headers=H(p)).json()["items"]]
    assert set(as_prem_on_free_guest) <= _free()


def test_4_revoke_then_refresh_back_to_free(env):
    p = env["prem"]
    r = _rc("POST", f"/subscribers/{p['user_id']}/entitlements/{ENT}/revoke_promotionals")
    assert r.status_code in (200, 201)
    time.sleep(1)
    assert requests.post(f"{API}/billing/refresh-entitlement", headers=H(p)).json() == {"premium": False}
    locked = next(s for s in _bar_slugs() if s not in _free())
    assert requests.get(f"{API}/lessons/{locked}", headers=H(p)).status_code == 403


def test_5_no_secret_in_responses(env):
    f = env["free"]
    for r in (requests.post(f"{API}/billing/refresh-entitlement", headers=H(f)),
              requests.get(f"{API}/lessons/serving-beer", headers=H(f))):
        assert SECRET not in r.text
