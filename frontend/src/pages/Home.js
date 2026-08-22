import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import Navbar from "@/components/Navbar";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategories } from "@/lib/api";
import { recommendationMap, FEATURED_SITUATION, workplaceOptions } from "@/lib/content";
import { useApp } from "@/context/AppContext";

export default function Home() {
  const navigate = useNavigate();
  const { onboarding } = useApp();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  const workplace = onboarding?.workplace || "other";
  const workplaceLabel = workplaceOptions.find((w) => w.id === workplace)?.label;
  const recSlugs = recommendationMap[workplace] || recommendationMap.other;
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
        </motion.div>

        {/* Continue learning */}
        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
            Continúa aprendiendo
          </h2>
          <motion.button
            data-testid="continue-learning-card"
            onClick={() => navigate(`/lesson/${FEATURED_SITUATION}`)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="group w-full text-left rounded-2xl bg-brand-forest text-white p-6 sm:p-8 flex items-center justify-between gap-6 hover:bg-brand-forest-hover transition-colors"
          >
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/60 mb-2">
                Restaurante · Situación recomendada
              </p>
              <h3 className="text-2xl sm:text-3xl font-serif tracking-tight">
                Taking an order
              </h3>
              <p className="mt-2 text-sm text-white/70 max-w-md">
                Aprende a tomar una comanda en inglés: frases, diálogo real,
                flashcards y quiz.
              </p>
            </div>
            <span className="shrink-0 grid place-items-center w-14 h-14 rounded-full bg-white text-brand-forest group-hover:scale-105 transition-transform">
              <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
            </span>
          </motion.button>
        </section>

        {/* Recommended for you */}
        <section className="mt-12">
          <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-1">
            Recomendado para ti
          </h2>
          {workplaceLabel && (
            <p className="text-sm text-brand-charcoal/60 mb-4">
              Según tu selección: <span className="font-medium">{workplaceLabel}</span>
            </p>
          )}
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
