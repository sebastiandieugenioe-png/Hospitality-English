import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Navbar from "@/components/Navbar";
import { getSkills, getProfessionalProfiles, getTargetCountries } from "@/lib/api";
import { getLocalizedField } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";

export default function Learn() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, profile, language, t } = useApp();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [planLabel, setPlanLabel] = useState("");

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    if (!profile?.role) return;
    const params = { role: profile.role };
    if (profile.venue_type) params.venue_type = profile.venue_type;
    getSkills(params)
      .then((all) => setSkills(all.filter((s) => s.situation_count > 0)))
      .finally(() => setLoading(false));

    Promise.all([getProfessionalProfiles(), getTargetCountries()])
      .then(([roles, countries]) => {
        const roleName = getLocalizedField(roles.find((r) => r.slug === profile.role), "name", language);
        const countryName = getLocalizedField(countries.find((c) => c.id === profile.target_country), "name", language);
        setPlanLabel([roleName, countryName].filter(Boolean).join(" · "));
      })
      .catch(() => {});
  }, [profile, language]);

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-5xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            {t("learn.title")}
          </h1>
          {planLabel && (
            <p data-testid="learn-plan-label" className="mt-2 text-brand-terracotta font-medium">
              {planLabel}
            </p>
          )}
          <p className="mt-3 text-base text-brand-charcoal/70 max-w-xl leading-relaxed">
            {t("learn.subtitle")}
          </p>
        </motion.header>

        <section className="mt-10">
          {loading ? (
            <p className="text-brand-charcoal/50">{t("learn.loading")}</p>
          ) : skills.length === 0 ? (
            <p className="text-brand-charcoal/50">{t("learn.empty")}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {skills.map((sk, i) => (
                <motion.div
                  key={sk.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                >
                  <Link
                    to={`/skill/${sk.id}`}
                    data-testid={`skill-card-${sk.id}`}
                    className="group block h-full rounded-2xl bg-white border border-black/5 p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <h2 className="text-xl font-serif text-brand-espresso">
                        {getLocalizedField(sk, "name", language) || sk.name}
                      </h2>
                      <ArrowRight className="w-5 h-5 text-brand-charcoal/30 group-hover:text-brand-forest group-hover:translate-x-1 transition-all shrink-0" />
                    </div>
                    <p className="mt-2 text-sm text-brand-charcoal/65 leading-relaxed">
                      {getLocalizedField(sk, "description", language)}
                    </p>
                    <p className="mt-4 text-xs uppercase tracking-[0.15em] text-brand-charcoal/40">
                      {sk.situation_count}{" "}
                      {sk.situation_count === 1 ? t("learn.situationOne") : t("learn.situationOther")}
                    </p>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
