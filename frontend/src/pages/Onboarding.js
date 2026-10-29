import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check, Loader2 } from "lucide-react";
import CategoryIcon from "@/components/CategoryIcon";
import {
  getProfessionalProfiles,
  getVenueTypes,
  getTargetCountries,
  getLearningGoals,
  getRecommendedSituations,
  getSituation,
} from "@/lib/api";
import { legacyWorkplaceToRole } from "@/lib/content";
import { getLocalizedField, SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { isFreeSituation, freeSlugs } from "@/lib/accessConfig";
import { useApp, DRAFT_KEY } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { btnDark, focusRing } from "@/components/SettingsLayout";

const emptySelections = { interface_language: "", role: "", venue_type: "", target_country: "", goal: "", employment_status: "" };

// Employment status is a fixed set (not a backend taxonomy); labels come from i18n.
const EMPLOYMENT_OPTIONS = ["looking_for_job", "interview_soon", "starting_new_job", "already_working"];

// 6 functional steps: language first, then the professional profile.
const STEPS = [
  { id: "language", field: "interface_language", layout: "grid" },
  { id: "role", field: "role", layout: "large" },
  { id: "venue", field: "venue_type", layout: "grid" },
  { id: "country", field: "target_country", layout: "grid" },
  { id: "goal", field: "goal", layout: "list" },
  { id: "employment", field: "employment_status", layout: "list" },
];

function loadDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
  } catch {
    return null;
  }
}

