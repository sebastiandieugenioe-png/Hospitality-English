import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, Briefcase, Check, XCircle, Target, ListChecks, MessageSquareQuote, Sparkles } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getText } from "@/lib/i18n";
import { getJobInterviewMeta, getJobInterview, openJobInterviewScenario, submitJobInterviewPractice } from "@/lib/api";

export default function JobInterview() {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const [meta, setMeta] = useState(null);
  const [data, setData] = useState(null); // {role, needs_role, scenarios, progress}
  const [phase, setPhase] = useState("loading"); // loading | needs_role | scenario | complete
  const [idx, setIdx] = useState(0);
  const [guestId, setGuestId] = useState(null);

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await getJobInterviewMeta();
        const gid = await ensureGuest();
        const d = await getJobInterview(gid);
        if (!active) return;
        setMeta(m);
        setGuestId(gid);
        setData(d);
        if (d.needs_role) { setPhase("needs_role"); return; }
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
      const fresh = await getJobInterview(guestId);
      setData(fresh);
    } else {
      const next = idx + 1;
      setIdx(next);
      openJobInterviewScenario(guestId, data.scenarios[next].id).catch(() => {});
    }
  };

  const onPracticeAnswered = (progress) => {
    setData((d) => ({ ...d, progress }));
  };

  const retake = () => { setIdx(0); setPhase("scenario"); };

  if (phase === "loading" || !meta) {
    return <Shell onClose={() => navigate("/home")} progress={0}><p className="text-brand-charcoal/50">{t("common.loading")}</p></Shell>;
  }

  if (phase === "needs_role") {
    return (
      <Shell onClose={() => navigate("/home")} progress={0}>
        <div className="py-10 text-center">
          <h1 className="text-2xl font-serif text-brand-espresso">{tx("title")}</h1>
          <p className="mt-3 text-brand-charcoal/70">{t("onboarding.role.q")}</p>
          <div className="mt-8">
            <PrimaryBtn testId="ji-select-role-btn" onClick={() => navigate("/onboarding")}>
              {t("intro.start")} <ArrowRight className="w-4 h-4" />
            </PrimaryBtn>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "complete") {
    const score = data.progress?.practice_correct_count ?? 0;
    return (
      <Shell onClose={() => navigate("/home")} progress={100}>
        <div className="py-8 text-center">
          <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-success-muted text-brand-forest">
            <Briefcase className="w-8 h-8" />
          </span>
          <h1 data-testid="ji-complete" className="mt-6 text-2xl sm:text-3xl font-serif text-brand-espresso">{tx("completed")}</h1>
          <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">{total} / {total}</p>
          <p data-testid="ji-score" className="text-6xl font-serif text-brand-forest">{score} / {total}</p>
          <div className="mt-10 space-y-3">
            <PrimaryBtn testId="ji-retake-btn" onClick={retake}>{tx("practice")} <ArrowRight className="w-4 h-4" /></PrimaryBtn>
            <button data-testid="ji-home-btn" onClick={() => navigate("/home")} className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest py-2">
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
        <span data-testid="ji-progress" className="text-sm text-brand-charcoal/50 tabular-nums">{progressText}</span>
      </div>
      {idx === 0 && tx("subtitle") && (
        <p data-testid="ji-subtitle" className="-mt-2 mb-6 text-[15px] text-brand-charcoal/70 leading-relaxed">{tx("subtitle")}</p>
      )}
      <AnimatePresence mode="wait">
        <motion.div key={scenario.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
          <h2 data-testid="ji-question" className="text-2xl font-serif text-brand-espresso leading-snug">{scenario.question_en}</h2>

          <Section icon={<Target className="w-4 h-4" />} label={tx("interviewer_wants")} testId="ji-section-interviewer">
            <p className="text-brand-charcoal">{scenario.interviewer_wants}</p>
          </Section>

          <Section icon={<ListChecks className="w-4 h-4" />} label={tx("answer_structure")} testId="ji-section-structure">
            <p className="text-brand-charcoal">{scenario.answer_structure}</p>
          </Section>

          <Section icon={<MessageSquareQuote className="w-4 h-4" />} label={tx("useful_phrases")} testId="ji-section-phrases">
            <ul className="space-y-1.5">
              {scenario.useful_phrases_en.map((p, i) => (
                <li key={i} className="text-brand-espresso">“{p}”</li>
              ))}
            </ul>
          </Section>

          {scenario.model_answer && (
            <Section icon={<Sparkles className="w-4 h-4" />} label={tx("model_answer")} testId="ji-section-model">
              <p className="text-brand-espresso italic leading-relaxed bg-brand-success-muted rounded-xl p-4">{scenario.model_answer}</p>
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
            nextLabel={idx + 1 >= total ? tx("complete") : tx("next")}
            t={t}
          />
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

function Practice({ scenario, guestId, meta, language, existingAnswer, onAnswered, onNext, nextLabel, t }) {
  const [selected, setSelected] = useState(existingAnswer?.answer_index ?? null);
  const [feedback, setFeedback] = useState(
    existingAnswer ? { correct: existingAnswer.correct, correct_index: null } : null
  );
  const [busy, setBusy] = useState(false);

  // Reset when scenario changes.
  const prompt = scenario.practice.prompt;
  useMemo(() => {
    setSelected(existingAnswer?.answer_index ?? null);
    setFeedback(existingAnswer ? { correct: existingAnswer.correct, correct_index: null } : null);
  }, [scenario.id]); // eslint-disable-line

  const tx = (key) => getText(meta.ui[key], language);

  const submit = async () => {
    if (feedback) { onNext(); return; }
    if (selected === null) return;
    setBusy(true);
    try {
      const r = await submitJobInterviewPractice(guestId, { scenario_id: scenario.id, answer_index: selected });
      setFeedback({ correct: r.correct, correct_index: r.correct_index });
      onAnswered(r.progress);
    } finally {
      setBusy(false);
    }
  };

  const locked = !!feedback;

  return (
    <div data-testid="ji-practice" className="mt-8 border-t border-black/5 pt-6">
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("practice")}</p>
      <p className="mt-2 text-brand-espresso font-medium">{prompt}</p>
      <div className="mt-4 space-y-3">
        {scenario.practice.options.map((opt, i) => {
          const isCorrect = feedback && feedback.correct_index === i;
          const isWrongPick = feedback && !feedback.correct && selected === i;
          return (
            <button
              key={i}
              data-testid={`ji-option-${i}`}
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
        <p data-testid="ji-feedback" className={`mt-4 font-semibold ${feedback.correct ? "text-brand-forest" : "text-brand-terracotta-hover"}`}>
          {feedback.correct ? tx("practice") + " ✓" : "✕"}
        </p>
      )}
      <div className="mt-8">
        <PrimaryBtn testId="ji-next-btn" disabled={(selected === null && !locked) || busy} onClick={submit}>
          {locked ? nextLabel : t("question.next")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Section({ icon, label, testId, children }) {
  return (
    <div className="mt-6" data-testid={testId}>
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
        {icon} {label}
      </p>
      <div className="mt-2 text-base leading-relaxed">{children}</div>
    </div>
  );
}

function Shell({ children, onClose, progress }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button data-testid="ji-close-btn" onClick={onClose} className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors" aria-label={t("lesson.closeAria")}>
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
