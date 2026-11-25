import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Sparkles, Repeat, Users, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { landingImages, situations, targetProfiles } from "@/lib/content";
import { useApp } from "@/context/AppContext";

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
  const { t } = useApp();

  const features = [
    { icon: Sparkles, title: t("landing.feat1Title"), body: t("landing.feat1Body") },
    { icon: Repeat, title: t("landing.feat2Title"), body: t("landing.feat2Body") },
    { icon: Layers, title: t("landing.feat3Title"), body: t("landing.feat3Body") },
  ];

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img src={landingImages.hero} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-espresso/85 via-brand-espresso/70 to-brand-espresso/40" />
          <div className="absolute inset-0 grain-overlay opacity-[0.12] mix-blend-overlay" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32">
          <motion.p variants={fadeUp} initial="hidden" animate="show" className="text-xs uppercase tracking-[0.25em] font-semibold text-white/70 mb-6">
            {t("landing.eyebrow")}
          </motion.p>
          <motion.h1 variants={fadeUp} initial="hidden" animate="show" custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight leading-[1.05] max-w-3xl">
            {t("landing.heroTitle")}
          </motion.h1>
          <motion.p variants={fadeUp} initial="hidden" animate="show" custom={2} className="mt-6 text-lg text-white/80 max-w-xl leading-relaxed">
            {t("landing.heroSub")}
          </motion.p>
          <motion.div variants={fadeUp} initial="hidden" animate="show" custom={3} className="mt-10 flex flex-col sm:flex-row gap-3">
            <button
              data-testid="hero-start-btn"
              onClick={() => navigate("/onboarding")}
              className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest hover:bg-brand-sand transition-colors rounded-lg px-7 py-4 font-medium text-base"
            >
              {t("landing.heroCta")}
              <ArrowRight className="w-4 h-4" />
            </button>
            <span className="inline-flex items-center gap-2 text-sm text-white/85 px-2 py-4">
              <Check className="w-4 h-4" /> {t("landing.noSignup")}
            </span>
          </motion.div>
        </div>
      </section>

      {/* LEARN FOR REAL SITUATIONS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-terracotta mb-4">
            {t("landing.realEyebrow")}
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-brand-espresso tracking-tight">
            {t("landing.realTitle")}
          </h2>
          <p className="mt-5 text-base text-brand-charcoal/70 leading-relaxed">
            {t("landing.realBody")}
          </p>
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          {situations.map((s) => (
            <span key={s} className="px-4 py-2 rounded-lg bg-white border border-black/5 text-sm text-brand-charcoal shadow-sm">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* THREE FEATURES */}
      <section className="bg-white border-y border-black/5">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24 grid gap-10 md:grid-cols-3">
          {features.map(({ icon: Icon, title, body }, i) => (
            <motion.div key={title} variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true }} custom={i}>
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
              <Users className="w-4 h-4" /> {t("landing.madeEyebrow")}
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif text-brand-espresso tracking-tight">
              {t("landing.madeTitle")}
            </h2>
            <p className="mt-5 text-base text-brand-charcoal/70 leading-relaxed">
              {t("landing.madeBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              {targetProfiles.map((p) => (
                <span key={p} data-testid={`landing-role-${p.split(".")[1]}`} className="px-3 py-1.5 rounded-full bg-brand-sand border border-black/5 text-sm text-brand-charcoal">
                  {t(p)}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <img src={landingImages.restaurant} alt="" className="rounded-2xl object-cover w-full h-56 sm:h-72 shadow-sm" />
            <img src={landingImages.coffee} alt="" className="rounded-2xl object-cover w-full h-56 sm:h-72 mt-8 shadow-sm" />
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="bg-brand-espresso text-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 sm:py-24">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-serif tracking-tight">
            {t("landing.categoriesTitle")}
          </h2>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <div key={c} className="px-5 py-4 rounded-xl border border-white/10 bg-white/5 text-base">
                {c}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-24 text-center">
        <h2 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight max-w-2xl mx-auto">
          {t("landing.finalTitle")}
        </h2>
        <p className="mt-4 text-base text-brand-charcoal/70">{t("landing.finalSub")}</p>
        <button
          data-testid="footer-start-btn"
          onClick={() => navigate("/onboarding")}
          className="mt-8 inline-flex items-center justify-center gap-2 bg-brand-forest text-white hover:bg-brand-forest-hover transition-colors rounded-lg px-8 py-4 font-medium"
        >
          {t("landing.heroCta")}
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      <footer className="border-t border-black/5 py-8 text-center text-sm text-brand-charcoal/50">
        <Link to="/" className="font-serif text-brand-espresso">
          Hospitality English
        </Link>
        <p className="mt-1">{t("landing.footerTagline")}</p>
      </footer>
    </div>
  );
}
