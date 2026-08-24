import { createContext, useContext, useEffect, useRef, useState } from "react";
import * as api from "@/lib/api";

const AppContext = createContext(null);

const GUEST_KEY = "iph_guest_id";
// Temporary onboarding draft (allowed in localStorage). MongoDB is the source of truth
// for the *completed* profile.
export const DRAFT_KEY = "iph_onboarding_draft";

export function AppProvider({ children }) {
  const [guestId, setGuestId] = useState(() => localStorage.getItem(GUEST_KEY) || null);
  const [guest, setGuest] = useState(null);
  // `loading` is true until the initial guest fetch settles (only if a guestId exists).
  const [loading, setLoading] = useState(() => !!localStorage.getItem(GUEST_KEY));
  const creatingRef = useRef(null);

  useEffect(() => {
    let active = true;
    if (!guestId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .getGuest(guestId)
      .then((g) => active && setGuest(g))
      .catch(() => {
        // Stale/unknown id (e.g. DB reset): drop it so the user can start fresh.
        localStorage.removeItem(GUEST_KEY);
        if (active) setGuestId(null);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [guestId]);

  // Returns an existing guest id or creates one. Never creates duplicates.
  const ensureGuest = async () => {
    if (guestId) return guestId;
    if (creatingRef.current) return creatingRef.current;
    creatingRef.current = api.createGuest().then((g) => {
      localStorage.setItem(GUEST_KEY, g.id);
      setGuestId(g.id);
      setGuest(g);
      return g.id;
    });
    return creatingRef.current;
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
