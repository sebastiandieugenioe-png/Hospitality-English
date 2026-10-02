import { initializeApp, getApps } from "firebase/app";
import {
  getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider,
  signInWithPopup, linkWithPopup, signOut, deleteUser, reauthenticateWithPopup,
} from "firebase/auth";

// CRA does not strip surrounding quotes from .env values; do it defensively.
const clean = (v) => (v || "").replace(/^['"]|['"]$/g, "").trim();

const firebaseConfig = {
  apiKey: clean(process.env.REACT_APP_FIREBASE_API_KEY),
  authDomain: clean(process.env.REACT_APP_FIREBASE_AUTH_DOMAIN),
  projectId: clean(process.env.REACT_APP_FIREBASE_PROJECT_ID),
  storageBucket: clean(process.env.REACT_APP_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(process.env.REACT_APP_FIREBASE_APP_ID),
};

export const APPLE_ENABLED = false; // Apple Sign In not configured yet (APPLE_CONFIG_REQUIRED).

let _app;
export function fbApp() {
  _app = getApps()[0] || initializeApp(firebaseConfig);
  return _app;
}
export const fbAuth = () => getAuth(fbApp());

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
}

export async function reauthenticateGoogle() {
  const u = fbAuth().currentUser;
  if (u) await reauthenticateWithPopup(u, new GoogleAuthProvider());
}

export async function deleteFirebaseUser() {
  const u = fbAuth().currentUser;
  if (u) await deleteUser(u);
}
