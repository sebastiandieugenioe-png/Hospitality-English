// Central, profession-aware freemium access config (mirrors backend billing_access.py).
// Used for instant UI gating; RevenueCat entitlement is the source of truth for premium.
export const FREE_SITUATIONS_BY_ROLE = {
  hospitality: {
    bartender: [
      "guest-arrives-at-the-bar",
      "taking-a-drinks-order",
      "recommending-drinks",
      "guest-asks-about-cocktail-allergens",
      "handling-a-complaint",
    ],
    waiter: [
      "welcoming-guests",
      "guest-is-not-ready-to-order",
      "allergies-and-dietary-requirements",
      "explaining-the-menu",
      "bringing-the-bill",
    ],
  },
};

export function freeSlugs(professionId = "hospitality", role = null) {
  const byRole = FREE_SITUATIONS_BY_ROLE[professionId] || {};
  if (role) return new Set(byRole[role] || []);
  const out = new Set();
  Object.values(byRole).forEach((arr) => arr.forEach((s) => out.add(s)));
  return out;
}

export function isFreeSituation(situationSlug, professionId = "hospitality", role = null) {
  return freeSlugs(professionId, role).has(situationSlug);
}

export function requiresPremium(professionId = "hospitality", role = null, situationSlug = null) {
  return !isFreeSituation(situationSlug, professionId, role);
}

// Central access rule. Premium entitlement unlocks everything; otherwise only the
// role's 5 free situations are accessible.
export function canAccessSituation({ professionId = "hospitality", role, situationSlug, isPremium }) {
  if (isPremium) return true;
  return freeSlugs(professionId, role).has(situationSlug);
}
