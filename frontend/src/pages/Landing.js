import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Layers,
  Sparkles,
  Repeat,
  Users,
  Check,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import { landingImages, situations, targetProfiles } from "@/lib/content";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" },
  }),
};

const categories = [
  "General Hospitality",
  "Restaurant",
  "Bar",
  "Hotel / Reception",
  "Coffee Shop",
  "Kitchen",
  "Housekeeping",
];

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={landingImages.hero}
            alt="Interior de un hotel boutique elegante"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-espresso/85 via-brand-espresso/70 to-brand-espresso/40" />
          <div className="absolute inset-0 grain-overlay opacity-[0.12] mix-blend-overlay" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            className="text-xs uppercase tracking-[0.25em] font-semibold text-white/70 mb-6"
          >
            Inglés real para hostelería
          </motion.p>
          <motion.h1
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={1}
            className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-[1.05] max-w-3xl"
          >
            Aprende el inglés que realmente necesitas para trabajar en hostelería
          </motion.h1>
          <motion.p
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={2}
            className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed"
          >
            Practica situaciones reales de restaurantes, bares, hoteles y otros
            trabajos de hostelería.
          </motion.p>
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="show"
            custom={3}
            className="mt-10 flex flex-col sm:flex-row gap-3"
          >
            <button
              data-testid="hero-start-btn"
              onClick={() => navigate("/onboarding")}
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest hover:bg-brand-sand transition-colors rounded-lg px-7 py-4 font-medium text-base"
            >
              Empezar gratis
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="inline-flex items-center gap-2 text-sm text-white/85 px-2 py-4">
              <Check className="w-4 h-4" /> Sin registro. Empiezas en segundos.
            </span>
          </motion.div>
        </div>
      </section>

      {/* LEARN FOR REAL SITUATIONS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-terracotta mb-4">
            Aprende para situaciones reales
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-brand-espresso tracking-tight">
            El inglés que usarás en tu turno, no en un examen
          </h2>
          <p className="mt-5 text-base text-brand-charcoal/70 leading-relaxed">
            Cada lección se construye alrededor de una situación de trabajo real.
            Nada de gramática abstracta: frases que dirás hoy mismo delante de un
            cliente.
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {situations.map((s) => (
            <span
              key={s}
              className="px-4 py-2 rounded-lg bg-white border border-black/5 text-sm text-brand-charcoal shadow-sm"
            >
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* THREE FEATURES */}
      <section className="bg-white border-y border-black/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24 grid gap-10 md:grid-cols-3">
          {[
            {
              icon: Sparkles,
              title: "Inglés específico de hostelería",
              body: "No es un curso genérico de inglés. Es vocabulario y frases pensadas para el servicio, la sala, la barra y la recepción.",
            },
            {
              icon: Repeat,
              title: "Aprende haciendo",
              body: "Flashcards, ejercicios y quizzes cortos. Practicas de forma activa en lugar de solo leer teoría.",
            },
            {
              icon: Layers,
              title: "Organizado por categorías",
              body: "Restaurante, bar, hotel, cafetería, cocina y housekeeping. Ve directo a lo que necesitas para tu trabajo.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true }}
              custom={i}
            >
              <span className="grid place-items-center w-11 h-11 rounded-lg bg-brand-success-muted text-brand-forest mb-5">
                <Icon className="w-5 h-5" strokeWidth={1.75} />
              </span>
              <h3 className="text-xl font-serif text-brand-espresso mb-2">{title}</h3>
              <p className="text-sm text-brand-charcoal/70 leading-relaxed">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* MADE FOR HOSPITALITY WORKERS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-terracotta mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Hecho para hostelería
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-brand-espresso tracking-tight">
              Pensado para quienes viven del servicio
            </h2>
            <p className="mt-5 text-base text-brand-charcoal/70 leading-relaxed">
              Tanto si ya trabajas en hostelería como si quieres dar el salto a un
              país de habla inglesa, aprenderás lo que de verdad se dice en el día
              a día.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {targetProfiles.map((p) => (
                <span
                  key={p}
                  className="px-3 py-1.5 rounded-full bg-brand-sand border border-black/5 text-sm text-brand-charcoal"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img
              src={landingImages.restaurant}
              alt="Camarero profesional en un restaurante"
              className="rounded-2xl object-cover w-full h-56 sm:h-72 shadow-sm"
            />
            <img
              src={landingImages.coffee}
              alt="Barista preparando café"
              className="rounded-2xl object-cover w-full h-56 sm:h-72 mt-8 shadow-sm"
            />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-brand-espresso text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif tracking-tight">
            Categorías principales
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div
                key={c}
                className="px-5 py-4 rounded-xl border border-white/10 bg-white/5 text-base"
              >
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight max-w-2xl mx-auto">
          Empieza tu primera lección
        </h2>
        <p className="mt-4 text-base text-brand-charcoal/70">
          Gratis, sin registro y directo al grano.
        </p>
        <button
          data-testid="footer-start-btn"
          onClick={() => navigate("/onboarding")}
          className="mt-8 inline-flex items-center justify-center gap-2 bg-brand-forest text-white hover:bg-brand-forest-hover transition-colors rounded-lg px-8 py-4 font-medium"
        >
          Empezar gratis
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <footer className="border-t border-black/5 py-8 text-center text-sm text-brand-charcoal/50">
        <Link to="/" className="font-serif text-brand-espresso">
          Inglés para Hostelería
        </Link>
        <p className="mt-1">Aprende el inglés que usarás en el trabajo.</p>
      </footer>
    </div>
  );
}
