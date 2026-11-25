import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, initializeAuth, indexedDBLocalPersistence, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, OAuthProvider,
  signInWithPopup, linkWithPopup, signOut, deleteUser, reauthenticateWithPopup,
  signInWithCredential, linkWithCredential, reauthenticateWithCredential, revokeAccessToken,
} from "firebase/auth";
import { isNative, isAndroid } from "@/lib/platform";
import { nativeAppleCredential, nativeSignOut, revokeAppleAuthorizationCode } from "@/lib/nativeAuth";

const clean = (v) => (v || "").replace(/^['"]|['"]$/g, "").trim();

export const GOOGLE_CLIENT_ID = clean(process.env.REACT_APP_GOOGLE_CLIENT_ID);
export const GIS_SRC = "https://accounts.google.com/gsi/client";

const firebaseConfig = {
  apiKey: clean(process.env.REACT_APP_FIREBASE_API_KEY),
  authDomain: clean(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.REACT_APP_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.REACT_APP_FIREBASE_APP_ID),
};

// Apple enabled on web + iOS; hidden only in the Android native app (V1).
export const APPLE_ENABLED = !(isNative() && isAndroid());

let _app;
export function fbApp() {
  _app = getApps()[0] || initializeApp(firebaseConfig);
  return _app;
}
// Native WebView: initializeAuth without the popup/redirect resolver (getAuth can hang
// in Capacitor iOS). Web keeps getAuth exactly as before.
let _nativeAuth;
export const fbAuth = () => {
  if (!isNative()) return getAuth(fbApp());
  if (!_nativeAuth) _nativeAuth = initializeAuth(fbApp(), { persistence: indexedDBLocalPersistence });
  return _nativeAuth;
};

export function watchAuth(cb) {
  return onAuthStateChanged(fbAuth(), cb);
}

export async function ensureAnonymous() {
  const auth = fbAuth();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

export async function getIdToken(force = false) {
  const u = fbAuth().currentUser;
  return u ? u.getIdToken(force) : null;
}

// Link Google to the current anonymous user (preserving uid); if that Google
// account already belongs to another Firebase user, sign in to it instead.
export async function signInWithGoogle() {
  const auth = fbAuth();
  const provider = new GoogleAuthProvider();
  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      const res = await linkWithPopup(auth.currentUser, provider);
      return { mode: "linked", user: res.user };
    }
    const res = await signInWithPopup(auth, provider);
    return { mode: "signin", user: res.user };
  } catch (e) {
    if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
      const res = await signInWithPopup(auth, provider);
      return { mode: "signin", user: res.user };
    }
    throw e;
  }
}

export async function firebaseSignOut() {
  await signOut(fbAuth());
  if (isNative()) await nativeSignOut();
}

export async function reauthenticateGoogle() {
  const u = fbAuth().currentUser;
  if (u) await reauthenticateWithPopup(u, new GoogleAuthProvider());
}

export async function deleteFirebaseUser() {
  const u = fbAuth().currentUser;
  if (u) await deleteUser(u);
}

// ---------- Google Identity Services (GIS) — popup-free, Safari/iOS friendly ----------
let _gisPromise;
export function loadGis() {
  if (_gisPromise) return _gisPromise;
  _gisPromise = new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) {
      return resolve(window.google);
    }
    const s = document.createElement("script");
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (window.google && window.google.accounts && window.google.accounts.id) resolve(window.google);
      else reject(new Error("gis_unavailable"));
    };
    s.onerror = () => reject(new Error("gis_unavailable"));
    document.head.appendChild(s);
  });
  return _gisPromise;
}

let _gisInitialized = false;
let _gisCallback = null;

export async function initGis(callback) {
  if (!GOOGLE_CLIENT_ID) throw new Error("gis_unavailable");
  const google = await loadGis();
  _gisCallback = callback; // always use the latest callback
  if (!_gisInitialized) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (resp) => { if (_gisCallback) _gisCallback(resp); }, // kept only in memory
      auto_select: false,
      cancel_on_tap_outside: true,
      use_fedcm_for_prompt: true,
    });
    _gisInitialized = true;
  }
  return google;
}

export async function renderGisButton(el, callback, opts = {}) {
  const google = await initGis(callback);
  google.accounts.id.renderButton(el, {
    type: "standard", theme: "outline", size: "large",
    text: "continue_with", shape: "pill", logo_alignment: "left",
    width: opts.width || 300,
    ...(opts.locale ? { locale: opts.locale } : {}),
  });
  return google;
}

