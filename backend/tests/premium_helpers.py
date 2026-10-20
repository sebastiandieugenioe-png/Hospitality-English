"""Shared legitimate Premium identity for legacy content tests.

Creates ONE synthetic Firebase (custom-token) user + users doc, grants a temporary
RevenueCat promotional `hospitality_premium` entitlement, and cleans everything up at
exit. Tests then call Premium resources the same way the app does (Bearer token +
guest owned by that user). Never prints secrets.
"""
import atexit
import os
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
_FRONT = (ROOT.parent / "frontend" / ".env").read_text()
_RC = "https://api.revenuecat.com/v1"
_ENT = "hospitality_premium"
_state = {}


def _front(key):
    return _FRONT.split(f"{key}=")[1].split()[0].strip().strip('"')


def _db():
    return MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def _rc(method, path, **kw):
    secret = (os.environ.get("REVENUECAT_SECRET_API_KEY") or "").strip()
    return requests.request(method, f"{_RC}{path}", headers={"Authorization": f"Bearer {secret}", "Content-Type": "application/json"},
                            timeout=15, **kw)


def _setup():
    import firebase_admin_setup
    from firebase_admin import auth as fb_auth
    firebase_admin_setup._init()
    run = uuid.uuid4().hex[:8]
    uid, user_id = f"legacy_prem_{run}", f"usr_legacy_prem_{run}"
    _db().users.insert_one({"id": user_id, "firebase_uid": uid, "providers": ["custom"], "professions": ["hospitality"],
                            "profile_ids_by_profession": {}, "status": "active"})
    _rc("GET", f"/subscribers/{user_id}")  # get-or-create the RevenueCat customer
    r = _rc("POST", f"/subscribers/{user_id}/entitlements/{_ENT}/promotional", json={"duration": "daily"})
    r.raise_for_status()
    custom = fb_auth.create_custom_token(uid).decode()
    t = requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={_front('REACT_APP_FIREBASE_API_KEY')}",
                      json={"token": custom, "returnSecureToken": True}, timeout=15)
    t.raise_for_status()
    _state.update(uid=uid, user_id=user_id, token=t.json()["idToken"])
    atexit.register(_cleanup)


def _cleanup():
    from firebase_admin import auth as fb_auth
    _rc("POST", f"/subscribers/{_state['user_id']}/entitlements/{_ENT}/revoke_promotionals")
    _rc("DELETE", f"/subscribers/{_state['user_id']}")
    db = _db()
    db.users.delete_one({"id": _state["user_id"]})
    db.guests.update_many({"user_id": _state["user_id"]}, {"$unset": {"user_id": ""}})
    try:
        fb_auth.delete_user(_state["uid"])
    except Exception:
        pass


def premium_headers():
    if not _state:
        _setup()
    return {"Authorization": f"Bearer {_state['token']}"}


def link_premium(guest_id):
    """Make a test guest belong to the Premium test user (as account linking does)."""
    premium_headers()
    _db().guests.update_one({"id": guest_id}, {"$set": {"user_id": _state["user_id"]}})
    return guest_id
