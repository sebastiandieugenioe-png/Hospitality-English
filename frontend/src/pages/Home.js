import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Navbar from "@/components/Navbar";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategories, getProfessionalProfiles, getTargetCountries, getSituation, getAttempts, getSituationStats } from "@/lib/api";
import { recommendationMap, roleToCategory, roleToFeaturedSituation, FEATURED_SITUATION } from "@/lib/content";
import { useApp } from "@/context/AppContext";

export default function Home() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, guestId } = useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planLabel, setPlanLabel] = useState("");
  const [featured, setFeatured] = useState(null);
  const [resume, setResume] = useState(null);
  const [masteredCount, setMasteredCount] = useState(0);

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
        const roleName = roles.find((r) => r.slug === profile.role)?.name_es;
        const countryName = countries.find((c) => c.id === profile.target_country)?.name_es;
        setPlanLabel([roleName, countryName].filter(Boolean).join(" · "));
      })
      .catch(() => {});
  }, [profile]);

  const primaryCategory = roleToCategory[profile?.role] || "general";
  const recSlugs = recommendationMap[primaryCategory] || recommendationMap.other;
  const bySlug = (slug) => categories.find((c) => c.slug === slug);
  const recommended = recSlugs.map(bySlug).filter(Boolean);

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
            Tu aprendizaje
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            ¿Seguimos practicando?
          </h1>
          {planLabel && (
            <p
              data-testid="home-plan-label"
              className="mt-3 inline-flex items-center gap-2 text-sm text-brand-charcoal/70 bg-white border border-black/5 rounded-full px-4 py-1.5"
            >
              <span className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/40">
                Tu plan
              </span>
              <span className="font-medium text-brand-espresso">{planLabel}</span>
            </p>
          )}
        </motion.div>


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
                  Continúa donde lo dejaste
                </p>
                <p className="mt-2 text-lg font-serif text-brand-espresso">
                  {resume.translations?.es?.title || resume.title_en}
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
                  Tu progreso
                </p>
                <p className="mt-2 text-lg font-serif text-brand-espresso">
                  {masteredCount} {masteredCount === 1 ? "situación dominada" : "situaciones dominadas"}
                </p>
                <span className="mt-1 inline-block text-sm text-brand-forest">Ver progreso →</span>
              </button>
            )}
          </section>
        )}

        {/* Continue learning */}
        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            Continúa aprendiendo
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
                Situación recomendada para tu turno
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif tracking-tight">
                {featured?.translations?.es?.title || "Tomar una comanda"}
              </h3>
              <p className="mt-2 text-sm text-white/70 max-w-md">
                {featured?.translations?.es?.description ||
                  "Aprende frases reales, diálogo, flashcards y quiz."}
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
            Recomendado para ti
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((cat, i) => (
              <CategoryCard key={cat.slug} cat={cat} highlight index={i} testIdPrefix="recommended-card" />
            ))}
          </div>
        </section>

        {/* Explore categories */}
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            Explora todas las categorías
          </h2>
          {loading ? (
            <p className="text-brand-charcoal/50">Cargando categorías…</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((cat, i) => (
                <CategoryCard key={cat.slug} cat={cat} index={i} />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function CategoryCard({ cat, highlight, index, testIdPrefix = "category-card" }) {
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
        <h3 className="mt-5 text-xl font-serif text-brand-espresso">{cat.name_en}</h3>
        <p className="mt-1 text-sm text-brand-charcoal/60 leading-relaxed">
          {cat.description_es}
        </p>
        <p className="mt-4 text-xs uppercase tracking-[0.15em] text-brand-charcoal/40">
          {cat.situation_count} situaciones
        </p>
      </Link>
    </motion.div>
  );
}