// Exchange a Google ID token for a Firebase session WITHOUT any popup/redirect.
// Anonymous user -> link (preserves uid + guest); if the Google account already
// exists -> sign in to it (caller keeps the temporary guest separate).
export async function connectGoogleCredential(googleIdToken) {
  const auth = fbAuth();
  const cred = GoogleAuthProvider.credential(googleIdToken);
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const res = await linkWithCredential(auth.currentUser, cred);
      return { mode: "linked", user: res.user };
    } catch (e) {
      if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
        const res = await signInWithCredential(auth, cred);
        return { mode: "signin", user: res.user };
      }
      throw e; // unexpected: caller must NOT destroy guest data
    }
  }
  const res = await signInWithCredential(auth, cred);
  return { mode: "signin", user: res.user };
}

// ---------- Sign in with Apple (Firebase OAuthProvider, popup) ----------
// Link Apple to the current anonymous user (preserving uid + guest); if the Apple
// account already belongs to another Firebase user, sign in to it instead.
// Only email + name scopes are requested; no Apple/OAuth tokens are persisted.
// Native iOS: credential from native Sign in with Apple, applied to Firebase JS.
async function connectAppleNative() {
  const auth = fbAuth();
  const { credential } = await nativeAppleCredential();
  if (auth.currentUser && auth.currentUser.isAnonymous) {
    try {
      const res = await linkWithCredential(auth.currentUser, credential);
      return { mode: "linked", user: res.user };
    } catch (e) {
      if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
        // An Apple id_token + nonce can only be used once: the failed link already
        // consumed it. Use the pending token from the error if Firebase gave one,
        // otherwise get a fresh native Apple credential (quick Face ID confirm).
        const fromErr = OAuthProvider.credentialFromError(e);
        if (fromErr?.pendingToken) {
          try {
            const res = await signInWithCredential(auth, fromErr);
            return { mode: "signin", user: res.user };
          } catch { /* fall through to a fresh credential */ }
        }
        const fresh = await nativeAppleCredential();
        const res = await signInWithCredential(auth, fresh.credential);
        return { mode: "signin", user: res.user };
      }
      throw e; // unexpected: caller must NOT destroy guest data
    }
  }
  const res = await signInWithCredential(auth, credential);
  return { mode: "signin", user: res.user };
}

export async function connectAppleProvider() {
  if (isNative()) return connectAppleNative();
  const auth = fbAuth();
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  try {
    if (auth.currentUser && auth.currentUser.isAnonymous) {
      const res = await linkWithPopup(auth.currentUser, provider);
      return { mode: "linked", user: res.user };
    }
    const res = await signInWithPopup(auth, provider);
    return { mode: "signin", user: res.user };
  } catch (e) {
    if (e.code === "auth/credential-already-in-use" || e.code === "auth/email-already-in-use") {
      const res = await signInWithPopup(auth, provider); // existing Apple account
      return { mode: "signin", user: res.user };
    }
    throw e; // unexpected: caller must NOT destroy guest data
  }
}

// Apple account deletion — step 1: fresh recent reauthentication + Apple access
// revocation. Forces a NEW Apple credential (never reuses an old session); extracts
// the Apple access token from the result and revokes it via Firebase BEFORE the
// account is deleted. The token is used in memory only — never stored or logged.
// Throws on cancel (caller must not delete) and with code APPLE_REVOKE_TOKEN_MISSING
// if Apple/Firebase returns no access token (abort safely, delete nothing).
export async function reauthAndRevokeApple() {
  const auth = fbAuth();
  const u = auth.currentUser;
  if (!u) { const e = new Error("no_current_user"); e.code = "auth/no-current-user"; throw e; }
  if (isNative()) {
    // Native iOS: fresh Apple sign-in -> reauth Firebase JS -> revoke with the fresh code.
    const { credential, authorizationCode } = await nativeAppleCredential();
    if (!authorizationCode) {
      const e = new Error("apple_revoke_token_missing");
      e.code = "APPLE_REVOKE_TOKEN_MISSING";
      throw e;
    }
    await reauthenticateWithCredential(u, credential);
    await revokeAppleAuthorizationCode(auth.config.apiKey, await u.getIdToken(true), authorizationCode);
    return;
  }
  const provider = new OAuthProvider("apple.com");
  provider.addScope("email");
  provider.addScope("name");
  const result = await reauthenticateWithPopup(u, provider); // fresh credential; throws if cancelled
  const credential = OAuthProvider.credentialFromResult(result);
  const accessToken = credential && credential.accessToken;
  if (!accessToken) {
    const e = new Error("apple_revoke_token_missing");
    e.code = "APPLE_REVOKE_TOKEN_MISSING";
    throw e;
  }
  await revokeAccessToken(auth, accessToken); // revoke Apple access before deletion
}

// Recent-login reauthentication for sensitive ops (e.g. account deletion), popup-free.
export async function reauthWithGoogleCredential(googleIdToken) {
  const auth = fbAuth();
  const cred = GoogleAuthProvider.credential(googleIdToken);
  if (auth.currentUser) await reauthenticateWithCredential(auth.currentUser, cred);
}
