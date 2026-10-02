"""
Firebase Admin initialization + helpers (backend-only).

Identity is ALWAYS derived from a verified Firebase ID token; the client-supplied
uid is never trusted. Admin credentials come from env vars (project id / client
email / private key with escaped newlines) and never leave the backend. No ID
tokens or secrets are logged.
"""
import os
import logging

import firebase_admin
from firebase_admin import credentials, auth as fb_auth

logger = logging.getLogger(__name__)
_app = None


def _init():
    global _app
    if _app is not None:
        return _app
    if firebase_admin._apps:
        _app = firebase_admin.get_app()
        return _app
    private_key = (os.environ["FIREBASE_PRIVATE_KEY"] or "").replace("\\n", "\n").strip()
    cred = credentials.Certificate({
        "type": "service_account",
        "project_id": os.environ["FIREBASE_PROJECT_ID"],
        "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
        "private_key": private_key,
        "token_uri": "https://oauth2.googleapis.com/token",
    })
    _app = firebase_admin.initialize_app(cred)
    return _app


def verify_token(id_token):
    """Verify a Firebase ID token and return the decoded claims, or raise."""
    _init()
    return fb_auth.verify_id_token(id_token)


def delete_user(uid):
    """Delete the Firebase Auth user. Idempotent (ignores 'user not found')."""
    _init()
    try:
        fb_auth.delete_user(uid)
    except fb_auth.UserNotFoundError:
        pass


def providers_from_claims(decoded):
    """Return the provider ids (e.g. ['google.com'] or ['anonymous'])."""
    fb = decoded.get("firebase", {}) or {}
    sip = fb.get("sign_in_provider")
    identities = fb.get("identities", {}) or {}
    provs = [p for p in identities.keys()]
    if not provs and sip:
        provs = [sip]
    return provs or ["anonymous"]


def is_anonymous(decoded):
    return (decoded.get("firebase", {}) or {}).get("sign_in_provider") == "anonymous"
