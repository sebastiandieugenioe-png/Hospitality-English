import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, CircleCheck, ClipboardCheck, RotateCcw, Sparkles, RotateCw } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePremium } from "@/components/PremiumGate";
import { getSkills, getSituations, getSituationStats, getProfessionalProfiles, getReviewItems, getAssessmentSummary, getAssessmentMeta } from "@/lib/api";
import { countPracticed, groupBySkill, freeProgress } from "@/lib/progress";
import { getLocalizedField, getText } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";

const PROFESSION = "hospitality";
const eyebrow = "text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]";
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31]";
const btnDark = `inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] bg-[#173D31] text-white hover:bg-[#102E25] transition-colors ${focusRing}`;
const btnLight = `inline-flex items-center justify-center gap-2 min-h-[44px] px-5 rounded-[15px] font-semibold text-[15px] border border-[#DEE2DE] bg-white text-[#173D31] hover:bg-[#EEF3EF] transition-colors ${focusRing}`;

function Bar({ value, max, label }) {
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}
      className="h-1.5 w-full rounded-full bg-[#DEE2DE] overflow-hidden">
      <div className="h-full bg-[#173D31] rounded-full transition-[width] duration-500" style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

export default function Progress() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, guestId, language, t } = useApp();
  const billing = useBilling();
  const premium = billing.isPremium(PROFESSION);
  const { requestPremium } = usePremium();
  const [data, setData] = useState(null); // { skills, situations, stats }
  const [error, setError] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [review, setReview] = useState(null); // { total, due }
  const [assessment, setAssessment] = useState(null);
  const [assessmentMeta, setAssessmentMeta] = useState(null);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  const load = () => {
    if (!profile?.role || !guestId) return;
    setError(false);
    Promise.all([getSkills({ role: profile.role }), getSituations({ role: profile.role }), getSituationStats(guestId)])
      .then(([skills, situations, stats]) => setData({ skills, situations, stats: stats || {} }))
      .catch(() => setError(true));
  };
  useEffect(load, [profile, guestId, language]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!profile?.role) return;
    getProfessionalProfiles()
      .then((roles) => setRoleName(getLocalizedField(roles.find((r) => r.slug === profile.role), "name", language)))
      .catch(() => {});
  }, [profile, language]);

  useEffect(() => {
    if (!guestId || (!billing.ready && billing.status !== "error")) return;
    const p = { free_only: !premium };
    Promise.all([getReviewItems(guestId, p), getReviewItems(guestId, { due: true, limit: 200, ...p })])
      .then(([all, due]) => setReview({ total: all.length, due: due.length }))
      .catch(() => setReview(null));
  }, [guestId, premium, billing.ready, billing.status]);

  useEffect(() => {
    getAssessmentMeta().then(setAssessmentMeta).catch(() => {});
    if (guestId) getAssessmentSummary(guestId).then(setAssessment).catch(() => {});
  }, [guestId]);

  const subline = [t("home.professionHospitality"), roleName].filter(Boolean).join(" · ");
  const practiced = data ? countPracticed(data.situations, data.stats) : 0;

  return (
    <AppShell title={t("nav.progress")}>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-8 pb-10 sm:pt-12 space-y-8" data-testid="progress-page">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-[30px] leading-tight sm:text-4xl font-serif font-bold text-[#222824] tracking-tight">{t("nav.progress")}</h1>
          <p data-testid="progress-plan-label" className="mt-1.5 text-[15px] text-[#6B736E]">{subline}</p>
        </motion.header>

        {error ? (
          <div data-testid="progress-error-state" className="rounded-2xl bg-white border border-[#DEE2DE] p-6 text-center">
            <p className="text-[15px] text-[#6B736E]">{t("practice.errorBody")}</p>
            <button type="button" data-testid="progress-retry-btn" onClick={load} className={`mt-4 ${btnDark}`}>
              <RotateCw className="w-4 h-4" aria-hidden="true" /> {t("common.retry")}
            </button>
          </div>
        ) : !data ? (
          <div data-testid="progress-loading" className="space-y-3">
            <div className="h-[120px] rounded-2xl bg-[#EEF3EF] animate-pulse" />
            <div className="h-[220px] rounded-2xl bg-[#EEF3EF] animate-pulse" />
          </div>
        ) : (
          <>
            <ProfessionProgress
              practiced={practiced}
              total={data.situations.length}
              free={freeProgress(data.situations, data.stats, { professionId: PROFESSION, role: profile?.role })}
              premium={premium}
              billingReady={billing.ready}
              t={t}
              onLearn={() => navigate("/learn")}
              onPremium={() => requestPremium()}
            />
            <SkillProgress groups={groupBySkill(data.situations, data.skills)} skills={data.skills} stats={data.stats} language={language} t={t} onOpen={() => navigate("/learn")} />
          </>
        )}

        {review && <ReviewSummary review={review} t={t} onOpen={() => navigate("/practice")} />}

        {assessmentMeta && (
          <AssessmentSummary summary={assessment} meta={assessmentMeta} language={language} t={t} onOpen={() => navigate("/assessment")} />
        )}
      </main>
    </AppShell>
  );
}

