// Localized labels for the professional profile (taxonomies resolved from existing APIs).
import { useEffect, useState } from "react";
import { getProfessionalProfiles, getVenueTypes, getTargetCountries, getLearningGoals } from "@/lib/api";
import { getLocalizedField } from "@/lib/i18n";

export function useProfileTaxonomies() {
  const [tax, setTax] = useState(null);
  useEffect(() => {
    Promise.all([getProfessionalProfiles(), getVenueTypes(), getTargetCountries(), getLearningGoals()])
      .then(([roles, venues, countries, goals]) => setTax({ roles, venues, countries, goals }))
      .catch(() => setTax({ roles: [], venues: [], countries: [], goals: [] }));
  }, []);
  return tax;
}

export function profileLabels(profile, tax, language, t) {
  if (!profile || !tax) return {};
  const name = (list, key, val) => getLocalizedField((list || []).find((x) => x[key] === val), "name", language) || null;
  return {
    role: name(tax.roles, "slug", profile.role),
    venue: name(tax.venues, "slug", profile.venue_type),
    country: name(tax.countries, "id", profile.target_country),
    goal: name(tax.goals, "id", profile.goal),
    employment: profile.employment_status ? t(`onboarding.employment.${profile.employment_status}`) : null,
    level: profile.english_level ? String(profile.english_level).toUpperCase() : null,
  };
}
