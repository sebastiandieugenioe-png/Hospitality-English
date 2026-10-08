// Central, profession-aware billing config owned by EnglishToWork.
// HospitalityEnglish is just one vertical; future professions plug in here.
// NOTE: do not add domain-specific flags (e.g. hospitality_subscription=true).
export const PROFESSION_BILLING_CONFIG = {
  hospitality: {
    entitlementId: "hospitality_premium",
    offeringId: "hospitality_default",
  },
  // Future verticals (NOT implemented yet):
  // nursing:     { entitlementId: "nursing_premium",     offeringId: "nursing_default" },
  // pharmacy:    { entitlementId: "pharmacy_premium",    offeringId: "pharmacy_default" },
  // cabin_crew:  { entitlementId: "cabin_crew_premium",  offeringId: "cabin_crew_default" },
  // sales:       { entitlementId: "sales_premium",       offeringId: "sales_default" },
  // electricians:{ entitlementId: "electricians_premium",offeringId: "electricians_default" },
};

export function billingConfigFor(professionId) {
  return PROFESSION_BILLING_CONFIG[professionId] || null;
}