function ProfessionProgress({ practiced, total, free, premium, billingReady, t, onLearn, onPremium }) {
  if (practiced === 0) {
    return (
      <section data-testid="progress-overall" data-state="new" className="rounded-2xl bg-white border border-[#DEE2DE] p-6">
        <span className="grid place-items-center w-11 h-11 rounded-xl bg-[#EEF3EF] text-[#173D31]"><Sparkles className="w-5 h-5" aria-hidden="true" /></span>
        <h2 className="mt-4 text-[22px] leading-tight font-serif font-semibold text-[#222824]">{t("progress.startsHereTitle")}</h2>
        <p className="mt-1 text-[15px] text-[#6B736E]">{t("progress.startsHereBody")}</p>
        <button type="button" data-testid="progress-start-learning-btn" onClick={onLearn} className={`mt-5 w-full sm:w-auto ${btnDark}`}>
          {t("practice.startLearning")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </section>
    );
  }
  if (premium) {
    const label = t("progress.overallOf", { n: practiced, total });
    return (
      <section data-testid="progress-overall" data-state="premium" className="rounded-2xl bg-white border border-[#DEE2DE] p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-3">
          <p data-testid="progress-overall-label" className="text-[17px] font-semibold text-[#222824]">{label}</p>
          <span data-testid="progress-overall-percent" className="text-[15px] font-semibold text-[#173D31] tabular-nums">{Math.round((practiced / total) * 100)}%</span>
        </div>
        <div className="mt-3"><Bar value={practiced} max={total} label={label} /></div>
      </section>
    );
  }
  const label = practiced === 1 ? t("learn.practicedOne") : t("learn.practicedOther", { n: practiced });
  return (
    <section data-testid="progress-overall" data-state={free.allDone ? "free-complete" : "free"} className="rounded-2xl bg-white border border-[#DEE2DE] p-5 sm:p-6">
      <p data-testid="progress-overall-label" className="text-[17px] font-semibold text-[#222824]">{label}</p>
      {free.allDone ? (
        <>
          <p data-testid="progress-all-free-done" className="mt-2 flex items-center gap-2 text-[15px] text-[#34785B] font-medium">
            <CircleCheck className="w-5 h-5 shrink-0" aria-hidden="true" /> {t("learn.allFreeDone")}
          </p>
          <p className="mt-1 text-[15px] text-[#6B736E]">{t("progress.moreWithPremium", { n: total - free.total })}</p>
          {billingReady && (
            <button type="button" data-testid="progress-explore-premium-btn" onClick={onPremium} className={`mt-4 ${btnDark}`}>
              {t("progress.explorePremium")}
            </button>
          )}
        </>
      ) : (
        <div className="mt-3"><Bar value={free.practiced} max={free.total} label={t("progress.freeBarAria", { n: free.practiced, total: free.total })} /></div>
      )}
    </section>
  );
}

function SkillProgress({ groups, skills, stats, language, t, onOpen }) {
  const name = (id) => getLocalizedField(skills.find((s) => s.id === id), "name", language) || id;
  return (
    <section aria-labelledby="progress-skills-title">
      <h2 id="progress-skills-title" className={`${eyebrow} mb-3 px-1`}>{t("progress.yourSkills")}</h2>
      <ul className="rounded-2xl border border-[#DEE2DE] bg-white divide-y divide-[#DEE2DE] overflow-hidden" data-testid="progress-skill-list">
        {groups.map(([id, sits]) => {
          const done = countPracticed(sits, stats);
          const label = t("progress.skillPracticed", { n: done, total: sits.length });
          return (
            <li key={id}>
              <button type="button" data-testid={`progress-skill-${id}`} onClick={onOpen}
                className="w-full min-h-[64px] flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5F0] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#173D31]">
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[16px] font-medium text-[#222824]">{name(id)}</span>
                    <span data-testid={`progress-skill-count-${id}`} className="text-[13px] text-[#6B736E] tabular-nums shrink-0">{label}</span>
                  </span>
                  <span className="mt-2 block"><Bar value={done} max={sits.length} label={`${name(id)}: ${label}`} /></span>
                </span>
                <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ReviewSummary({ review, t, onOpen }) {
  const state = review.total === 0 ? "empty" : review.due > 0 ? "due" : "caught-up";
  const title = state === "due"
    ? (review.due === 1 ? t("home.reviewDueOne") : t("home.reviewDueOther", { n: review.due }))
    : state === "caught-up" ? t("home.caughtUp") : t("practice.noReviewsTitle");
  const sub = state === "due" ? t("progress.inReview", { n: review.total }) : state === "caught-up" ? t("home.caughtUpSub") : t("practice.noReviewsBody");
  const Icon = state === "caught-up" ? CircleCheck : RotateCcw;
  return (
    <section aria-labelledby="progress-review-title" data-testid="progress-review" data-state={state}>
      <h2 id="progress-review-title" className={`${eyebrow} mb-3 px-1`}>{t("home.reviewTitle")}</h2>
      <div className="rounded-2xl bg-white border border-[#DEE2DE] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 bg-[#EEF3EF] ${state === "caught-up" ? "text-[#34785B]" : "text-[#173D31]"}`}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p data-testid="progress-review-status" className="text-[17px] font-semibold text-[#222824]">{title}</p>
            <p className="text-[14px] text-[#6B736E]">{sub}</p>
          </div>
        </div>
        {state === "due" && (
          <button type="button" data-testid="progress-review-now-btn" onClick={onOpen} className={`shrink-0 ${btnDark}`}>{t("home.reviewNow")}</button>
        )}
      </div>
    </section>
  );
}

function AssessmentSummary({ summary, meta, language, t, onOpen }) {
  const tx = (k) => getText(meta.ui[k], language);
  const has = summary?.has_assessment && summary.current_score != null;
  const band = has ? meta.result_bands.find((b) => b.key === summary.latest?.band_key) || meta.result_bands.find((b) => summary.current_score >= b.min && summary.current_score <= b.max) : null;
  return (
    <section aria-labelledby="progress-readiness-title" data-testid="progress-assessment" data-state={has ? "done" : "none"}>
      <h2 id="progress-readiness-title" className={`${eyebrow} mb-3 px-1`}>{t("progress.readinessTitle")}</h2>
      <div className="rounded-2xl bg-white border border-[#DEE2DE] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className="grid place-items-center w-11 h-11 rounded-xl shrink-0 bg-[#EEF3EF] text-[#173D31]"><ClipboardCheck className="w-5 h-5" aria-hidden="true" /></span>
        <div className="flex-1 min-w-0">
          {has ? (
            <>
              <p data-testid="progress-assessment-band" className="text-[17px] font-semibold text-[#222824]">{band ? getText(band.translations, language) : tx("title")}</p>
              <p data-testid="progress-assessment-score" className="text-[14px] text-[#6B736E]">{tx("current")}: {summary.current_score}%</p>
            </>
          ) : (
            <>
              <p className="text-[16px] font-semibold text-[#222824]">{tx("title")}</p>
              <p className="text-[14px] text-[#6B736E] leading-snug">{tx("subtitle")}</p>
            </>
          )}
        </div>
        </div>
        <button type="button" data-testid={has ? "progress-assessment-retake-btn" : "progress-assessment-start-btn"} onClick={onOpen} className={`shrink-0 ${btnLight}`}>
          {has ? tx("retake") : tx("start")}
        </button>
      </div>
    </section>
  );
}
