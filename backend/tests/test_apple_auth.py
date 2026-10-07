"""
Apple Sign-In — Phase 1 focused tests.

The Apple OAuth popup cannot be automated, but the backend is provider-agnostic:
identity (incl. provider ids) is derived from the verified Firebase ID token via
`providers_from_claims`, and the SAME /auth/complete-link pipeline that Google uses
handles Apple. These tests prove:
  1. `providers_from_claims` maps apple.com correctly (identities + sign_in_provider).
  2. The shared link pipeline (which Apple reuses after the popup) preserves the
     Firebase uid-derived identity, the exact guest_id, resolves the canonical guest
     cross-device, and never overwrites a temporary guest.
Run: cd /app/backend && python -m pytest tests/test_apple_auth.py -v
"""
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
    return requests.post(f"{BASE}/guests", json={"interface_language": "es"}).json()["id"]


# ---------- 1. provider mapping is Apple-aware ----------
def test_providers_from_claims_maps_apple():
    # Apple returns identities keyed by provider id.
    decoded = {"firebase": {"sign_in_provider": "apple.com", "identities": {"apple.com": ["0001.abc"]}}}
    assert fa.providers_from_claims(decoded) == ["apple.com"]
    # Fallback when identities is empty but sign_in_provider is apple.com.
    assert fa.providers_from_claims({"firebase": {"sign_in_provider": "apple.com", "identities": {}}}) == ["apple.com"]
    # Sanity: Google still maps, and anonymous is the default.
    assert fa.providers_from_claims({"firebase": {"sign_in_provider": "google.com", "identities": {"google.com": ["x"]}}}) == ["google.com"]
    assert fa.providers_from_claims({"firebase": {"sign_in_provider": "anonymous", "identities": {}}}) == ["anonymous"]


# ---------- 2. shared link pipeline Apple reuses ----------
def test_apple_link_preserves_guest_and_resolves_canonical():
    uid = f"test-apple-{uuid.uuid4().hex[:8]}"
    try:
        tok = _custom_token(uid)
        gid = _new_guest()
        # First link (post-popup) preserves the EXACT guest_id.
        link = requests.post(f"{BASE}/auth/complete-link", headers=_h(tok),
                             json={"current_guest_id": gid, "profession_id": "hospitality"}).json()
        assert link["canonical_guest_id"] == gid
        assert link["loaded_existing_account"] is False

        me = requests.get(f"{BASE}/auth/me", headers=_h(tok)).json()
        u = me["user"]
        assert u["professions"] == ["hospitality"]
        assert u["active_profession"] == "hospitality"
        assert u["profile_ids_by_profession"]["hospitality"] == gid

        # Existing Apple account on another device: a different temp guest must NOT overwrite.
        temp = _new_guest()
        r = requests.post(f"{BASE}/auth/complete-link", headers=_h(tok),
                          json={"current_guest_id": temp, "profession_id": "hospitality"}).json()
        assert r["canonical_guest_id"] == gid
        assert r["loaded_existing_account"] is True
    finally:
        fa.delete_user(uid)
