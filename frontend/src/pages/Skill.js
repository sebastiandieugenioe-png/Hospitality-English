import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getSkills, getSituations } from "@/lib/api";
import { useApp } from "@/context/AppContext";

const LEVEL_LABEL = { a1: "A1", a2: "A2", b1: "B1", b2: "B2" };

export default function Skill() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile } = useApp();
  const [skill, setSkill] = useState(null);
  const [situations, setSituations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    if (!profile?.role) return;
    const params = { role: profile.role, skill: slug };
    if (profile.venue_type) params.venue_type = profile.venue_type;
    Promise.all([getSkills({ role: profile.role }), getSituations(params)])
      .then(([skills, sits]) => {
        setSkill(skills.find((s) => s.id === slug) || null);
        setSituations(sits);
      })
      .finally(() => setLoading(false));
  }, [profile, slug]);

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <Link
          to="/learn"
          data-testid="skill-back-link"
          className="inline-flex items-center gap-2 text-sm text-brand-charcoal/60 hover:text-brand-forest transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a Aprender
        </Link>

        {loading && <p className="text-brand-charcoal/50">Cargando…</p>}

        {!loading && (
          <>
            <motion.header
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
                {skill?.translations?.es?.name || "Competencia"}
              </h1>
              {skill?.translations?.es?.description && (
                <p className="mt-3 text-base text-brand-charcoal/70 max-w-xl leading-relaxed">
                  {skill.translations.es.description}
                </p>
              )}
            </motion.header>

            <div className="mt-8 grid gap-3">
              {situations.length === 0 && (
                <p className="text-brand-charcoal/50">
                  Aún no hay situaciones disponibles para tu puesto aquí.
                </p>
              )}
              {situations.map((sit, i) => (
                <motion.div
                  key={sit.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                >
                  <Link
                    to={`/lesson/${sit.slug}`}
                    data-testid={`situation-card-${sit.slug}`}
                    className="group block rounded-2xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-serif text-brand-espresso">
                        {sit.translations?.es?.title || sit.title_en}
                      </h2>
                      <ArrowRight className="w-5 h-5 text-brand-forest shrink-0 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="mt-2 text-sm text-brand-charcoal/65 leading-relaxed">
                      {sit.translations?.es?.description}
                    </p>
                    <div className="mt-4 flex items-center gap-3 text-xs uppercase tracking-[0.12em] text-brand-charcoal/45">
                      <span className="px-2 py-0.5 rounded-full bg-brand-success-muted text-brand-forest">
                        {LEVEL_LABEL[sit.level] || sit.level}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" /> {sit.estimated_minutes} min
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
