import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, RotateCw, ClipboardCheck, TrendingUp, AlertCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useApp } from "@/context/AppContext";
import { getText } from "@/lib/i18n";
import {
  getAssessmentMeta,
  startAssessment,
  submitAssessmentResponse,
  completeAssessment,
} from "@/lib/api";

export default function Assessment() {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const [meta, setMeta] = useState(null);
  const [phase, setPhase] = useState("intro"); // intro | test | result
  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [total, setTotal] = useState(0);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    getAssessmentMeta().then(setMeta).catch(() => setError(true));
  }, []);

  // Assessment is role-specific; users must finish onboarding first.
  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  const tx = (key) => (meta ? getText(meta.ui[key], language) : "");
  const areaName = (k) => {
    const a = meta?.areas.find((x) => x.key === k);
    return a ? getText(a.translations, language) : k;
  };
  const bandName = (k) => {
    const b = meta?.result_bands.find((x) => x.key === k);
    return b ? getText(b.translations, language) : k;
  };

  const begin = async () => {
    setBusy(true);
    setError(false);
    try {
      const gid = await ensureGuest();
      const data = await startAssessment(gid);
      setAttemptId(data.attempt_id);
      setQuestions(data.questions);
      setTotal(data.total);
      setIdx(0);
      setResult(null);
      setPhase("test");
    } catch (e) {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const onAnswered = async (question, submitted) => {
    setBusy(true);
    try {
      await submitAssessmentResponse(attemptId, {
        question_id: question.id,
        submitted_answer: submitted,
      });
      if (idx + 1 >= questions.length) {
        const res = await completeAssessment(attemptId);
        setResult(res);
        setPhase("result");
      } else {
        setIdx((i) => i + 1);
      }
    } catch (e) {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  if (!meta) {
    return (
      <Shell onClose={() => navigate("/home")} progress={0}>
        <p className="text-brand-charcoal/50">{error ? t("practice.errorTitle") : t("common.loading")}</p>
      </Shell>
    );
  }

  if (phase === "intro") {
    return (
      <Shell onClose={() => navigate("/home")} progress={0}>
        <div className="py-6">
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-brand-forest text-white">
            <ClipboardCheck className="w-8 h-8" />
          </span>
          <h1 data-testid="assessment-title" className="mt-6 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            {tx("title")}
          </h1>
          <p className="mt-3 text-base text-brand-charcoal/70 leading-relaxed">{tx("subtitle")}</p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-brand-charcoal/60 bg-white border border-black/5 rounded-full px-4 py-1.5">
            {tx("duration")}
          </p>
          <p className="mt-6 text-sm text-brand-charcoal/60 leading-relaxed">{tx("note")}</p>
          <div className="mt-10 space-y-3">
            <PrimaryBtn testId="assessment-start-btn" disabled={busy} onClick={begin}>
              {tx("start")} <ArrowRight className="w-4 h-4" />
            </PrimaryBtn>
            <button
              data-testid="assessment-maybe-later-btn"
              onClick={() => navigate("/home")}
              className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest transition-colors py-2"
            >
              {tx("maybe_later")}
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "test") {
    const q = questions[idx];
    const progress = total ? ((idx) / total) * 100 : 0;
    return (
      <Shell onClose={() => navigate("/home")} progress={progress}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
            {areaName(q.area)}
          </span>
          <span data-testid="assessment-progress" className="text-sm text-brand-charcoal/50 tabular-nums">
            {idx + 1} / {total}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={q.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <AssessmentQuestion q={q} busy={busy} onAnswered={onAnswered} t={t} />
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // result
  const diff = result?.current_score != null && result?.baseline_score != null
    ? result.current_score - result.baseline_score
    : null;
  const showComparison = result?.baseline_score != null && !result?.is_baseline;

  return (
    <Shell onClose={() => navigate("/home")} progress={100}>
      <div className="py-4">
        <h1 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight">{tx("results")}</h1>

        <div className="mt-6 rounded-2xl bg-white border border-black/5 p-6 shadow-sm text-center">
          <p data-testid="assessment-overall-score" className="text-6xl font-serif text-brand-forest">
            {result.overall_score}%
          </p>
          <p className="mt-2 text-lg font-serif text-brand-espresso">{bandName(result.band_key)}</p>
          {showComparison && (
            <div className="mt-5 flex items-center justify-center gap-6 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">{tx("baseline")}</p>
                <p className="text-xl font-serif text-brand-espresso" data-testid="assessment-baseline-score">{result.baseline_score}%</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">{tx("current")}</p>
                <p className="text-xl font-serif text-brand-forest" data-testid="assessment-current-score">{result.current_score}%</p>
              </div>
              {diff !== null && (
                <span className={`text-sm font-semibold ${diff >= 0 ? "text-brand-forest" : "text-brand-terracotta"}`}>
                  {diff >= 0 ? "+" : ""}{diff}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 6 areas */}
        <div className="mt-6 space-y-3" data-testid="assessment-areas">
          {meta.areas.map((a) => {
            const score = result.area_scores[a.key] ?? 0;
            return (
              <div key={a.key} data-testid={`assessment-area-${a.key}`} className="rounded-xl bg-white border border-black/5 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-brand-charcoal">{areaName(a.key)}</span>
                  <span className="text-sm font-semibold text-brand-espresso tabular-nums">{score}%</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-black/5 overflow-hidden">
                  <div className="h-full bg-brand-forest transition-all duration-500" style={{ width: `${score}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Strong / Needs practice */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-brand-success-muted p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-forest">
              <TrendingUp className="w-4 h-4" /> {tx("strong")}
            </p>
            <ul className="mt-2 space-y-1" data-testid="assessment-strong">
              {(result.strong_areas || []).map((k) => (
                <li key={k} className="text-sm text-brand-espresso">{areaName(k)}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl bg-brand-terracotta/10 p-4">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-terracotta-hover">
              <AlertCircle className="w-4 h-4" /> {tx("needs_practice")}
            </p>
            <ul className="mt-2 space-y-1" data-testid="assessment-needs-practice">
              {(result.weak_areas || []).map((k) => (
                <li key={k} className="text-sm text-brand-espresso">{areaName(k)}</li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mt-6 text-xs text-brand-charcoal/50 leading-relaxed">{tx("note")}</p>

        <div className="mt-8 space-y-3">
          <PrimaryBtn testId="assessment-retake-btn" disabled={busy} onClick={begin}>
            <RotateCw className="w-4 h-4" /> {tx("retake")}
          </PrimaryBtn>
          <button
            data-testid="assessment-to-home-btn"
            onClick={() => navigate("/home")}
            className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest transition-colors py-2"
          >
            {t("lesson.backHome")}
          </button>
        </div>
      </div>
    </Shell>
  );
}

function AssessmentQuestion({ q, busy, onAnswered, t }) {
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState("");
  const shuffled = useMemo(() => {
    if (q.type !== "word_ordering") return [];
    return (q.words || []).map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5);
  }, [q]);
  const [picked, setPicked] = useState([]);

  const canSubmit =
    (q.type === "multiple_choice" && selected !== null) ||
    (q.type === "fill_gap" && text.trim().length > 0) ||
    (q.type === "word_ordering" && picked.length === (q.words || []).length);

  const submit = () => {
    let submitted = null;
    if (q.type === "multiple_choice") submitted = selected;
    else if (q.type === "fill_gap") submitted = text;
    else if (q.type === "word_ordering") submitted = picked.map((p) => p.w).join(" ");
    onAnswered(q, submitted);
  };

  return (
    <div data-testid={`assessment-question-${q.id}`}>
      <p className="text-lg text-brand-espresso font-medium">{q.prompt}</p>

      {q.type === "multiple_choice" && (
        <div className="mt-5 space-y-3">
          {q.options.map((opt, i) => (
            <button
              key={i}
              data-testid={`assessment-option-${i}`}
              onClick={() => setSelected(i)}
              className={`flex items-center w-full text-left rounded-xl border px-5 py-4 transition-all ${
                selected === i
                  ? "border-brand-forest bg-brand-success-muted"
                  : "border-black/5 bg-white hover:border-brand-forest/30"
              }`}
            >
              <span className="text-brand-charcoal">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {q.type === "fill_gap" && (
        <div className="mt-5">
          <p className="text-lg text-brand-espresso bg-white border border-black/5 rounded-xl px-5 py-4">{q.sentence}</p>
          <input
            data-testid="assessment-gap-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && !busy && submit()}
            placeholder={t("question.gapPlaceholder")}
            className="mt-3 w-full rounded-xl border border-black/10 bg-white px-5 py-4 text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-forest"
          />
        </div>
      )}

      {q.type === "word_ordering" && (
        <div className="mt-5">
          <div
            data-testid="assessment-answer-area"
            className="min-h-[56px] rounded-xl border border-dashed border-black/15 bg-white px-4 py-3 flex flex-wrap gap-2 items-center"
          >
            {picked.length === 0 && (
              <span className="text-sm text-brand-charcoal/40">{t("question.orderPlaceholder")}</span>
            )}
            {picked.map((p) => (
              <button
                key={p.i}
                onClick={() => setPicked((prev) => prev.filter((x) => x.i !== p.i))}
                className="px-3 py-2 rounded-lg bg-brand-forest text-white text-sm"
              >
                {p.w}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {shuffled.map((p) => {
              const used = picked.some((x) => x.i === p.i);
              return (
                <button
                  key={p.i}
                  disabled={used}
                  onClick={() => setPicked((prev) => [...prev, p])}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                    used ? "opacity-30 border-black/5 bg-white" : "border-black/10 bg-white hover:border-brand-forest/40"
                  }`}
                >
                  {p.w}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-8">
        <PrimaryBtn testId="assessment-continue-btn" disabled={!canSubmit || busy} onClick={submit}>
          {t("question.next")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Shell({ children, onClose, progress }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5 pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button
            data-testid="assessment-close-btn"
            onClick={onClose}
            className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors"
            aria-label={t("lesson.closeAria")}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div className="h-full bg-brand-forest transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">{children}</main>
    </div>
  );
}

function PrimaryBtn({ children, testId, ...props }) {
  return (
    <button
      data-testid={testId}
      className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
      {...props}
    >
      {children}
    </button>
  );
}
