import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play, ClipboardCheck, LifeBuoy } from "lucide-react";
import Navbar from "@/components/Navbar";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategories, getProfessionalProfiles, getTargetCountries, getSituation, getAttempts, getSituationStats, getRecommendedSituations, getAssessmentSummary, getAssessmentMeta, getEmergency } from "@/lib/api";
import { roleToFeaturedSituation, FEATURED_SITUATION } from "@/lib/content";
import { getLocalizedField, getText } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";

export default function Home() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, guestId, language, t } = useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planLabel, setPlanLabel] = useState("");
  const [featured, setFeatured] = useState(null);
  const [resume, setResume] = useState(null);
  const [masteredCount, setMasteredCount] = useState(0);
  const [recommended, setRecommended] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [assessmentMeta, setAssessmentMeta] = useState(null);
  const [emergencyUi, setEmergencyUi] = useState(null);

  // Send users with an incomplete professional profile through onboarding first.
  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  // Resume in-progress attempt + mastered count for the progress teaser.
  useEffect(() => {
    if (!guestId) return;
    getAttempts(guestId).then((atts) => {
      const ip = atts.find((a) => a.status === "in_progress");
      if (ip) getSituation(ip.situation_slug).then((s) => setResume(s)).catch(() => {});
    }).catch(() => {});
    getSituationStats(guestId).then((st) => {
      setMasteredCount(Object.values(st).filter((s) => s.mastered).length);
    }).catch(() => {});
  }, [guestId]);

  // Featured "continue" situation, relevant to the user's role.
  useEffect(() => {
    const slug = roleToFeaturedSituation[profile?.role] || FEATURED_SITUATION;
    getSituation(slug).then(setFeatured).catch(() => {});
  }, [profile]);

  // Build a discreet localized plan label ("Bartender · Irlanda") from taxonomies.
  useEffect(() => {
    if (!profile?.role && !profile?.target_country) return;
    Promise.all([getProfessionalProfiles(), getTargetCountries()])
      .then(([roles, countries]) => {
        const roleName = getLocalizedField(roles.find((r) => r.slug === profile.role), "name", language);
        const countryName = getLocalizedField(countries.find((c) => c.id === profile.target_country), "name", language);
        setPlanLabel([roleName, countryName].filter(Boolean).join(" · "));
      })
      .catch(() => {});
  }, [profile, language]);

  // Personalized "Recommended for you" situations (deterministic backend ranking).
  // Refetch on language change so titles/descriptions stay localized.
  useEffect(() => {
    if (!guestId) return;
    getRecommendedSituations(guestId, { limit: 5 }).then(setRecommended).catch(() => {});
  }, [guestId, language, profile]);

  // Assessment entry point (non-blocking): localized meta + the guest's summary.
  useEffect(() => {
    getAssessmentMeta().then(setAssessmentMeta).catch(() => {});
  }, []);
  useEffect(() => {
    getEmergency().then((d) => setEmergencyUi(d.ui)).catch(() => {});
  }, []);
  useEffect(() => {
    if (!guestId) return;
    getAssessmentSummary(guestId).then(setAssessment).catch(() => {});
  }, [guestId]);

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-6xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-charcoal/50">
            {t("home.eyebrow")}
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            {t("home.title")}
          </h1>
          {planLabel && (
            <p
              data-testid="home-plan-label"
              className="mt-3 inline-flex items-center gap-2 text-sm text-brand-charcoal/70 bg-white border border-black/5 rounded-full px-4 py-1.5"
            >
              <span className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/40">
                {t("home.plan")}
              </span>
              <span className="font-medium text-brand-espresso">{planLabel}</span>
            </p>
          )}
        </motion.div>


        {/* Assessment entry point (optional, non-blocking) */}
        {assessmentMeta && (
          <section className="mt-8">
            <button
              data-testid="assessment-entry-card"
              onClick={() => navigate("/assessment")}
              className="group w-full text-left rounded-2xl bg-white border border-brand-forest/20 p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-5"
            >
              <div>
                <p className="text-lg font-serif text-brand-espresso">
                  {getText(assessmentMeta.ui.title, language)}
                </p>
                <p className="mt-1 text-sm text-brand-charcoal/60 leading-relaxed max-w-md">
                  {getText(assessmentMeta.ui.subtitle, language)}
                </p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-forest">
                  {assessment?.has_assessment ? getText(assessmentMeta.ui.retake, language) : getText(assessmentMeta.ui.start, language)}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </div>
              {assessment?.has_assessment && assessment.current_score != null ? (
                <div className="shrink-0 text-center" data-testid="assessment-entry-score">
                  <p className="text-3xl font-serif text-brand-forest">{assessment.current_score}%</p>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">
                    {getText(assessmentMeta.ui.current, language)}
                  </p>
                </div>
              ) : (
                <span className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-brand-success-muted text-brand-forest">
                  <ClipboardCheck className="w-6 h-6" />
                </span>
              )}
            </button>
          </section>
        )}

        {/* Emergency Phrases entry point */}
        {emergencyUi && (
          <section className="mt-4">
            <button
              data-testid="emergency-entry-card"
              onClick={() => navigate("/emergency")}
              className="group w-full text-left rounded-2xl bg-white border border-brand-terracotta/25 p-5 sm:p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex items-center justify-between gap-5"
            >
              <div>
                <p className="text-lg font-serif text-brand-espresso">{getText(emergencyUi.title, language)}</p>
                <p className="mt-1 text-sm text-brand-charcoal/60 leading-relaxed max-w-md">
                  {getText(emergencyUi.subtitle, language)}
                </p>
              </div>
              <span className="shrink-0 grid place-items-center w-12 h-12 rounded-xl bg-brand-terracotta/15 text-brand-terracotta-hover">
                <LifeBuoy className="w-6 h-6" />
              </span>
            </button>
          </section>
        )}

        {/* Resume + progress teaser */}
        {(resume || masteredCount > 0) && (
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            {resume && (
              <button
                data-testid="home-resume-card"
                onClick={() => navigate(`/lesson/${resume.slug}`)}
                className="text-left rounded-2xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <p className="text-xs uppercase tracking-[0.15em] text-brand-terracotta font-semibold">
                  {t("home.resume")}
                </p>
                <p className="mt-2 text-lg font-serif text-brand-espresso">
                  {getLocalizedField(resume, "title", language) || resume.title_en}
                </p>
              </button>
            )}
            {masteredCount > 0 && (
              <button
                data-testid="home-progress-teaser"
                onClick={() => navigate("/progress")}
                className="text-left rounded-2xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
              >
                <p className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/50 font-semibold">
                  {t("home.progress")}
                </p>
                <p className="mt-2 text-lg font-serif text-brand-espresso">
                  {masteredCount} {masteredCount === 1 ? t("home.masteredOne") : t("home.masteredOther")}
                </p>
                <span className="mt-1 inline-block text-sm text-brand-forest">{t("home.viewProgress")}</span>
              </button>
            )}
          </section>
        )}

        {/* Continue learning */}
        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            {t("home.continueLearning")}
          </h2>
          <motion.button
            data-testid="continue-learning-card"
            onClick={() => navigate(`/lesson/${featured?.slug || FEATURED_SITUATION}`)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="group w-full text-left rounded-2xl bg-brand-forest text-white p-6 sm:p-8 flex items-center justify-between gap-6 hover:bg-brand-forest-hover transition-colors"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">
                {t("home.recommendedSituation")}
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif tracking-tight">
                {getLocalizedField(featured, "title", language) || t("home.defaultFeaturedTitle")}
              </h3>
              <p className="mt-2 text-sm text-white/70 max-w-md">
                {getLocalizedField(featured, "description", language) || t("home.defaultFeaturedDesc")}
              </p>
            </div>
            <span className="shrink-0 grid place-items-center w-14 h-14 rounded-full bg-white text-brand-forest group-hover:scale-105 transition-transform">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </span>
          </motion.button>
        </section>

        {/* Recommended for you */}
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            {t("home.recommendedForYou")}
          </h2>
          {recommended.length === 0 ? (
            <p data-testid="recommended-empty" className="text-brand-charcoal/50">{t("home.recommendedEmpty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="recommended-situations">
              {recommended.map((s, i) => (
                <RecommendedSituationCard key={s.slug} situation={s} index={i} t={t} navigate={navigate} />
              ))}
            </div>
          )}
        </section>

        {/* Explore categories */}
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            {t("home.exploreCategories")}
          </h2>
          {loading ? (
            <p className="text-brand-charcoal/50">{t("home.loadingCategories")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat, i) => (
                <CategoryCard key={cat.slug} cat={cat} index={i} language={language} t={t} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function RecommendedSituationCard({ situation, index, t, navigate }) {
  const statusKey = `status.${situation.status}`;
  const showStatus = situation.status && situation.status !== "not_started";
  return (
    <motion.button
      data-testid={`recommended-situation-${situation.slug}`}
      onClick={() => navigate(`/lesson/${situation.slug}`)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="group text-left h-full w-full rounded-2xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col"
    >
      <div className="flex items-start justify-between">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-brand-forest text-white">
          <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
        </span>
        {showStatus && (
          <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-brand-forest bg-brand-success-muted rounded-full px-2.5 py-1">
            {t(statusKey)}
          </span>
        )}
      </div>
      <h3 className="mt-5 text-xl font-serif text-brand-espresso">{situation.title}</h3>
      {situation.description && (
        <p className="mt-1 text-sm text-brand-charcoal/60 leading-relaxed line-clamp-2">
          {situation.description}
        </p>
      )}
      <span className="mt-4 inline-flex items-center gap-1 text-sm text-brand-forest font-medium">
        {t("intro.start")}
        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
      </span>
    </motion.button>
  );
}

function CategoryCard({ cat, highlight, index, testIdPrefix = "category-card", language, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
    >
      <Link
        to={`/category/${cat.slug}`}
        data-testid={`${testIdPrefix}-${cat.slug}`}
        className="group block h-full rounded-2xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all"
      >
        <div className="flex items-start justify-between">
          <span
            className={`grid place-items-center w-12 h-12 rounded-xl ${
              highlight
                ? "bg-brand-forest text-white"
                : "bg-brand-success-muted text-brand-forest"
            }`}
          >
            <CategoryIcon name={cat.icon} className="w-6 h-6" />
          </span>
          <ArrowRight className="w-5 h-5 text-brand-charcoal/30 group-hover:text-brand-forest group-hover:translate-x-1 transition-all" />
        </div>
        <h3 data-testid={`category-card-name-${cat.slug}`} className="mt-5 text-xl font-serif text-brand-espresso">{getLocalizedField(cat, "name", language) || cat.name_en}</h3>
        <p data-testid={`category-card-desc-${cat.slug}`} className="mt-1 text-sm text-brand-charcoal/60 leading-relaxed">
          {getLocalizedField(cat, "description", language)}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.15em] text-brand-charcoal/40">
          {t("home.situations", { n: cat.situation_count })}
        </p>
      </Link>
    </motion.div>
  );
}
