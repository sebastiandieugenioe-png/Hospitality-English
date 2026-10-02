import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, CalendarDays, Check, XCircle, MapPin, Lightbulb, MessageSquareQuote, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getText } from "@/lib/i18n";
import { getFirstWeekMeta, getFirstWeek, openFirstWeekScenario, submitFirstWeekPractice } from "@/lib/api";

export default function FirstWeek() {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | scenario | complete
  const [idx, setIdx] = useState(0);
  const [guestId, setGuestId] = useState(null);

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await getFirstWeekMeta();
        const gid = await ensureGuest();
        const d = await getFirstWeek(gid);
        if (!active) return;
        setMeta(m); setGuestId(gid); setData(d);
        const completed = (d.progress?.completed_scenario_ids || []).length;
        if (completed >= d.scenario_count) { setPhase("complete"); return; }
        const last = d.progress?.last_opened_scenario_id;
        let start = 0;
        if (last) {
          const li = d.scenarios.findIndex((s) => s.id === last);
          if (li >= 0) start = li;
        } else {
          const fi = d.scenarios.findIndex((s) => !(d.progress?.completed_scenario_ids || []).includes(s.id));
          start = fi < 0 ? 0 : fi;
        }
        setIdx(start);
        setPhase("scenario");
      } catch (e) {
        if (active) setPhase("loading");
      }
    })();
    return () => { active = false; };
  }, [ensureGuest, language]);

  const tx = (key) => (meta ? getText(meta.ui[key], language) : "");
  const total = data?.scenario_count || 10;

  const goNext = async () => {
    if (idx + 1 >= data.scenarios.length) {
      setPhase("complete");
      const fresh = await getFirstWeek(guestId);
      setData(fresh);
    } else {
      const next = idx + 1;
      setIdx(next);
      openFirstWeekScenario(guestId, data.scenarios[next].id).catch(() => {});
    }
  };

  const onPracticeAnswered = (progress) => setData((d) => ({ ...d, progress }));
  const retake = () => { setIdx(0); setPhase("scenario"); };

  if (phase === "loading" || !meta) {
    return <Shell onClose={() => navigate("/home")} progress={0}><p className="text-brand-charcoal/50">{t("common.loading")}</p></Shell>;
  }

  if (phase === "complete") {
    const score = data.progress?.practice_correct_count ?? 0;
    return (
      <Shell onClose={() => navigate("/home")} progress={100}>
        <div className="py-8 text-center">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-success-muted text-brand-forest">
            <CalendarDays className="w-8 h-8" />
          </span>
          <h1 data-testid="fw-complete" className="mt-6 text-2xl sm:text-3xl font-serif text-brand-espresso">{tx("completed")}</h1>
          <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">{total} / {total}</p>
          <p data-testid="fw-score" className="text-6xl font-serif text-brand-forest">{score} / {total}</p>
          <div className="mt-10 space-y-3">
            <PrimaryBtn testId="fw-retake-btn" onClick={retake}>{tx("practice")} <ArrowRight className="w-4 h-4" /></PrimaryBtn>
            <button data-testid="fw-home-btn" onClick={() => navigate("/home")} className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest py-2">
              {t("lesson.backHome")}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  const scenario = data.scenarios[idx];
  const progressPct = (idx / total) * 100;
  const progressText = tx("progress").replace("{current}", idx + 1).replace("{total}", total);
  const existingAnswer = data.progress?.practice_answers?.[scenario.id];

  return (
    <Shell onClose={() => navigate("/home")} progress={progressPct}>
      <div className="flex items-center justify-between mb-5">
        <span className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("title")}</span>
        <span data-testid="fw-progress" className="text-sm text-brand-charcoal/50 tabular-nums">{progressText}</span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={scenario.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          <Section icon={<MapPin className="w-4 h-4" />} label={tx("situation")} testId="fw-section-situation">
            <h2 data-testid="fw-title" className="text-2xl font-serif text-brand-espresso leading-snug">{scenario.title}</h2>
          </Section>

          <Section icon={<Lightbulb className="w-4 h-4" />} label={tx("what_you_need")} testId="fw-section-need">
            <p className="text-brand-charcoal">{scenario.what_you_need}</p>
          </Section>

          <Section icon={<MessageSquareQuote className="w-4 h-4" />} label={tx("useful_phrases")} testId="fw-section-phrases">
            <ul className="space-y-1.5">
              {scenario.useful_phrases_en.map((p, i) => (<li key={i} className="text-brand-espresso">“{p}”</li>))}
            </ul>
          </Section>

          {scenario.example && (
            <Section icon={<Sparkles className="w-4 h-4" />} label={tx("example")} testId="fw-section-example">
              <p className="text-brand-espresso italic leading-relaxed bg-brand-success-muted rounded-xl p-4">{scenario.example}</p>
            </Section>
          )}

          <Practice
            scenario={scenario}
            guestId={guestId}
            meta={meta}
            language={language}
            existingAnswer={existingAnswer}
            onAnswered={onPracticeAnswered}
            onNext={goNext}
            nextLabel={idx + 1 >= total ? tx("complete") : tx("practice")}
            t={t}
          />
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function Practice({ scenario, guestId, meta, language, existingAnswer, onAnswered, onNext, nextLabel, t }) {
  const [selected, setSelected] = useState(existingAnswer?.answer_index ?? null);
  const [feedback, setFeedback] = useState(existingAnswer ? { correct: existingAnswer.correct, correct_index: null } : null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSelected(existingAnswer?.answer_index ?? null);
    setFeedback(existingAnswer ? { correct: existingAnswer.correct, correct_index: null } : null);
  }, [scenario.id]); // eslint-disable-line

  const tx = (key) => getText(meta.ui[key], language);
  const locked = !!feedback;

  const submit = async () => {
    if (feedback) { onNext(); return; }
    if (selected === null) return;
    setBusy(true);
    try {
      const r = await submitFirstWeekPractice(guestId, { scenario_id: scenario.id, answer_index: selected });
      setFeedback({ correct: r.correct, correct_index: r.correct_index });
      onAnswered(r.progress);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid="fw-practice" className="mt-8 border-t border-black/5 pt-6">
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("practice")}</p>
      <p className="mt-2 text-brand-espresso font-medium">{scenario.practice.prompt}</p>
      <div className="mt-4 space-y-3">
        {scenario.practice.options.map((opt, i) => {
          const isCorrect = feedback && feedback.correct_index === i;
          const isWrongPick = feedback && !feedback.correct && selected === i;
          return (
            <button
              key={i}
              data-testid={`fw-option-${i}`}
              disabled={locked}
              onClick={() => setSelected(i)}
              className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${
                isCorrect ? "border-brand-forest bg-brand-success-muted"
                : isWrongPick ? "border-brand-terracotta bg-brand-terracotta/10"
                : selected === i ? "border-brand-forest bg-brand-success-muted"
                : "border-black/5 bg-white hover:border-brand-forest/30"
              }`}
            >
              <span className="text-brand-charcoal">{opt}</span>
              {isCorrect && <Check className="w-5 h-5 text-brand-forest" />}
              {isWrongPick && <XCircle className="w-5 h-5 text-brand-terracotta" />}
            </button>
          );
        })}
      </div>
      {feedback && (
        <p data-testid="fw-feedback" className={`mt-4 font-semibold ${feedback.correct ? "text-brand-forest" : "text-brand-terracotta-hover"}`}>
          {feedback.correct ? "✓" : "✕"}
        </p>
      )}
      <div className="mt-8">
        <PrimaryBtn testId="fw-next-btn" disabled={(selected === null && !locked) || busy} onClick={submit}>
          {locked ? nextLabel : t("question.next")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Section({ icon, label, testId, children }) {
  return (
    <div className="mt-6" data-testid={testId}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{icon} {label}</p>
      <div className="mt-2 text-base leading-relaxed">{children}</div>
    </div>
  );
}

function Shell({ children, onClose, progress }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button data-testid="fw-close-btn" onClick={onClose} className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors" aria-label={t("lesson.closeAria")}>
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

function PrimaryBtn({ children, testId, ...props }) {
  return (
    <button data-testid={testId} className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium" {...props}>
      {children}
    </button>
  );
}
