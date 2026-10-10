import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Headphones, Mic, CircleCheck, RotateCcw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { usePremium } from "@/components/PremiumGate";
import { getCategories, getProfessionalProfiles, getSituation, getAttempts, getRecommendedSituations, getReviewItems } from "@/lib/api";
import { isFreeSituation } from "@/lib/accessConfig";
import { getLocalizedField } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";

const PROFESSION = "hospitality";
const card = "rounded-2xl border border-[#DEE2DE] bg-white p-5 sm:p-6";
const eyebrow = "text-xs uppercase tracking-[0.15em] font-semibold";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] transition-colors";

export default function Home() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, guestId, language, t, account } = useApp();
  const billing = useBilling();
  const { requestPremium } = usePremium();
  const premium = billing.isPremium(PROFESSION);
  const [roleName, setRoleName] = useState("");
  const [categories, setCategories] = useState([]);
  const [attempts, setAttempts] = useState(null);
  const [resume, setResume] = useState(null);
  const [recs, setRecs] = useState(null);
  const [due, setDue] = useState(null);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => { getCategories().then(setCategories).catch(() => {}); }, [language]);

  useEffect(() => {
    if (!profile?.role) return;
    getProfessionalProfiles()
      .then((roles) => setRoleName(getLocalizedField(roles.find((r) => r.slug === profile.role), "name", language)))
      .catch(() => {});
  }, [profile, language]);

  useEffect(() => {
    if (!guestId) return;
    getAttempts(guestId).then((atts) => {
      setAttempts(atts);
      const ip = atts.find((a) => a.status === "in_progress");
      if (ip) getSituation(ip.situation_slug).then(setResume).catch(() => {});
    }).catch(() => setAttempts([]));
  }, [guestId]);

  useEffect(() => {
    if (!guestId) return;
    getRecommendedSituations(guestId, { limit: 5 }).then(setRecs).catch(() => setRecs([]));
  }, [guestId, language, profile]);

  useEffect(() => {
    if (!guestId || (!billing.ready && billing.status !== "error")) return;
    getReviewItems(guestId, { due: true, limit: 200, free_only: !premium })
      .then((items) => setDue(items.length)).catch(() => setDue(null));
  }, [guestId, premium, billing.ready, billing.status]);

  const isNewUser = attempts !== null && attempts.length === 0 && !due;
  const firstName = (account?.display_name || "").trim().split(/\s+/)[0];
  const greeting = isNewUser
    ? (firstName ? t("home.welcomeNew", { name: firstName }) : t("home.welcomeNewNoName"))
    : (firstName ? t("home.welcomeBack", { name: firstName }) : t("home.welcomeBackNoName"));
  const subline = [roleName, t("home.professionHospitality")].filter(Boolean).join(" · ");

  const upNext = (recs || []).find((s) => premium || isFreeSituation(s.slug, PROFESSION, profile?.role)) || null;
  const categoryName = (slug) => getLocalizedField(categories.find((c) => c.slug === slug), "name", language);
  const primaryLoading = attempts === null || recs === null;

  return (
    <AppShell>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-8 pb-10 sm:pt-12 space-y-8" data-testid="home-page">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 data-testid="home-greeting" className="text-[30px] leading-tight sm:text-4xl font-serif font-bold text-[#222824] tracking-tight">
            {greeting}
          </h1>
          <p data-testid="home-plan-label" className="mt-1.5 text-[15px] text-[#6B736E]">{subline}</p>
        </motion.header>

        <PrimaryAction
          loading={primaryLoading}
          resume={resume}
          upNext={upNext}
          isNewUser={isNewUser}
          language={language}
          t={t}
          navigate={navigate}
          categoryName={categoryName}
        />

        {due !== null && !isNewUser && <ReviewSection due={due} t={t} navigate={navigate} />}

        <PracticeShortcuts t={t} navigate={navigate} />

        {billing.ready && !premium && <PremiumCard t={t} onOpen={() => requestPremium()} />}
      </main>
    </AppShell>
  );
}

