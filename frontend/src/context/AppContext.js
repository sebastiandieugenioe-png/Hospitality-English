import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { makeT, detectBrowserLanguage, DEFAULT_LANGUAGE, SUPPORTED_CODES } from "@/lib/i18n";
import {
  ensureAnonymous, getIdToken, watchAuth, signInWithGoogle as fbSignInGoogle,
  firebaseSignOut, deleteFirebaseUser,
  connectGoogleCredential, reauthWithGoogleCredential, connectAppleProvider,
} from "@/lib/firebase";

const AppContext = createContext(null);

const GUEST_KEY = "iph_guest_id";
const LANG_KEY = "iph_lang";
// Temporary onboarding draft (allowed in localStorage). MongoDB is the source of truth
// for the *completed* profile.
export const DRAFT_KEY = "iph_onboarding_draft";

export function AppProvider({ children }) {
  const [guestId, setGuestId] = useState(() => localStorage.getItem(GUEST_KEY) || null);
  const [guest, setGuest] = useState(null);
  // Language: localStorage is only a cache to avoid a flash; MongoDB (guest) is the
  // source of truth once a guest exists.
  const [language, setLanguageState] = useState(
    () => localStorage.getItem(LANG_KEY) || detectBrowserLanguage()
  );
  // `loading` is true until the initial guest fetch settles (only if a guestId exists).
  const [loading, setLoading] = useState(() => !!localStorage.getItem(GUEST_KEY));
  const creatingRef = useRef(null);
  // Accounts/Auth state. Firebase is optional: if it fails, the app still works as a guest.
  const [account, setAccount] = useState(null); // users doc (null when anonymous guest)
  const [authReady, setAuthReady] = useState(false);
  const bootstrappedRef = useRef(false);

  const t = useMemo(() => makeT(language), [language]);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    if (!guestId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getGuest(guestId)
      .then((g) => {
        if (!active) return;
        setGuest(g);
        // MongoDB is the source of truth for a returning guest.
        if (g.interface_language && g.interface_language !== language) {
          setLanguageState(g.interface_language);
        }
      })
      .catch(() => {
        // Stale/unknown id (e.g. DB reset): drop it so the user can start fresh.
        localStorage.removeItem(GUEST_KEY);
        if (active) setGuestId(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [guestId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Firebase bootstrap (runs once). Preserves the local guest_id, signs in
  // anonymously if needed, verifies with the backend, and resolves the canonical
  // guest profile (handles cross-device login). Non-blocking and fault-tolerant.
  useEffect(() => {
    let unsub;
    // Safety net: never block the Account UI if Firebase is slow/unreachable.
    const safety = setTimeout(() => setAuthReady(true), 8000);
    (async () => {
      try {
        await ensureAnonymous();
      } catch (e) {
        setAuthReady(true);
        return;
      }
      unsub = watchAuth(async (u) => {
        if (!u) { setAuthReady(true); return; }
        try {
          const token = await u.getIdToken();
          const local = localStorage.getItem(GUEST_KEY);
          const r = await api.authBootstrap(token, { current_guest_id: local, profession_id: "hospitality" });
          if (r.auth_state === "linked") {
            try {
              const me = await api.authMe(token);
              setAccount(me.user);
            } catch {}
          } else {
            setAccount(null);
          }
          if (r.canonical_guest_id && r.canonical_guest_id !== local) {
            localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
            setGuestId(r.canonical_guest_id);
          }
        } catch (e) {
          // backend/token hiccup — guest mode still works
        } finally {
          bootstrappedRef.current = true;
          setAuthReady(true);
        }
      });
    })();
    return () => { clearTimeout(safety); if (unsub) unsub(); };
  }, []); // eslint-disable-line

  // Returns an existing guest id or creates one. Never creates duplicates.
  const ensureGuest = async () => {
    if (guestId) return guestId;
    if (creatingRef.current) return creatingRef.current;
    creatingRef.current = api.createGuest({ interface_language: language }).then((g) => {
      localStorage.setItem(GUEST_KEY, g.id);
      setGuestId(g.id);
      setGuest(g);
      return g.id;
    });
    return creatingRef.current;
  };

  // Change interface language: update UI immediately + persist to backend (no reload,
  // no progress loss). Works before a guest exists (persists at guest creation).
  const setLanguage = async (code) => {
    if (!SUPPORTED_CODES.includes(code)) return;
    setLanguageState(code);
    if (guestId) {
      try {
        const g = await api.updateLanguage(guestId, code);
        setGuest(g);
      } catch (e) {
        console.error("Language sync failed", e);
      }
    }
  };

  const refreshGuest = async () => {
    if (!guestId) return null;
    const g = await api.getGuest(guestId);
    setGuest(g);
    return g;
  };

  // Persists the completed professional profile to MongoDB (source of truth).
  const completeProfile = async ({ role, venue_type, target_country, goal, employment_status }) => {
    const id = await ensureGuest();
    const updated = await api.updateProfile(id, { role, venue_type, target_country, goal, employment_status });
    setGuest(updated);
    localStorage.removeItem(DRAFT_KEY);
    return updated;
  };

  const logFlashcard = async (learningItemId, knew) => {
    const id = await ensureGuest();
    try {
      await api.recordFlashcard(id, { learning_item_id: learningItemId, knew });
    } catch (e) {
      console.error("Flashcard sync failed", e);
    }
  };

  const logCompletion = async (situationSlug, score, total) => {
    const id = await ensureGuest();
    try {
      await api.recordCompletion(id, { situation_slug: situationSlug, score, total });
    } catch (e) {
      console.error("Completion sync failed", e);
    }
  };

  // Emergency Phrases: backend is source of truth; optimistic local update so the
  // UI reacts instantly. Survives language/role changes and refresh.
  const saveEmergencyPhrase = async (phraseId) => {
    const id = await ensureGuest();
    setGuest((g) => (g ? { ...g, saved_emergency_phrase_ids: Array.from(new Set([...(g.saved_emergency_phrase_ids || []), phraseId])) } : g));
    try {
      const r = await api.saveEmergencyPhrase(id, phraseId);
      setGuest((g) => (g ? { ...g, saved_emergency_phrase_ids: r.saved_emergency_phrase_ids } : g));
    } catch (e) {
      console.error("Save phrase failed", e);
    }
  };

  const removeEmergencyPhrase = async (phraseId) => {
    const id = await ensureGuest();
    setGuest((g) => (g ? { ...g, saved_emergency_phrase_ids: (g.saved_emergency_phrase_ids || []).filter((x) => x !== phraseId) } : g));
    try {
      const r = await api.removeEmergencyPhrase(id, phraseId);
      setGuest((g) => (g ? { ...g, saved_emergency_phrase_ids: r.saved_emergency_phrase_ids } : g));
    } catch (e) {
      console.error("Remove phrase failed", e);
    }
  };

  const profile = guest?.professional_profile || null;
  const legacyOnboarding = guest?.onboarding || null;

  // ---- Accounts/Auth actions ----
  // GIS path (popup-free). Takes a Google ID token from Google Identity Services,
  // links it to the anonymous user (or signs in to an existing account), then
  // reconciles with the backend. Progress is never copied/migrated.
  const connectGoogle = async (googleIdToken) => {
    const res = await connectGoogleCredential(googleIdToken);
    const token = await getIdToken(true);
    const local = localStorage.getItem(GUEST_KEY);
    const r = await api.authCompleteLink(token, { current_guest_id: local, profession_id: "hospitality" });
    if (r.canonical_guest_id && r.canonical_guest_id !== local) {
      localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
      setGuestId(r.canonical_guest_id);
    }
    try {
      const me = await api.authMe(token);
      setAccount(me.user);
    } catch (e) { /* account fetch best-effort */ }
    return { ...r, mode: res.mode };
  };

  // Recent-login reauthentication via a fresh GIS credential (for deletion).
  const reauthGoogle = async (googleIdToken) => {
    await reauthWithGoogleCredential(googleIdToken);
  };

  // Sign in with Apple (Firebase popup). Links Apple to the anonymous user (or signs
  // in to an existing Apple account), then reconciles with the backend. The backend
  // is provider-agnostic, so users.providers will include "apple.com" automatically.
  // Progress is never copied/migrated; the canonical guest is resolved, not merged.
  const connectApple = async () => {
    const res = await connectAppleProvider();
    const token = await getIdToken(true);
    const local = localStorage.getItem(GUEST_KEY);
    const r = await api.authCompleteLink(token, { current_guest_id: local, profession_id: "hospitality" });
    if (r.canonical_guest_id && r.canonical_guest_id !== local) {
      localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
      setGuestId(r.canonical_guest_id);
    }
    try {
      const me = await api.authMe(token);
      setAccount(me.user);
    } catch (e) { /* account fetch best-effort */ }
    return { ...r, mode: res.mode };
  };

  // Legacy popup flow kept only for rollback — NOT used by Continue with Google.
  const signInWithGoogle = async () => {
    await fbSignInGoogle();
    const token = await getIdToken(true);
    const local = localStorage.getItem(GUEST_KEY);
    const r = await api.authCompleteLink(token, { current_guest_id: local, profession_id: "hospitality" });
    if (r.canonical_guest_id && r.canonical_guest_id !== local) {
      localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
      setGuestId(r.canonical_guest_id);
    }
    try {
      const me = await api.authMe(token);
      setAccount(me.user);
    } catch {}
    return r;
  };

  const logout = async () => {
    try { await firebaseSignOut(); } catch {}
    localStorage.removeItem(GUEST_KEY);
    setGuest(null);
    setGuestId(null);
    setAccount(null);
    // Fresh anonymous session + fresh guest so the previous user's data is never shown.
    await ensureAnonymous();
    const token = await getIdToken(true);
    const r = await api.authBootstrap(token, { current_guest_id: null, profession_id: "hospitality" });
    localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
    setGuestId(r.canonical_guest_id);
  };

  const deleteAccount = async () => {
    const token = await getIdToken(true);
    await api.deleteAccount(token); // backend deletes learning data + user + Firebase Auth user
    try { await deleteFirebaseUser(); } catch {}
    try { await firebaseSignOut(); } catch {}
    localStorage.removeItem(GUEST_KEY);
    setGuest(null);
    setGuestId(null);
    setAccount(null);
    await ensureAnonymous();
    const t2 = await getIdToken(true);
    const r = await api.authBootstrap(t2, { current_guest_id: null, profession_id: "hospitality" });
    localStorage.setItem(GUEST_KEY, r.canonical_guest_id);
    setGuestId(r.canonical_guest_id);
  };

  const value = {
    guestId,
    guest,
    loading,
    profile,
    legacyOnboarding,
    onboardingCompleted: !!guest?.onboarding_completed,
    language,
    t,
    setLanguage,
    ensureGuest,
    refreshGuest,
    completeProfile,
    logFlashcard,
    logCompletion,
    savedPhraseIds: guest?.saved_emergency_phrase_ids || [],
    saveEmergencyPhrase,
    removeEmergencyPhrase,
    // Accounts/Auth
    account,
    authReady,
    isAuthenticated: !!account,
    connectGoogle,
    connectApple,
    reauthGoogle,
    signInWithGoogle,
    logout,
    deleteAccount,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
