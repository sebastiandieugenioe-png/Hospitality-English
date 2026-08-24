import { useEffect, useMemo, useState } from "react";
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
import { onboardingSteps, legacyWorkplaceToRole } from "@/lib/content";
import { useApp, DRAFT_KEY } from "@/context/AppContext";

const emptySelections = { role: "", venue_type: "", target_country: "", goal: "" };

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { loading, onboardingCompleted, legacyOnboarding, completeProfile } = useApp();

  const [options, setOptions] = useState(null); // {role, venue_type, target_country, goal}
  const [optionsError, setOptionsError] = useState(false);
  const [step, setStep] = useState(() => loadDraft()?.step || 0);
  const [selections, setSelections] = useState(() => loadDraft()?.selections || emptySelections);
  const [saving, setSaving] = useState(false);

  // Load taxonomies from backend (single source of truth, no duplicated strings).
  useEffect(() => {
    Promise.all([
      getProfessionalProfiles(),
      getVenueTypes(),
      getTargetCountries(),
      getLearningGoals(),
    ])
      .then(([roles, venues, countries, goals]) => {
        setOptions({
          role: roles.map((r) => ({ value: r.slug, label: r.name_es, icon: r.icon })),
          venue_type: venues.map((v) => ({ value: v.slug, label: v.name_es })),
          target_country: countries.map((c) => ({ value: c.id, label: c.name_es, flag: c.flag })),
          goal: goals.map((g) => ({ value: g.id, label: g.name_es })),
        });
      })
      .catch(() => setOptionsError(true));
  }, []);

  // Already-completed users should not see onboarding again.
  useEffect(() => {
    if (!loading && onboardingCompleted) navigate("/home", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  // Safe prefill: map a legacy guest's old workplace to the new role (only if unset).
  useEffect(() => {
    const role = legacyWorkplaceToRole[legacyOnboarding?.workplace];
    if (role) setSelections((s) => (s.role ? s : { ...s, role }));
  }, [legacyOnboarding]);

  // Persist temporary draft so refresh mid-onboarding does not lose progress.
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, selections }));
  }, [step, selections]);

  const current = onboardingSteps[step];
  const currentValue = selections[current.field];
  const isLast = step === onboardingSteps.length - 1;
  const currentOptions = options?.[current.field] || [];

  const select = (value) => setSelections((s) => ({ ...s, [current.field]: value }));

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
      await completeProfile(selections);
      navigate("/home", { replace: true });
    } catch (e) {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col w-full max-w-xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {/* Step indicator + progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span
              data-testid="onboarding-step-indicator"
              className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-charcoal/50"
            >
              Paso {step + 1} de {onboardingSteps.length}
            </span>
          </div>
          <div
            data-testid="onboarding-progress"
            className="h-1 w-full rounded-full bg-black/5 overflow-hidden"
          >
            <div
              className="h-full bg-brand-forest transition-all duration-300"
              style={{ width: `${((step + 1) / onboardingSteps.length) * 100}%` }}
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
              {current.question}
            </h1>
            <p className="mt-3 text-base text-brand-charcoal/70 leading-relaxed">
              {current.subtitle}
            </p>

            <div className="mt-8 grid gap-3" data-testid={`onboarding-options-${current.field}`}>
              {optionsError && (
                <p className="text-brand-terracotta">No se pudieron cargar las opciones. Reintenta.</p>
              )}
              {!options && !optionsError && (
                <p className="text-brand-charcoal/50">Cargando opciones…</p>
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
                    {current.field === "target_country" && (
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

        {/* Nav buttons */}
        <div className="mt-8 flex gap-3">
          <button
            data-testid="onboarding-back-btn"
            onClick={goBack}
            className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest border border-brand-forest/20 hover:bg-brand-sand transition-colors rounded-lg px-5 py-4 font-medium shrink-0"
            aria-label="Atrás"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            data-testid={isLast ? "onboarding-finish-btn" : "onboarding-continue-btn"}
            disabled={!currentValue || saving}
            onClick={goNext}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
          >
            {isLast ? (saving ? "Preparando…" : "Empezar a aprender") : "Continuar"}
            {!saving && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
