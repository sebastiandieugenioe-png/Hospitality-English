import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X, Moon, CheckCircle2, XCircle, Check } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getText } from "@/lib/i18n";
import {
  getTonightsShiftMeta,
  startTonightsShift,
  getTonightsShiftToday,
  submitShiftResponse,
  completeTonightsShift,
} from "@/lib/api";

export function localDateStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function prettySkill(slug) {
  if (!slug) return "";
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TonightsShift() {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const [meta, setMeta] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | intro | test | result
  const [session, setSession] = useState(null);
  const [idx, setIdx] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const localDate = useMemo(() => localDateStr(), []);

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await getTonightsShiftMeta();
        const gid = await ensureGuest();
        const today = await getTonightsShiftToday(gid, { local_date: localDate });
        if (!active) return;
        setMeta(m);
        if (today.exists && today.status === "completed") {
          setResult(today);
          setPhase("result");
        } else if (today.exists && today.status === "in_progress") {
          setSession(today);
          setPhase("intro");
        } else {
          setPhase("intro");
        }
      } catch (e) {
        if (active) setPhase("intro");
      }
    })();
    return () => { active = false; };
  }, [ensureGuest, localDate]);

  const tx = (key) => (meta ? getText(meta.ui[key], language) : "");

  const begin = async () => {
    setBusy(true);
    try {
      const gid = await ensureGuest();
      const s = await startTonightsShift(gid, localDate);
      if (s.status === "completed") {
        setResult(s);
        setPhase("result");
      } else {
        setSession(s);
        const firstUnanswered = s.items.findIndex((i) => !i.answered);
        setIdx(firstUnanswered < 0 ? 0 : firstUnanswered);
        setPhase("test");
      }
    } finally {
      setBusy(false);
    }
  };

  const onAnswered = async () => {
    if (idx + 1 >= session.items.length) {
      setBusy(true);
      try {
        const res = await completeTonightsShift(session.session_id);
        setResult(res);
        setPhase("result");
      } finally {
        setBusy(false);
      }
    } else {
      setIdx((i) => i + 1);
    }
  };

  if (phase === "loading" || !meta) {
    return <Shell onClose={() => navigate("/home")} progress={0}><p className="text-brand-charcoal/50">{t("common.loading")}</p></Shell>;
  }

  if (phase === "intro") {
    const resuming = session && session.status === "in_progress";
    return (
      <Shell onClose={() => navigate("/home")} progress={0}>
        <div className="py-6">
          <span className="grid place-items-center w-16 h-16 rounded-2xl bg-brand-espresso text-white">
            <Moon className="w-8 h-8" />
          </span>
          <h1 data-testid="shift-title" className="mt-6 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            {tx("title")}
          </h1>
          <p className="mt-3 text-base text-brand-charcoal/70 leading-relaxed">{tx("subtitle")}</p>
          <p className="mt-4 inline-flex items-center gap-2 text-sm text-brand-charcoal/60 bg-white border border-black/5 rounded-full px-4 py-1.5">
            {tx("duration")}
          </p>
          <div className="mt-10">
            <PrimaryBtn testId="shift-start-btn" disabled={busy} onClick={begin}>
              {resuming ? tx("continue") : tx("start")} <ArrowRight className="w-4 h-4" />
            </PrimaryBtn>
          </div>
        </div>
      </Shell>
    );
  }

  if (phase === "test") {
    const item = session.items[idx];
    const progress = (idx / session.items.length) * 100;
    const progressText = (meta.ui.question_progress ? getText(meta.ui.question_progress, language) : "{current}/{total}")
      .replace("{current}", idx + 1)
      .replace("{total}", session.items.length);
    return (
      <Shell onClose={() => navigate("/home")} progress={progress}>
        <div className="flex items-center justify-between mb-5">
          <span className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
            {tx("title")}
          </span>
          <span data-testid="shift-progress" className="text-sm text-brand-charcoal/50 tabular-nums">
            {progressText}
          </span>
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
            <ShiftQuestion item={item} sessionId={session.session_id} meta={meta} language={language} onAnswered={onAnswered} t={t} />
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // result
  const score = result?.correct_count ?? 0;
  return (
    <Shell onClose={() => navigate("/home")} progress={100}>
      <div className="py-6 text-center">
        <span className="inline-grid place-items-center w-16 h-16 rounded-2xl bg-brand-success-muted text-brand-forest">
          <CheckCircle2 className="w-8 h-8" />
        </span>
        <h1 data-testid="shift-complete-title" className="mt-6 text-2xl sm:text-3xl font-serif text-brand-espresso">{tx("complete_title")}</h1>
        <p className="mt-4 text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/45">{tx("score")}</p>
        <p data-testid="shift-score" className="text-6xl font-serif text-brand-forest">{score} / {meta.session_size || 5}</p>
        {result?.focus_skill && (
          <div className="mt-6 inline-block rounded-xl bg-brand-terracotta/10 px-5 py-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-brand-terracotta-hover font-semibold">{tx("focus_next")}</p>
            <p data-testid="shift-focus-skill" className="mt-1 text-brand-espresso">{prettySkill(result.focus_skill)}</p>
          </div>
        )}
        <div className="mt-10">
          <PrimaryBtn testId="shift-home-btn" onClick={() => navigate("/home")}>{tx("back_home")}</PrimaryBtn>
        </div>
      </div>
    </Shell>
  );
}

function ShiftQuestion({ item, sessionId, meta, language, onAnswered, t }) {
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [busy, setBusy] = useState(false);

  const shuffled = useMemo(() => {
    if (item.type !== "word_ordering") return [];
    return (item.words || []).map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5);
  }, [item]);

  const canSubmit =
    (item.type === "multiple_choice" && selected !== null) ||
    (item.type === "fill_gap" && text.trim().length > 0) ||
    (item.type === "word_ordering" && picked.length === (item.words || []).length);

  const tx = (key) => getText(meta.ui[key], language);

  const submit = async () => {
    if (feedback) { onAnswered(); return; }
    let submitted = null;
    if (item.type === "multiple_choice") submitted = selected;
    else if (item.type === "fill_gap") submitted = text;
    else submitted = picked.map((p) => p.w).join(" ");
    setBusy(true);
    try {
      const r = await submitShiftResponse(sessionId, { item_id: item.id, submitted_answer: submitted });
      setFeedback(r);
    } finally {
      setBusy(false);
    }
  };

  const locked = !!feedback;

  return (
    <div data-testid={`shift-question-${item.id}`}>
      <p className="text-lg text-brand-espresso font-medium">{item.prompt}</p>

      {item.type === "multiple_choice" && (
        <div className="mt-5 space-y-3">
          {item.options.map((opt, i) => (
            <button
              key={i}
              data-testid={`shift-option-${i}`}
              disabled={locked}
              onClick={() => setSelected(i)}
              className={`flex items-center w-full text-left rounded-xl border px-5 py-4 transition-all ${
                selected === i ? "border-brand-forest bg-brand-success-muted" : "border-black/5 bg-white hover:border-brand-forest/30"
              }`}
            >
              <span className="text-brand-charcoal">{opt}</span>
            </button>
          ))}
        </div>
      )}

      {item.type === "fill_gap" && (
        <div className="mt-5">
          {item.sentence && <p className="text-lg text-brand-espresso bg-white border border-black/5 rounded-xl px-5 py-4">{item.sentence}</p>}
          <input
            data-testid="shift-gap-input"
            value={text}
            disabled={locked}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canSubmit && !busy && submit()}
            placeholder={t("question.gapPlaceholder")}
            className="mt-3 w-full rounded-xl border border-black/10 bg-white px-5 py-4 text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-forest"
          />
        </div>
      )}

      {item.type === "word_ordering" && (
        <div className="mt-5">
          <div data-testid="shift-answer-area" className="min-h-[56px] rounded-xl border border-dashed border-black/15 bg-white px-4 py-3 flex flex-wrap gap-2 items-center">
            {picked.length === 0 && <span className="text-sm text-brand-charcoal/40">{t("question.orderPlaceholder")}</span>}
            {picked.map((p) => (
              <button key={p.i} disabled={locked} onClick={() => setPicked((prev) => prev.filter((x) => x.i !== p.i))} className="px-3 py-2 rounded-lg bg-brand-forest text-white text-sm">
                {p.w}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {shuffled.map((p) => {
              const used = picked.some((x) => x.i === p.i);
              return (
                <button key={p.i} disabled={used || locked} onClick={() => setPicked((prev) => [...prev, p])}
                  className={`px-3 py-2 rounded-lg border text-sm transition-all ${used ? "opacity-30 border-black/5 bg-white" : "border-black/10 bg-white hover:border-brand-forest/40"}`}>
                  {p.w}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {feedback && (
        <div data-testid="shift-feedback" className={`mt-6 rounded-xl p-4 ${feedback.correct ? "bg-brand-success-muted" : "bg-brand-terracotta/10"}`}>
          <p className={`flex items-center gap-2 font-semibold ${feedback.correct ? "text-brand-forest" : "text-brand-terracotta-hover"}`}>
            {feedback.correct ? <Check className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {feedback.correct ? tx("correct") : tx("not_quite")}
          </p>
          {!feedback.correct && feedback.correct_answer && (
            <p className="mt-1 text-sm text-brand-espresso">{feedback.correct_answer}</p>
          )}
          {feedback.feedback && <p className="mt-2 text-sm text-brand-charcoal/70">{feedback.feedback}</p>}
        </div>
      )}

      <div className="mt-8">
        <PrimaryBtn testId="shift-continue-btn" disabled={(!canSubmit && !locked) || busy} onClick={submit}>
          {locked ? tx("continue") : t("question.next")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

function Shell({ children, onClose, progress }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button data-testid="shift-close-btn" onClick={onClose} className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors" aria-label={t("lesson.closeAria")}>
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
    <button data-testid={testId} className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium" {...props}>
      {children}
    </button>
  );
}