function PrimaryAction({ loading, resume, upNext, isNewUser, language, t, navigate, categoryName }) {
  if (loading) {
    return <div data-testid="home-primary-loading" className="h-[188px] rounded-2xl bg-[#EEF3EF] animate-pulse" />;
  }
  let data;
  if (resume) {
    data = {
      state: "continue",
      label: t("home.continueEyebrow"),
      title: getLocalizedField(resume, "title", language) || resume.title_en,
      meta: categoryName(resume.category),
      cta: t("home.continueBtn"),
      to: `/lesson/${resume.slug}`,
    };
  } else if (upNext) {
    data = {
      state: isNewUser ? "first-step" : "up-next",
      label: isNewUser ? t("home.firstStepEyebrow") : t("home.upNextEyebrow"),
      title: upNext.title,
      meta: categoryName(upNext.category),
      note: isNewUser ? t("home.firstStepSub") : t("home.recommendedForRole"),
      cta: t("home.startBtn"),
      to: `/lesson/${upNext.slug}`,
    };
  } else {
    data = {
      state: "fallback",
      title: t("home.readyTitle"),
      note: t("home.readySub"),
      cta: t("home.exploreBtn"),
      to: "/learn",
    };
  }
  return (
    <motion.section
      data-testid="home-primary-card"
      data-state={data.state}
      aria-labelledby="home-primary-title"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.05 }}
      className="rounded-2xl bg-[#173D31] text-white p-6 sm:p-7"
    >
      {data.label && <p data-testid="home-primary-label" className={`${eyebrow} text-white/70`}>{data.label}</p>}
      <h2 id="home-primary-title" data-testid="home-primary-title" className="mt-2 text-[26px] leading-tight font-serif font-semibold">
        {data.title}
      </h2>
      {data.meta && <p data-testid="home-primary-meta" className="mt-1.5 text-[14px] text-white/75">{data.meta}</p>}
      {data.note && <p className="mt-1 text-[14px] text-white/75">{data.note}</p>}
      <button
        type="button"
        data-testid="home-primary-cta"
        onClick={() => navigate(data.to)}
        className={`${btnPrimary} mt-5 w-full sm:w-auto bg-white text-[#173D31] hover:bg-[#EEF3EF]`}
      >
        {data.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </motion.section>
  );
}

function ReviewSection({ due, t, navigate }) {
  const hasDue = due > 0;
  return (
    <section aria-labelledby="home-review-title" data-testid="home-review-section">
      <h2 id="home-review-title" className={`${eyebrow} text-[#6B736E] mb-3 px-1`}>{t("home.reviewTitle")}</h2>
      <div className={`${card} flex flex-col sm:flex-row sm:items-center gap-4`}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
        <span className={`grid place-items-center w-11 h-11 rounded-xl shrink-0 ${hasDue ? "bg-[#EEF3EF] text-[#173D31]" : "bg-[#EEF3EF] text-[#34785B]"}`}>
          {hasDue ? <RotateCcw className="w-5 h-5" aria-hidden="true" /> : <CircleCheck className="w-5 h-5" aria-hidden="true" />}
        </span>
        <div className="flex-1 min-w-0">
          <p data-testid="home-review-status" className="text-[17px] font-semibold text-[#222824]">
            {hasDue ? (due === 1 ? t("home.reviewDueOne") : t("home.reviewDueOther", { n: due })) : t("home.caughtUp")}
          </p>
          <p className="text-[14px] text-[#6B736E]">{hasDue ? t("home.reviewDueSub") : t("home.caughtUpSub")}</p>
        </div>
        </div>
        <button
          type="button"
          data-testid="home-review-cta"
          onClick={() => navigate("/practice")}
          className={`${btnPrimary} shrink-0 ${hasDue ? "bg-[#173D31] text-white hover:bg-[#102E25]" : "border border-[#DEE2DE] text-[#173D31] hover:bg-[#EEF3EF]"}`}
        >
          {hasDue ? t("home.reviewNow") : t("home.practiceAnyway")}
        </button>
      </div>
    </section>
  );
}

function PracticeShortcuts({ t, navigate }) {
  const items = [
    { to: "/listening-practice", icon: Headphones, title: t("home.listening"), sub: t("home.listeningSub"), testid: "home-listening-shortcut" },
    { to: "/speaking-practice", icon: Mic, title: t("home.speaking"), sub: t("home.speakingSub"), testid: "home-speaking-shortcut" },
  ];
  return (
    <section aria-labelledby="home-practice-title">
      <h2 id="home-practice-title" className={`${eyebrow} text-[#6B736E] mb-3 px-1`}>{t("home.practiceTitle")}</h2>
      <div className="grid grid-cols-2 gap-3">
        {items.map(({ to, icon: Icon, title, sub, testid }) => (
          <button
            key={to}
            type="button"
            data-testid={testid}
            onClick={() => navigate(to)}
            className={`${card} !p-4 sm:!p-5 flex flex-col items-start justify-start text-left min-h-[44px] hover:border-[#173D31]/30 transition-colors`}
          >
            <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#EEF3EF] text-[#173D31]">
              <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="mt-3 block text-[16px] font-semibold text-[#222824]">{title}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-[#6B736E]">{sub}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function PremiumCard({ t, onOpen }) {
  return (
    <section data-testid="home-premium-card" aria-labelledby="home-premium-title" className={`${card} bg-[#EEF3EF] border-[#173D31]/15`}>
      <p id="home-premium-title" className={`${eyebrow} text-[#173D31] inline-flex items-center gap-1.5`}>
        <Sparkles className="w-3.5 h-3.5" aria-hidden="true" /> {t("home.premiumEyebrow")}
      </p>
      <p className="mt-2 text-[15px] text-[#222824] leading-relaxed">{t("home.premiumBody")}</p>
      <button
        type="button"
        data-testid="home-see-premium-btn"
        onClick={onOpen}
        className={`${btnPrimary} mt-4 bg-[#173D31] text-white hover:bg-[#102E25]`}
      >
        {t("home.seePremium")}
      </button>
    </section>
  );
}
