import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronRight, CircleCheck, Lock } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePremium } from "@/components/PremiumGate";
import { getSkills, getSituations, getSituationStats, getProfessionalProfiles, getRecommendedSituations } from "@/lib/api";
import { canAccessSituation } from "@/lib/accessConfig";
import { situationStatus, groupBySkill, freeProgress, countPracticed, hasAnyActivity } from "@/lib/progress";
import { getLocalizedField } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";

const PROFESSION = "hospitality";
const SCROLL_KEY = "learn_scroll_y";

export default function Learn() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, guestId, language, t } = useApp();
  const billing = useBilling();
  const premium = billing.isPremium(PROFESSION);
  const { requestPremium } = usePremium();
  const [skills, setSkills] = useState([]);
  const [situations, setSituations] = useState(null);
  const [stats, setStats] = useState({});
  const [recs, setRecs] = useState([]);
  const [roleName, setRoleName] = useState("");

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    if (!profile?.role) return;
    Promise.all([getSkills({ role: profile.role }), getSituations({ role: profile.role })])
      .then(([sk, sits]) => { setSkills(sk); setSituations(sits); })
      .catch(() => setSituations([]));
    getProfessionalProfiles()
      .then((roles) => setRoleName(getLocalizedField(roles.find((r) => r.slug === profile.role), "name", language)))
      .catch(() => {});
  }, [profile, language]);

  useEffect(() => {
    if (!guestId) return;
    getSituationStats(guestId).then((s) => setStats(s || {})).catch(() => {});
    getRecommendedSituations(guestId, { limit: 5 }).then(setRecs).catch(() => {});
  }, [guestId, language, profile]);

  // Restore Learn scroll position after returning from a lesson.
  useLayoutEffect(() => {
    if (!situations?.length) return;
    const y = Number(sessionStorage.getItem(SCROLL_KEY));
    sessionStorage.removeItem(SCROLL_KEY);
    // Re-apply briefly: late layout/focus changes after returning can override a single scrollTo.
    const go = () => { if (y > 0) window.scrollTo(0, y); };
    go();
    const timers = [requestAnimationFrame(go), setTimeout(go, 150), setTimeout(go, 350)];
    const id = setTimeout(() => { window.history.scrollRestoration = "auto"; }, 400);
    return () => { cancelAnimationFrame(timers[0]); clearTimeout(timers[1]); clearTimeout(timers[2]); clearTimeout(id); };
  }, [situations]);

  const canAccess = (slug) => canAccessSituation({ professionId: PROFESSION, role: profile?.role, situationSlug: slug, isPremium: premium });
  const statusOf = (slug) => situationStatus(stats, slug);
  const skillName = (id) => getLocalizedField(skills.find((s) => s.id === id), "name", language) || id;

  const groups = useMemo(() => groupBySkill(situations, skills), [situations, skills]);

  const total = situations?.length || 0;
  const practicedCount = countPracticed(situations, stats);
  const hasActivity = hasAnyActivity(situations, stats);
  const allFreeDone = !premium && freeProgress(situations, stats, { professionId: PROFESSION, role: profile?.role }).allDone;
  const rec = !hasActivity && (recs.find((r) => canAccess(r.slug)) || null);
  const recSit = rec && (situations || []).find((s) => s.slug === rec.slug);

  const open = (slug) => {
    if (canAccess(slug)) {
      sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
      window.history.scrollRestoration = "manual";
      navigate(`/lesson/${slug}`);
      window.scrollTo(0, 0);
    } else {
      requestPremium({ resume: () => navigate(`/lesson/${slug}`) });
    }
  };

  return (
    <AppShell title={t("nav.learn")}>
      <main className="max-w-3xl mx-auto px-5 sm:px-8 pt-8 pb-10 sm:pt-12" data-testid="learn-page">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-[30px] leading-tight sm:text-4xl font-serif font-bold text-[#222824] tracking-tight">{t("learn.title")}</h1>
          {roleName && <p data-testid="learn-plan-label" className="mt-1.5 text-[15px] font-medium text-[#173D31]">{roleName}</p>}
          {situations && (practicedCount > 0 ? (
            <ProgressSummary premium={premium} n={practicedCount} total={total} allFreeDone={allFreeDone} t={t} />
          ) : (
            <p data-testid="learn-new-user-sub" className="mt-2 text-[15px] text-[#6B736E]">{t("learn.newUserSub")}</p>
          ))}
        </motion.header>

        {recSit && <RecommendedFirst sit={recSit} skill={skillName(recSit.primary_skill)} language={language} t={t} onStart={() => open(recSit.slug)} />}

        {situations === null ? (
          <div className="mt-8 space-y-3" data-testid="learn-loading">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-[68px] rounded-2xl bg-[#EEF3EF] animate-pulse" />)}
          </div>
        ) : (
          <div className="mt-8 space-y-8" data-testid="learn-skill-list">
            {groups.map(([skillId, sits]) => (
              <SkillSection
                key={skillId}
                id={skillId}
                name={skillName(skillId)}
                sits={sits}
                done={countPracticed(sits, stats)}
                t={t}
                language={language}
                statusOf={statusOf}
                canAccess={canAccess}
                onOpen={open}
              />
            ))}
          </div>
        )}
      </main>
    </AppShell>
  );
}

function ProgressSummary({ premium, n, total, allFreeDone, t }) {
  const label = premium ? t("learn.progressOf", { n, total }) : (n === 1 ? t("learn.practicedOne") : t("learn.practicedOther", { n }));
  return (
    <div className="mt-3" data-testid="learn-progress-summary">
      <p data-testid="learn-progress-label" className="text-[15px] text-[#222824]">{label}</p>
      {premium && (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={n}
          className="mt-2 h-1.5 w-full max-w-xs rounded-full bg-[#DEE2DE] overflow-hidden"
        >
          <div className="h-full bg-[#173D31] rounded-full transition-[width] duration-500" style={{ width: `${total ? (n / total) * 100 : 0}%` }} />
        </div>
      )}
      {allFreeDone && <p data-testid="learn-all-free-done" className="mt-1.5 text-[14px] text-[#34785B]">{t("learn.allFreeDone")}</p>}
    </div>
  );
}

function RecommendedFirst({ sit, skill, language, t, onStart }) {
  return (
    <section data-testid="learn-recommended-first" aria-labelledby="learn-rec-title" className="mt-6 rounded-2xl bg-[#173D31] text-white p-5 sm:p-6">
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-white/70">{t("learn.recommendedFirst")}</p>
      <h2 id="learn-rec-title" className="mt-2 text-[22px] leading-tight font-serif font-semibold">
        {getLocalizedField(sit, "title", language) || sit.title_en}
      </h2>
      <p className="mt-1 text-[14px] text-white/75">
        {[skill, sit.estimated_minutes ? t("learn.minutes", { n: sit.estimated_minutes }) : null].filter(Boolean).join(" · ")}
      </p>
      <button
        type="button"
        data-testid="learn-recommended-start"
        onClick={onStart}
        className="mt-4 inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] bg-white text-[#173D31] font-semibold hover:bg-[#EEF3EF] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        {t("learn.start")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </section>
  );
}

function SkillSection({ id, name, sits, done, t, language, statusOf, canAccess, onOpen }) {
  return (
    <section data-testid={`learn-skill-${id}`} aria-labelledby={`learn-skill-title-${id}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2.5 px-1">
        <h2 id={`learn-skill-title-${id}`} className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{name}</h2>
        <span
          data-testid={`learn-skill-progress-${id}`}
          aria-label={t("learn.skillProgressAria", { skill: name, n: done, total: sits.length })}
          className="text-[13px] font-medium text-[#6B736E] tabular-nums"
        >
          {done} / {sits.length}
        </span>
      </div>
      <ul className="rounded-2xl border border-[#DEE2DE] bg-white divide-y divide-[#DEE2DE] overflow-hidden">
        {sits.map((s) => (
          <li key={s.slug}>
            <SituationRow sit={s} status={statusOf(s.slug)} locked={!canAccess(s.slug)} t={t} language={language} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SituationRow({ sit, status, locked, t, language, onOpen }) {
  const state = locked ? "locked" : status;
  const meta = locked
    ? t("learn.statePremium")
    : status === "practiced" ? t("learn.statePracticed")
    : status === "in_progress" ? t("learn.stateInProgress")
    : sit.estimated_minutes ? t("learn.minutes", { n: sit.estimated_minutes }) : null;
  const title = getLocalizedField(sit, "title", language) || sit.title_en;
  return (
    <button
      type="button"
      data-testid={`learn-situation-${sit.slug}`}
      data-state={state}
      onClick={() => onOpen(sit.slug)}
      aria-label={locked ? `${title}. ${t("learn.lockedAria")}` : undefined}
      className="w-full min-h-[68px] flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F7F5F0] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#173D31]"
    >
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] font-medium text-[#222824] leading-snug">{title}</span>
        <span className={`mt-0.5 block text-[13px] ${state === "practiced" ? "text-[#34785B]" : state === "in_progress" ? "text-[#173D31] font-medium" : "text-[#6B736E]"}`}>
          {meta}
        </span>
      </span>
      {locked ? (
        <span className="grid place-items-center w-8 h-8 rounded-full bg-[#EEF3EF] text-[#173D31] shrink-0">
          <Lock className="w-4 h-4" aria-hidden="true" />
        </span>
      ) : state === "practiced" ? (
        <CircleCheck className="w-5 h-5 text-[#34785B] shrink-0" aria-hidden="true" />
      ) : (
        <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />
      )}
    </button>
  );
}
