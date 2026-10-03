"""
GIS migration static checks — assert the Google login path uses Google Identity
Services (popup/redirect-free) and that tokens are never persisted.
Run: cd /app/backend && python -m pytest tests/test_gis_frontend.py -v
"""
from pathlib import Path
from dotenv import dotenv_values

FRONTEND = Path(__file__).resolve().parent.parent.parent / "frontend"
FIREBASE = (FRONTEND / "src" / "lib" / "firebase.js").read_text()
ACCOUNT = (FRONTEND / "src" / "pages" / "Account.js").read_text()
CONTEXT = (FRONTEND / "src" / "context" / "AppContext.js").read_text()


def test_google_client_id_configured():
    cid = (dotenv_values(FRONTEND / ".env").get("REACT_APP_GOOGLE_CLIENT_ID") or "").strip()
    assert cid.endswith(".apps.googleusercontent.com") and cid.count(".apps.googleusercontent.com") == 1


def test_gis_library_and_init_present():
    assert "https://accounts.google.com/gsi/client" in FIREBASE
    assert "google.accounts.id.initialize" in FIREBASE
    assert "google.accounts.id.renderButton" in FIREBASE


def test_credential_based_firebase_auth():
    assert "GoogleAuthProvider.credential(" in FIREBASE
    assert "linkWithCredential(" in FIREBASE
    assert "signInWithCredential(" in FIREBASE
    assert "reauthenticateWithCredential(" in FIREBASE


def test_account_page_uses_gis_not_popup():
    # Account page must render the GIS button and NOT call Firebase popup/redirect.
    assert "renderGisButton" in ACCOUNT
    for banned in ["signInWithPopup", "linkWithPopup", "signInWithRedirect", "linkWithRedirect", "reauthenticateWithPopup"]:
        assert banned not in ACCOUNT, f"Account.js must not use {banned}"


def test_context_google_path_is_credential_based():
    # The active Google entry points use the credential path, not popup.
    assert "connectGoogle" in CONTEXT
    assert "reauthGoogle" in CONTEXT
    assert "connectGoogleCredential" in CONTEXT
    assert "reauthWithGoogleCredential" in CONTEXT


def test_no_redirect_helper_dependency():
    # No reliance on Firebase /__/auth/* redirect helper anywhere in the app source.
    for f in [FIREBASE, ACCOUNT, CONTEXT]:
        assert "__/auth" not in f
        assert "signInWithRedirect" not in f
        assert "linkWithRedirect" not in f


def test_tokens_not_persisted():
    # Google/Firebase tokens must never be written to storage.
    for f in [FIREBASE, ACCOUNT, CONTEXT]:
        for bad in ["localStorage.setItem('google", 'localStorage.setItem("google',
                    "setItem('idToken", 'setItem("idToken', "sessionStorage.setItem"]:
            assert bad not in f
    # credential is only read from the GIS response, not stored
    assert "response?.credential" in ACCOUNT or "response.credential" in ACCOUNT
