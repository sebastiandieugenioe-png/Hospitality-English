import { createContext, useContext, useEffect, useState } from "react";
import * as api from "@/lib/api";

const AppContext = createContext(null);

const GUEST_KEY = "iph_guest_id";
const ONBOARDING_KEY = "iph_onboarding";

export function AppProvider({ children }) {
  const [guestId, setGuestId] = useState(() => localStorage.getItem(GUEST_KEY) || null);
  const [onboarding, setOnboardingState] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(ONBOARDING_KEY)) || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (onboarding) localStorage.setItem(ONBOARDING_KEY, JSON.stringify(onboarding));
  }, [onboarding]);

  // Creates (or reuses) an anonymous guest in the backend and persists onboarding.
  const completeOnboarding = async ({ workplace, goal }) => {
    const data = { workplace, goal };
    setOnboardingState(data);
    try {
      if (guestId) {
        await api.updateOnboarding(guestId, data);
        return guestId;
      }
      const guest = await api.createGuest(data);
      localStorage.setItem(GUEST_KEY, guest.id);
      setGuestId(guest.id);
      return guest.id;
    } catch (e) {
      // Backend unavailable: keep local onboarding so the flow is never blocked.
      console.error("Onboarding sync failed", e);
      return null;
    }
  };

  const logFlashcard = async (learningItemId, knew) => {
    if (!guestId) return;
    try {
      await api.recordFlashcard(guestId, { learning_item_id: learningItemId, knew });
    } catch (e) {
      console.error("Flashcard sync failed", e);
    }
  };

  const logCompletion = async (situationSlug, score, total) => {
    if (!guestId) return;
    try {
      await api.recordCompletion(guestId, { situation_slug: situationSlug, score, total });
    } catch (e) {
      console.error("Completion sync failed", e);
    }
  };

  const value = {
    guestId,
    onboarding,
    hasOnboarded: !!onboarding,
    completeOnboarding,
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
