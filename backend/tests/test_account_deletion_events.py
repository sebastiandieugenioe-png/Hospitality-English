"""LIVE: account deletion removes account_events and leaves no post-deletion record.

Uses a synthetic custom-token Firebase user against the public API (no real account touched).
"""
import os
import uuid
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")
_FRONT = (ROOT.parent / "frontend" / ".env").read_text()


def _front(key):
    return _FRONT.split(f"{key}=")[1].split()[0].strip().strip('"')


API = f"{_front('REACT_APP_BACKEND_URL')}/api"


def _token(uid):
    import sys
    sys.path.insert(0, str(ROOT))
    import firebase_admin_setup
    from firebase_admin import auth as fb_auth
    firebase_admin_setup._init()
    custom = fb_auth.create_custom_token(uid).decode()
    r = requests.post(f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key={_front('REACT_APP_FIREBASE_API_KEY')}",
                      json={"token": custom, "returnSecureToken": True}, timeout=15)
    r.raise_for_status()
    return r.json()["idToken"]


def test_delete_account_removes_account_events():
    db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
    run = uuid.uuid4().hex[:8]
    uid, user_id, other = f"del_{run}", f"usr_del_{run}", f"usr_keep_{run}"
    gid = requests.post(f"{API}/guests", json={"interface_language": "en"}).json()["id"]
    db.users.insert_one({"id": user_id, "firebase_uid": uid, "providers": ["custom"], "profile_ids_by_profession": {"hospitality": gid}})
    db.account_events.insert_many([
        {"id": str(uuid.uuid4()), "user_id": user_id, "firebase_uid": uid, "event_type": "link", "guest_id": gid},
        {"id": str(uuid.uuid4()), "user_id": user_id, "firebase_uid": f"anon_{run}", "event_type": "sign_in", "guest_id": gid},
        {"id": str(uuid.uuid4()), "user_id": other, "firebase_uid": f"keep_{run}", "event_type": "sign_in", "guest_id": "other"},
    ])
    try:
        h = {"Authorization": f"Bearer {_token(uid)}"}
        assert requests.delete(f"{API}/account", json={"confirm": "no"}, headers=h).status_code == 422
        r = requests.delete(f"{API}/account", json={"confirm": "DELETE"}, headers=h)
        assert r.status_code == 200 and r.json() == {"deleted": True}
        assert db.account_events.count_documents({"$or": [{"user_id": user_id}, {"firebase_uid": uid}, {"guest_id": gid}]}) == 0
        assert db.users.count_documents({"id": user_id}) == 0
        assert db.guests.count_documents({"id": gid}) == 0
        assert db.account_events.count_documents({"user_id": other}) == 1
    finally:
        db.account_events.delete_many({"user_id": {"$in": [user_id, other]}})
        db.users.delete_one({"id": user_id})