export function OnboardingOption({ selected, label, description, icon, onSelect, testid, layout }) {
  const large = layout === "large";
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testid}
      onClick={onSelect}
      className={`flex items-center gap-3 w-full text-left rounded-2xl border transition-colors ${focusRing} ${
        large ? "px-5 py-5 min-h-[88px]" : layout === "grid" ? "px-4 py-3 min-h-[56px]" : "px-5 py-4 min-h-[60px]"
      } ${selected ? "border-2 border-[#173D31] bg-[#EEF3EF]" : "border-[#DEE2DE] bg-white hover:border-[#173D31]/40"}`}
    >
      {icon && (
        <span aria-hidden="true" className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${selected ? "bg-[#173D31] text-white" : "bg-[#EEF3EF] text-[#173D31]"}`}>
          <CategoryIcon name={icon} className="w-5 h-5" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={`block text-[#222824] ${large ? "text-[18px] font-semibold" : "text-[15px] sm:text-[16px] font-medium"}`}>{label}</span>
        {description && <span className="block mt-0.5 text-[14px] text-[#6B736E] leading-snug">{description}</span>}
      </span>
      <span aria-hidden="true" className={`grid place-items-center w-5 h-5 rounded-full shrink-0 ${selected ? "bg-[#173D31]" : "border-2 border-[#DEE2DE]"}`}>
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

function OnboardingProgress({ step, total, label }) {
  return (
    <div
      data-testid="onboarding-progress"
      role="progressbar"
      aria-label={label}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-[#173D31]" : "bg-[#DEE2DE]"}`} />
      ))}
    </div>
  );
}

function OnboardingComplete({ t, recs, onStart }) {
  return (
    <motion.div data-testid="onboarding-complete" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex-1 flex flex-col">
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[#34785B]">{t("onboarding.doneEyebrow")}</p>
      <h1 className="mt-3 text-[30px] sm:text-[34px] leading-tight font-serif font-semibold text-[#222824]">{t("onboarding.doneTitle")}</h1>
      <p data-testid="onboarding-free-note" className="mt-3 text-[15px] text-[#6B736E] leading-relaxed">{t("onboarding.doneFreeNote")}</p>
      <ol className="mt-6 space-y-3" data-testid="onboarding-recommendations">
        {recs.map((s, i) => (
          <li key={s.slug} data-testid={`onboarding-rec-${s.slug}`} className="flex items-start gap-4 rounded-2xl border border-[#DEE2DE] bg-white px-5 py-4">
            <span aria-hidden="true" className="grid place-items-center w-8 h-8 rounded-full bg-[#EEF3EF] text-[#173D31] text-[14px] font-semibold shrink-0">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-[16px] font-semibold text-[#222824]">{s.title}</span>
              {s.description && <span className="block mt-0.5 text-[14px] text-[#6B736E] leading-snug">{s.description}</span>}
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-auto pt-8 sticky bottom-0 bg-[#F7F5F0] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <button type="button" data-testid="onboarding-start-learning-btn" onClick={onStart} className={`w-full ${btnDark}`}>
          {t("onboarding.finish")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </motion.div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { loading, onboardingCompleted, legacyOnboarding, completeProfile, language, setLanguage, t } = useApp();
  const billing = useBilling();

  const [taxonomies, setTaxonomies] = useState(null);
  const [optionsError, setOptionsError] = useState(false);
  const [step, setStep] = useState(() => loadDraft()?.step || 0);
  const [selections, setSelections] = useState(
    () => loadDraft()?.selections || { ...emptySelections, interface_language: language }
  );
  const [saving, setSaving] = useState(false);
  const [recs, setRecs] = useState(null);
  const finishingRef = useRef(false);

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
    if (!loading && onboardingCompleted && !finishingRef.current) navigate("/home", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    const role = legacyWorkplaceToRole[legacyOnboarding?.workplace];
    if (role) setSelections((s) => (s.role ? s : { ...s, role }));
  }, [legacyOnboarding]);

  useEffect(() => {
    if (!finishingRef.current) localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, selections }));
  }, [step, selections]);

  const current = STEPS[step];
  const currentValue = current.field === "interface_language" ? language : selections[current.field];
  const isLast = step === STEPS.length - 1;
  const isTaxonomy = current.id !== "language" && current.id !== "employment";

  let currentOptions = [];
  if (current.id === "language") {
    currentOptions = SUPPORTED_LANGUAGES.map((l) => ({ value: l.code, label: l.native_name }));
  } else if (current.id === "employment") {
    currentOptions = EMPLOYMENT_OPTIONS.map((id) => ({ value: id, label: t(`onboarding.employment.${id}`) }));
  } else if (taxonomies) {
    currentOptions = (taxonomies[current.field] || []).map((item) => ({
      value: item.slug || item.id,
      label: getLocalizedField(item, "name", language),
      description: current.id === "role" ? getLocalizedField(item, "description", language) : null,
      icon: current.id === "role" ? item.icon : null,
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

  // Shows up to 3 existing recommendations; never blocks reaching /home.
  // Free: only the role's free situations (existing recs first, then free config order).
  const showRecommendations = async (guestIdValue, role) => {
    try {
      const premium = billing.ready && billing.isPremium("hospitality");
      const list = (await getRecommendedSituations(guestIdValue, { limit: 10 })) || [];
      let top = premium ? list.slice(0, 3) : list.filter((s) => isFreeSituation(s.slug, "hospitality", role)).slice(0, 3);
      if (!premium && top.length < 3) {
        const have = new Set(top.map((s) => s.slug));
        const missing = [...freeSlugs("hospitality", role)].filter((slug) => !have.has(slug)).slice(0, 3 - top.length);
        const extra = await Promise.all(missing.map((slug) => getSituation(slug).catch(() => null)));
        top = [...top, ...extra.filter(Boolean).map((x) => ({ slug: x.slug, title: getLocalizedField(x, "title", language), description: getLocalizedField(x, "description", language) }))];
      }
      if (top.length === 0) throw new Error("empty");
      setRecs(top);
    } catch {
      navigate("/home", { replace: true });
    }
  };

  const goNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    setSaving(true);
    finishingRef.current = true;
    try {
      const updated = await completeProfile({
        role: selections.role,
        venue_type: selections.venue_type,
        target_country: selections.target_country,
        goal: selections.goal,
        employment_status: selections.employment_status,
      });
      await showRecommendations(updated.id, selections.role);
    } catch (e) {
      finishingRef.current = false;
      setSaving(false);
    }
  };

  const questionId = `onboarding-q-${current.id}`;

  return (
    <div className="min-h-[100dvh] bg-[#F7F5F0] flex flex-col" data-testid="onboarding-page">
      <div className="flex-1 flex flex-col w-full max-w-xl mx-auto px-5 sm:px-8 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {recs ? (
          <div className="flex-1 flex flex-col pt-10">
            <OnboardingComplete t={t} recs={recs} onStart={() => navigate("/home", { replace: true })} />
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between h-14">
              <button
                type="button"
                data-testid="onboarding-back-btn"
                onClick={goBack}
                disabled={saving}
                aria-label={t("common.back")}
                className={`-ml-2 grid place-items-center w-11 h-11 rounded-full text-[#173D31] hover:bg-white transition-colors disabled:opacity-40 ${focusRing}`}
              >
                <ArrowLeft className="w-5 h-5" aria-hidden="true" />
              </button>
              <span data-testid="onboarding-step-indicator" aria-live="polite" className="text-[13px] font-medium text-[#6B736E]">
                {t("onboarding.step", { n: step + 1, total: STEPS.length })}
              </span>
            </header>
            <OnboardingProgress step={step} total={STEPS.length} label={t("onboarding.progressAria")} />

            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="flex-1 flex flex-col pt-8"
              >
                {step === 0 && (
                  <p data-testid="onboarding-intro" className="mb-3 text-[15px] text-[#34785B] font-medium">{t("onboarding.intro")}</p>
                )}
                <h1 id={questionId} className="text-[28px] sm:text-[34px] leading-tight font-serif font-semibold text-[#222824]">
                  {t(`onboarding.${current.id}.q`)}
                </h1>
                <p className="mt-2 text-[15px] text-[#6B736E] leading-relaxed">{t(`onboarding.${current.id}.sub`)}</p>

                <div
                  role="radiogroup"
                  aria-labelledby={questionId}
                  data-testid={`onboarding-options-${current.field}`}
                  className={`mt-7 grid gap-3 ${current.layout === "grid" ? "grid-cols-2" : "grid-cols-1"}`}
                >
                  {optionsError && isTaxonomy && (
                    <p role="alert" className="col-span-full text-[#A44F3B]">{t("onboarding.optionsError")}</p>
                  )}
                  {isTaxonomy && !taxonomies && !optionsError && (
                    <p role="status" className="col-span-full flex items-center gap-2 text-[#6B736E]">
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("onboarding.optionsLoading")}
                    </p>
                  )}
                  {currentOptions.map((opt) => (
                    <OnboardingOption
                      key={opt.value}
                      testid={`onboarding-option-${current.field}-${opt.value}`}
                      selected={currentValue === opt.value}
                      label={opt.label}
                      description={opt.description}
                      icon={opt.icon}
                      layout={current.layout}
                      onSelect={() => select(opt.value)}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="sticky bottom-0 mt-8 bg-[#F7F5F0] pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                data-testid={isLast ? "onboarding-finish-btn" : "onboarding-continue-btn"}
                disabled={!currentValue || saving}
                onClick={goNext}
                aria-busy={saving}
                className={`w-full ${btnDark}`}
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("onboarding.preparing")}</>
                ) : (
                  <>{t("common.continue")} <ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
