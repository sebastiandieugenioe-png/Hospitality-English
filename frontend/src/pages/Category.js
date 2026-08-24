import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Lock, Sparkles } from "lucide-react";
import Navbar from "@/components/Navbar";
import CategoryIcon from "@/components/CategoryIcon";
import { getCategory } from "@/lib/api";

const levelLabel = { a1: "A1", a2: "A2", b1: "B1", b2: "B2" };

export default function Category() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    getCategory(slug)
      .then(setCategory)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <Link
          to="/home"
          data-testid="category-back-link"
          className="inline-flex items-center gap-2 text-sm text-brand-charcoal/60 hover:text-brand-forest transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio
        </Link>

        {loading && <p className="text-brand-charcoal/50">Cargando…</p>}
        {error && <p className="text-brand-charcoal/50">No se encontró la categoría.</p>}

        {category && (
          <>
            <motion.header
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-4 mb-10"
            >
              <span className="grid place-items-center w-14 h-14 rounded-2xl bg-brand-forest text-white shrink-0">
                <CategoryIcon name={category.icon} className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
                  {category.name_en}
                </h1>
                <p className="text-sm text-brand-charcoal/60 mt-1">
                  {category.description_es}
                </p>
              </div>
            </motion.header>

            <div className="grid gap-3">
              {category.situations.map((sit, i) => (
                <SituationRow key={sit.slug} sit={sit} index={i} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function SituationRow({ sit, index }) {
  const content = (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-5 py-4 transition-all ${
        sit.is_full
          ? "bg-white border-black/5 shadow-sm hover:shadow-md hover:-translate-y-0.5"
          : "bg-white/60 border-black/5"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <h3 className="text-lg font-serif text-brand-espresso">{sit.title_en}</h3>
          {sit.is_full && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-brand-forest bg-brand-success-muted px-2 py-0.5 rounded-full">
              <Sparkles className="w-3 h-3" /> Disponible
            </span>
          )}
        </div>
        <p className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/40 mt-1">
          {levelLabel[sit.level] || sit.level}
        </p>
      </div>
      {sit.is_full ? (
        <ArrowRight className="w-5 h-5 text-brand-forest shrink-0" />
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-brand-charcoal/40 shrink-0">
          <Lock className="w-4 h-4" /> Pronto
        </span>
      )}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      {sit.is_full ? (
        <Link data-testid={`situation-${sit.slug}`} to={`/lesson/${sit.slug}`}>
          {content}
        </Link>
      ) : (
        <div data-testid={`situation-${sit.slug}`} aria-disabled="true">
          {content}
        </div>
      )}
    </motion.div>
  );
}
