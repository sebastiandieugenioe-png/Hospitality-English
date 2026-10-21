// Native (Capacitor iOS/Android) provider sign-in. Only obtains OAuth credentials;
// skipNativeAuth keeps Firebase JS as the single session. Never call on web.
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import { OAuthProvider } from "firebase/auth";

const CANCEL_RE = /cancel|1001|12501|16:/i;

function normalize(e) {
  const err = new Error("native_auth_failed");
  err.code = CANCEL_RE.test(String(e?.message || "")) || CANCEL_RE.test(String(e?.code || ""))
    ? "auth/user-cancelled"
    : "auth/native-provider-failed";
  return err; // raw provider/plugin detail intentionally dropped
}

function missing() {
  const err = new Error("native_credential_missing");
  err.code = "auth/native-credential-missing";
  return err;
}

// Fresh Google ID token from the native Google Sign-In SDK (in memory only).
export async function nativeGoogleIdToken() {
  let r;
  try { r = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true }); }
  catch (e) { throw normalize(e); }
  const idToken = r?.credential?.idToken;
  if (!idToken) throw missing();
  return idToken;
}

// Fresh native Sign in with Apple. The plugin generates the raw nonce and sends its
// SHA-256 to Apple; Firebase needs the raw nonce. authorizationCode is fresh per call.
export async function nativeAppleCredential() {
  let r;
  try { r = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true, scopes: ["email", "name"] }); }
  catch (e) { throw normalize(e); }
  const { idToken, nonce, authorizationCode } = r?.credential || {};
  if (!idToken || !nonce) throw missing();
  const credential = new OAuthProvider("apple.com").credential({ idToken, rawNonce: nonce });
  return { credential, authorizationCode: authorizationCode || null };
}

// Clears cached native provider state (e.g. Google account picker). Best-effort.
export async function nativeSignOut() {
  try { await FirebaseAuthentication.signOut(); } catch { /* nothing to clear */ }
}

// Revoke Apple tokens with a fresh authorization code via the official Firebase
// Identity Toolkit endpoint (same call the Firebase iOS SDK makes). Throws on failure.
export async function revokeAppleAuthorizationCode(apiKey, firebaseIdToken, authorizationCode) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v2/accounts:revokeToken?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ providerId: "apple.com", tokenType: "CODE", token: authorizationCode, idToken: firebaseIdToken }),
  });
  if (!res.ok) {
    const err = new Error("apple_revoke_failed");
    err.code = "APPLE_REVOKE_FAILED";
    throw err;
  }
}
