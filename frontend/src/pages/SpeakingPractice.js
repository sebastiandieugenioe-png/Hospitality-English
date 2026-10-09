import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mic, ArrowRight } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { getText } from "@/lib/i18n";
import { getSpeakingMeta, getSpeakingPractice } from "@/lib/api";
import { SpeakingQuestion } from "@/components/SpeakingQuestion";

export default function SpeakingPractice() {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const billing = useBilling();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [strong, setStrong] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | question | complete
  const [guestId, setGuestId] = useState(null);

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await getSpeakingMeta();
        const gid = await ensureGuest();
        const d = await getSpeakingPractice(gid, { free_only: !billing.isPremium("hospitality") });
        if (!active) return;
        setMeta(m); setGuestId(gid); setItems(d.items || []); setIdx(0); setStrong(0);
        setPhase((d.items || []).length ? "question" : "complete");
      } catch (e) {
        if (active) setPhase("loading");
      }
    })();
    return () => { active = false; };
  }, [ensureGuest, language]);

  const tx = (key) => (meta ? getText(meta.ui[key], language) : "");
  const total = items.length || (meta?.session_size ?? 5);

  const onAnswered = (r) => { if (r.overall === "strong") setStrong((c) => c + 1); };
  const goNext = () => { if (idx + 1 >= items.length) setPhase("complete"); else setIdx((i) => i + 1); };
  const restart = async () => {
    setPhase("loading");
    const d = await getSpeakingPractice(guestId, { free_only: !billing.isPremium("hospitality") });
    setItems(d.items || []); setIdx(0); setStrong(0);
    setPhase((d.items || []).length ? "question" : "complete");
  };

  if (phase === "loading" || !meta) {
    return <Shell onClose={() => navigate("/home")} progress={0}><p className="text-brand-charcoal/50">{t("common.loading")}</p></Shell>;
  }

  if (phase === "complete") {
    return (
      <Shell onClose={() => navigate("/home")} progress={100}>
        <div className="py-8 text-center">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-success-muted text-brand-forest">
            <Mic className="w-8 h-8" />
          </span>
          <h1 data-testid="sp-complete" className="mt-6 text-2xl sm:text-3xl font-serif text-brand-espresso">{tx("practice_title")}</h1>
          <p data-testid="sp-score" className="mt-4 text-6xl font-serif text-brand-forest">{strong} / {total}</p>
          <div className="mt-10 space-y-3">
            <button data-testid="sp-restart-btn" onClick={restart} className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover transition-colors rounded-lg px-6 py-4 font-medium">
              {tx("practice_title")} <ArrowRight className="w-4 h-4" />
            </button>
            <button data-testid="sp-home-btn" onClick={() => navigate("/home")} className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest py-2">
              {t("lesson.backHome")}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const item = items[idx];
  const progressPct = (idx / total) * 100;

  return (
    <Shell onClose={() => navigate("/home")} progress={progressPct}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("practice_title")}</span>
        <span data-testid="sp-progress" className="text-sm text-brand-charcoal/50 tabular-nums">{idx + 1} / {total}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          <SpeakingQuestion
            item={item}
            ui={meta.ui}
            language={language}
            guestId={guestId}
            onAnswered={onAnswered}
            onContinue={goNext}
            continueLabel={idx + 1 >= total ? tx("practice_title") : t("question.next")}
          />
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function Shell({ children, onClose, progress }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button data-testid="sp-close-btn" onClick={onClose} className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors" aria-label={t("lesson.closeAria")}>
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-brand-forest transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 py-8 sm:py-12">{children}</main>
    </div>
  );
}
