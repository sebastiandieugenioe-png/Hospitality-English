import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import CategoryIcon from "@/components/CategoryIcon";
import {
  getProfessionalProfiles,
  getVenueTypes,
  getTargetCountries,
  getLearningGoals,
} from "@/lib/api";
import { legacyWorkplaceToRole } from "@/lib/content";
import { getLocalizedField, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { useApp, DRAFT_KEY } from "@/context/AppContext";

const emptySelections = { interface_language: "", role: "", venue_type: "", target_country: "", goal: "" };

// 5 functional steps: language first, then the professional profile.
const STEPS = [
  { id: "language", field: "interface_language" },
  { id: "role", field: "role" },
  { id: "venue", field: "venue_type" },
  { id: "country", field: "target_country" },
  { id: "goal", field: "goal" },
];

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { loading, onboardingCompleted, legacyOnboarding, completeProfile, language, setLanguage, t } = useApp();

  const [taxonomies, setTaxonomies] = useState(null);
  const [optionsError, setOptionsError] = useState(false);
  const [step, setStep] = useState(() => loadDraft()?.step || 0);
  const [selections, setSelections] = useState(
    () => loadDraft()?.selections || { ...emptySelections, interface_language: language }
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      getProfessionalProfiles(),
      getVenueTypes(),
      getTargetCountries(),
      getLearningGoals(),
    ])
      .then(([roles, venues, countries, goals]) => setTaxonomies({ role: roles, venue_type: venues, target_country: countries, goal: goals }))
      .catch(() => setOptionsError(true));
  }, []);

  useEffect(() => {
    if (!loading && onboardingCompleted) navigate("/home", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    const role = legacyWorkplaceToRole[legacyOnboarding?.workplace];
    if (role) setSelections((s) => (s.role ? s : { ...s, role }));
  }, [legacyOnboarding]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, selections }));
  }, [step, selections]);

  const current = STEPS[step];
  const currentValue = current.field === "interface_language" ? language : selections[current.field];
  const isLast = step === STEPS.length - 1;

  // Build localized options for the current step.
  let currentOptions = [];
  if (current.id === "language") {
    currentOptions = SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.native_name, flag: l.flag }));
  } else if (taxonomies) {
    currentOptions = (taxonomies[current.field] || []).map((item) => ({
      value: item.slug || item.id,
      label: getLocalizedField(item, "name", language),
      icon: item.icon,
      flag: item.flag,
    }));
  }

  const select = (value) => {
    if (current.field === "interface_language") {
      setLanguage(value); // updates UI immediately + persists (once a guest exists)
      setSelections((s) => ({ ...s, interface_language: value }));
    } else {
      setSelections((s) => ({ ...s, [current.field]: value }));
    }
  };

  const goBack = () => {
    if (step === 0) navigate("/");
    else setStep((s) => s - 1);
  };

  const goNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    try {
      await completeProfile({
        role: selections.role,
        venue_type: selections.venue_type,
        target_country: selections.target_country,
        goal: selections.goal,
      });
      navigate("/home", { replace: true });
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col w-full max-w-xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span
              data-testid="onboarding-step-indicator"
              className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-charcoal/50"
            >
              {t("onboarding.step", { n: step + 1, total: STEPS.length })}
            </span>
          </div>
          <div data-testid="onboarding-progress" className="h-1 w-full rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-brand-forest transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28 }}
            className="flex-1 flex flex-col"
          >
            <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
              {t(`onboarding.${current.id}.q`)}
            </h1>
            <p className="mt-3 text-base text-brand-charcoal/70 leading-relaxed">
              {t(`onboarding.${current.id}.sub`)}
            </p>

            <div className="mt-8 grid gap-3" data-testid={`onboarding-options-${current.field}`}>
              {optionsError && current.id !== "language" && (
                <p className="text-brand-terracotta">{t("onboarding.optionsError")}</p>
              )}
              {current.id !== "language" && !taxonomies && !optionsError && (
                <p className="text-brand-charcoal/50">{t("onboarding.optionsLoading")}</p>
              )}
              {currentOptions.map((opt) => {
                const selected = currentValue === opt.value;
                return (
                  <button
                    key={opt.value}
                    data-testid={`onboarding-option-${current.field}-${opt.value}`}
                    onClick={() => select(opt.value)}
                    className={`flex items-center gap-4 w-full text-left rounded-xl border px-5 py-4 min-h-[64px] transition-all ${
                      selected
                        ? "border-brand-forest bg-brand-success-muted"
                        : "border-black/5 bg-white hover:border-brand-forest/30"
                    }`}
                  >
                    {current.field === "role" && (
                      <span
                        className={`grid place-items-center w-11 h-11 rounded-lg shrink-0 ${
                          selected ? "bg-brand-forest text-white" : "bg-brand-success-muted text-brand-forest"
                        }`}
                      >
                        <CategoryIcon name={opt.icon} className="w-5 h-5" />
                      </span>
                    )}
                    {(current.field === "target_country" || current.field === "interface_language") && (
                      <span className="text-2xl shrink-0" aria-hidden="true">
                        {opt.flag}
                      </span>
                    )}
                    <span className="flex-1 text-base text-brand-charcoal">{opt.label}</span>
                    {selected && <Check className="w-5 h-5 text-brand-forest shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-3">
          <button
            data-testid="onboarding-back-btn"
            onClick={goBack}
            className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest border border-brand-forest/20 hover:bg-brand-sand transition-colors rounded-lg px-5 py-4 font-medium shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            data-testid={isLast ? "onboarding-finish-btn" : "onboarding-continue-btn"}
            disabled={!currentValue || saving}
            onClick={goNext}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
          >
            {isLast ? (saving ? t("onboarding.preparing") : t("onboarding.finish")) : t("common.continue")}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
