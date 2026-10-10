import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { getSkills, getSituations, getSituationStats } from "@/lib/api";
import { getLocalizedField } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";

const venueOk = (sit, venue) => !sit.venue_types?.length || (venue && sit.venue_types.includes(venue));

export default function Progress() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, guestId, profile, language, t } = useApp();
  const [skills, setSkills] = useState([]);
  const [situations, setSituations] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    if (!profile?.role || !guestId) return;
    const p = { role: profile.role };
    if (profile.venue_type) p.venue_type = profile.venue_type;
    Promise.all([getSkills(p), getSituations({ role: profile.role }), getSituationStats(guestId)])
      .then(([sk, sits, st]) => {
        setSkills(sk.filter((s) => s.situation_count > 0));
        setSituations(sits.filter((s) => venueOk(s, profile.venue_type)));
        setStats(st || {});
      })
      .finally(() => setLoading(false));
  }, [profile, guestId]);

  const totalAvailable = situations.length;
  const masteredTotal = situations.filter((s) => stats[s.slug]?.mastered).length;
  const practiced = situations.filter((s) => stats[s.slug]).length;

  const skillRows = skills.map((sk) => {
    const sits = situations.filter((s) => s.skills?.includes(sk.id));
    const mastered = sits.filter((s) => stats[s.slug]?.mastered).length;
    return { sk, total: sits.length, mastered };
  }).filter((r) => r.total > 0);

  return (
    <AppShell title={t("nav.progress")}>
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">{t("progress.title")}</h1>
          <p className="mt-3 text-base text-brand-charcoal/70">
            {t("progress.subtitle")}
          </p>
        </motion.header>

        {loading ? (
          <p className="mt-8 text-brand-charcoal/50">{t("common.loading")}</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
                <p className="text-4xl font-serif text-brand-forest" data-testid="progress-mastered">
                  {masteredTotal} / {totalAvailable}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-brand-charcoal/50">
                  {t("progress.masteredStat")}
                </p>
              </div>
              <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
                <p className="text-4xl font-serif text-brand-forest" data-testid="progress-practiced">
                  {practiced}
                </p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-brand-charcoal/50">
                  {t("progress.practicedStat")}
                </p>
              </div>
            </div>

            <h2 className="mt-12 text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
              {t("progress.yourSkills")}
            </h2>
            <div className="grid gap-3">
              {skillRows.map(({ sk, total, mastered }) => (
                <Link
                  key={sk.id}
                  to={`/skill/${sk.id}`}
                  data-testid={`progress-skill-${sk.id}`}
                  className="group block rounded-2xl bg-white border border-black/5 p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-serif text-brand-espresso">
                        {getLocalizedField(sk, "name", language) || sk.name}
                      </h3>
                      <p className="mt-1 text-sm text-brand-charcoal/60">
                        {t("progress.ofMastered", { m: mastered, t: total })}{" "}
                        {total === 1 ? t("progress.masteredOne") : t("progress.masteredOther")}
                      </p>
                      <div className="mt-3 h-1.5 rounded-full bg-black/5 overflow-hidden">
                        <div
                          className="h-full bg-brand-forest transition-all"
                          style={{ width: `${total ? (mastered / total) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-brand-charcoal/30 group-hover:text-brand-forest group-hover:translate-x-1 transition-all shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}
