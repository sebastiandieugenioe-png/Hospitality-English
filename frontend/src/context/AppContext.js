import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as api from "@/lib/api";
import { makeT, detectBrowserLanguage, DEFAULT_LANGUAGE, SUPPORTED_CODES } from "@/lib/i18n";

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
  const completeProfile = async ({ role, venue_type, target_country, goal }) => {
    const id = await ensureGuest();
    const updated = await api.updateProfile(id, { role, venue_type, target_country, goal });
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

  const profile = guest?.professional_profile || null;
  const legacyOnboarding = guest?.onboarding || null;

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
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
