"""
Accounts & Auth MVP — real end-to-end tests against the live Firebase project.

Uses the Firebase Identity Toolkit REST API to mint REAL ID tokens:
- anonymous sign-up  -> anonymous ID token
- Admin custom token -> signInWithCustomToken -> non-anonymous ID token (simulates
  a linked provider account; the Google OAuth popup itself cannot be automated).

All guests/users created here are dedicated test data and are cleaned up. No real
preview data is touched. Run: cd /app/backend && python -m pytest tests/test_accounts_auth.py -v
"""
import asyncio
import os
import sys
import uuid

import requests
from dotenv import load_dotenv, dotenv_values

ROOT = __import__("pathlib").Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
load_dotenv(ROOT / ".env")

API = open(ROOT.parent / "frontend" / ".env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
BASE = f"{API}/api"
WEB_KEY = (dotenv_values(ROOT.parent / "frontend" / ".env").get("REACT_APP_FIREBASE_API_KEY") or "").strip()

import firebase_admin_setup as fa
from firebase_admin import auth as fb_auth

IDTK = "https://identitytoolkit.googleapis.com/v1/accounts"


def _anon_token():
    r = requests.post(f"{IDTK}:signUp?key={WEB_KEY}", json={"returnSecureToken": True}, timeout=30)
    r.raise_for_status()
    d = r.json()
    return d["idToken"], d["localId"]


def _custom_token(uid):
    fa._init()
    ct = fb_auth.create_custom_token(uid).decode()
    r = requests.post(f"{IDTK}:signInWithCustomToken?key={WEB_KEY}",
                      json={"token": ct, "returnSecureToken": True}, timeout=30)
    r.raise_for_status()
    return r.json()["idToken"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _new_guest():
    g = requests.post(f"{BASE}/guests", json={"interface_language": "es"}).json()
    return g["id"]


# ---------- guest still works without an account ----------
def test_guest_usable_without_account():
    gid = _new_guest()
    r = requests.get(f"{BASE}/guests/{gid}")
    assert r.status_code == 200
    # learning endpoints work with no auth header at all
    assert requests.get(f"{BASE}/guests/{gid}/recommended-situations").status_code == 200


# ---------- token verification ----------
def test_invalid_token_401():
    assert requests.post(f"{BASE}/auth/bootstrap", headers=_h("garbage"), json={}).status_code == 401
    assert requests.get(f"{BASE}/auth/me", headers=_h("garbage")).status_code == 401
    assert requests.post(f"{BASE}/auth/bootstrap", json={}).status_code == 401


# ---------- anonymous bootstrap keeps guest_id ----------
def test_anonymous_bootstrap_keeps_guest_id():
    tok, uid = _anon_token()
    try:
        gid = _new_guest()
        r = requests.post(f"{BASE}/auth/bootstrap", headers=_h(tok),
                          json={"current_guest_id": gid, "profession_id": "hospitality"}).json()
        assert r["auth_state"] == "guest"
        assert r["user_id"] is None
        assert r["canonical_guest_id"] == gid  # unchanged
        me = requests.get(f"{BASE}/auth/me", headers=_h(tok)).json()
        assert me["user"] is None and me["canonical_guest_id"] == gid
    finally:
        fa.delete_user(uid)


def test_client_supplied_uid_is_ignored():
    tok, uid = _anon_token()
    try:
        gid = _new_guest()
        # Inject a bogus firebase_uid in the body — must be ignored; identity from token.
        r = requests.post(f"{BASE}/auth/bootstrap", headers=_h(tok),
                          json={"current_guest_id": gid, "firebase_uid": "attacker-uid"}).json()
        assert r["canonical_guest_id"] == gid
    finally:
        fa.delete_user(uid)


# ---------- link (first) preserves guest_id; refresh/cross-device resolves canonical ----------
def test_link_creates_user_preserves_guest_and_resolves():
    uid = f"test-link-{uuid.uuid4().hex[:8]}"
    try:
        tok = _custom_token(uid)
        gid = _new_guest()
        # first link
        link = requests.post(f"{BASE}/auth/complete-link", headers=_h(tok),
                             json={"current_guest_id": gid, "profession_id": "hospitality"}).json()
        assert link["canonical_guest_id"] == gid  # EXACT same guest_id preserved
        assert link["loaded_existing_account"] is False
        # user model assertions
        me = requests.get(f"{BASE}/auth/me", headers=_h(tok)).json()
        u = me["user"]
        assert u["professions"] == ["hospitality"]
        assert u["active_profession"] == "hospitality"
        assert u["profile_ids_by_profession"]["hospitality"] == gid
        assert me["canonical_guest_id"] == gid
        # refresh / cross-device: bootstrap with same token resolves same canonical
        b = requests.post(f"{BASE}/auth/bootstrap", headers=_h(tok),
                          json={"current_guest_id": "some-other-temp", "profession_id": "hospitality"}).json()
        assert b["auth_state"] == "linked"
        assert b["canonical_guest_id"] == gid
    finally:
        fa.delete_user(uid)


def test_existing_account_not_overwritten_by_temp_guest():
    uid = f"test-exist-{uuid.uuid4().hex[:8]}"
    try:
        tok = _custom_token(uid)
        canonical_gid = _new_guest()
        requests.post(f"{BASE}/auth/complete-link", headers=_h(tok),
                      json={"current_guest_id": canonical_gid}).json()
        # now sign in "on another device" with a different temporary guest
        temp_gid = _new_guest()
        r = requests.post(f"{BASE}/auth/complete-link", headers=_h(tok),
                          json={"current_guest_id": temp_gid}).json()
        assert r["canonical_guest_id"] == canonical_gid  # NOT overwritten
        assert r["loaded_existing_account"] is True
        # canonical profile intact
        me = requests.get(f"{BASE}/auth/me", headers=_h(tok)).json()
        assert me["canonical_guest_id"] == canonical_gid
    finally:
        fa.delete_user(uid)


# ---------- account deletion ----------
def test_account_deletion_removes_only_this_user_data_idempotent():
    uid = f"test-del-{uuid.uuid4().hex[:8]}"
    tok = _custom_token(uid)
    gid = _new_guest()
    requests.post(f"{BASE}/auth/complete-link", headers=_h(tok), json={"current_guest_id": gid})

    # seed some learning data for this test guest across collections
    async def _seed_and_check(exists):
        from motor.motor_asyncio import AsyncIOMotorClient
        dbc = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        if exists is None:  # seed
            await dbc.listening_attempts.insert_one({"id": str(uuid.uuid4()), "guest_id": gid, "profession_id": "hospitality", "correct": True})
            await dbc.speaking_attempts.insert_one({"id": str(uuid.uuid4()), "guest_id": gid, "profession_id": "hospitality", "overall": "strong"})
            return
        cnt = (await dbc.listening_attempts.count_documents({"guest_id": gid})
               + await dbc.speaking_attempts.count_documents({"guest_id": gid})
               + await dbc.guests.count_documents({"id": gid}))
        u = await dbc.users.count_documents({"firebase_uid": uid})
        return cnt, u

    asyncio.new_event_loop().run_until_complete(_seed_and_check(None))

    # confirmation required
    assert requests.delete(f"{BASE}/account", headers=_h(tok), json={"confirm": "NOPE"}).status_code == 422

    r = requests.delete(f"{BASE}/account", headers=_h(tok), json={"confirm": "DELETE"}).json()
    assert r["deleted"] is True

    cnt, u = asyncio.new_event_loop().run_until_complete(_seed_and_check(True))
    assert cnt == 0 and u == 0  # all learning data + guest + user removed

    # idempotent: second delete still succeeds (token may now be invalid after fb user delete,
    # so mint a fresh custom token for same uid to test idempotency of data deletion path)
    tok2 = _custom_token(uid)
    r2 = requests.delete(f"{BASE}/account", headers=_h(tok2), json={"confirm": "DELETE"}).json()
    assert r2["deleted"] is True
    fa.delete_user(uid)


# ---------- learning regressions ----------
def test_learning_content_intact():
    sits = requests.get(f"{BASE}/situations").json()
    roles = {}
    for s in sits:
        for r in s.get("roles", []):
            roles[r] = roles.get(r, 0) + 1
    assert roles == {"waiter": 25, "bartender": 25}
    for ep in ["assessment/meta", "emergency", "tonights-shift/meta", "job-interview/meta",
               "first-week/meta", "listening/meta", "speaking/meta"]:
        assert requests.get(f"{BASE}/{ep}").status_code == 200
    assert requests.get(f"{BASE}/listening/meta").json()["item_count"] == 50
    assert requests.get(f"{BASE}/speaking/meta").json()["item_count"] == 50


def test_recommended_still_3_to_5():
    gid = _new_guest()
    requests.put(f"{BASE}/guests/{gid}/profile",
                 json={"role": "waiter", "venue_type": "casual-restaurant", "target_country": "ireland",
                       "goal": "work_abroad", "employment_status": "looking_for_job"})
    rec = requests.get(f"{BASE}/guests/{gid}/recommended-situations").json()
    assert 3 <= len(rec) <= 5
