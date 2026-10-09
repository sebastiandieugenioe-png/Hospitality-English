import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  CircleCheck,
  CircleX,
  Sparkles,
  Brain,
  RotateCw,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import {
  getReviewItems,
  getReviewSummary,
  getSkills,
  answerReviewItem,
  rateReviewItem,
} from "@/lib/api";
import { getLocalizedField } from "@/lib/i18n";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";

const FILTER_KEYS = ["all", "english", "comprehension", "service"];
const RATING_DEFS = [
  { key: "again", tone: "terracotta" },
  { key: "hard", tone: "muted" },
  { key: "good", tone: "forest" },
  { key: "easy", tone: "forest" },
];

export default function Practice() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, guestId, language, t } = useApp();
  const billing = useBilling();
  const premiumParam = () => ({ free_only: !billing.isPremium("hospitality") });
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [skillsMap, setSkillsMap] = useState({});
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null); // null = landing
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  const load = async () => {
    if (!guestId) return;
    setLoading(true);
    setError(false);
    try {
      const [sum, all, sk] = await Promise.all([
        getReviewSummary(guestId),
        getReviewItems(guestId, premiumParam()),
        getSkills({}),
      ]);
      setSummary(sum);
      setItems(all);
      setSkillsMap(Object.fromEntries(sk.map((s) => [s.id, getLocalizedField(s, "name", language) || s.name])));
    } catch (e) {
      console.error("Practice load failed", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (guestId && onboardingCompleted) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId, onboardingCompleted, language]);

  const startSession = async () => {
    const due = await getReviewItems(guestId, { due: true, limit: 10, ...premiumParam() });
    if (!due.length) return;
    setSession({ queue: due, index: 0 });
  };

  const endSession = async () => {
    setSession(null);
    await load();
  };

  const now = new Date().toISOString();
  const filtered = items.filter((it) => filter === "all" || it.assessment_dimension === filter);
  const skillGroups = useMemo(() => {
    const g = {};
    for (const it of items) {
      const k = it.primary_skill || "otros";
      g[k] = (g[k] || 0) + 1;
    }
    return Object.entries(g).sort((a, b) => b[1] - a[1]);
  }, [items]);

  if (session) {
    return (
      <ReviewSession session={session} setSession={setSession} onEnd={endSession} t={t} />
    );
  }

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <motion.header initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-terracotta mb-3">
            {t("practice.eyebrow")}
          </p>
          <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">{t("practice.title")}</h1>
          <p className="mt-3 text-base text-brand-charcoal/70">
            {t("practice.subtitle")}
          </p>
        </motion.header>

        {loading ? (
          <p className="mt-8 text-brand-charcoal/50">{t("common.loading")}</p>
        ) : error ? (
          <div
            data-testid="practice-error-state"
            className="mt-10 rounded-3xl bg-white border border-black/5 p-10 text-center shadow-sm"
          >
            <h2 className="text-2xl font-serif text-brand-espresso">{t("practice.errorTitle")}</h2>
            <p className="mt-2 text-brand-charcoal/60">{t("practice.errorBody")}</p>
            <button
              data-testid="practice-retry-btn"
              onClick={load}
              className="mt-8 inline-flex items-center justify-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3.5 font-medium hover:bg-brand-forest-hover transition-colors"
            >
              <RotateCw className="w-4 h-4" /> {t("common.retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <EmptyState navigate={navigate} t={t} />
        ) : (
          <>
            {/* Due queue — primary visual priority */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="mt-8 rounded-3xl bg-brand-forest text-white p-7 sm:p-9 shadow-sm"
              data-testid="practice-due-card"
            >
              <div className="flex items-center gap-2 text-white/70">
                <Brain className="w-5 h-5" strokeWidth={1.75} />
                <span className="text-xs uppercase tracking-[0.15em]">{t("practice.dueLabel")}</span>
              </div>
              <p className="mt-3 text-6xl font-serif" data-testid="practice-due-count">
                {summary?.due ?? 0}
              </p>
              <p className="mt-1 text-white/70 text-sm">
                {summary?.due ? t("practice.dueReady") : t("practice.dueNone")}
              </p>
              <button
                data-testid="practice-start-btn"
                disabled={!summary?.due}
                onClick={startSession}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3.5 font-medium bg-white text-brand-forest hover:bg-brand-sand disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {t("practice.startBtn")} <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* Recent mistakes grouped by skill */}
            {skillGroups.length > 0 && (
              <>
                <h2 className="mt-12 text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">
                  {t("practice.errorsBySkill")}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {skillGroups.map(([skill, count]) => (
                    <div
                      key={skill}
                      data-testid={`practice-skill-group-${skill}`}
                      className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm flex items-center justify-between gap-4"
                    >
                      <span className="font-serif text-lg text-brand-espresso">
                        {skillsMap[skill] || skill}
                      </span>
                      <span className="shrink-0 grid place-items-center min-w-8 h-8 px-2 rounded-full bg-brand-terracotta/10 text-brand-terracotta text-sm font-semibold">
                        {count}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Mistake Bank — all active mistakes, with filters */}
            <div className="mt-12 flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
                {t("practice.mistakeBank")}
              </h2>
              <div className="flex items-center gap-1.5 flex-wrap" data-testid="practice-filters">
                {FILTER_KEYS.map((key) => (
                  <button
                    key={key}
                    data-testid={`practice-filter-${key}`}
                    onClick={() => setFilter(key)}
                    className={`text-xs font-medium rounded-full px-3.5 py-1.5 transition-colors ${
                      filter === key
                        ? "bg-brand-forest text-white"
                        : "bg-white border border-black/5 text-brand-charcoal/60 hover:text-brand-forest"
                    }`}
                  >
                    {t(`filter.${key}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3" data-testid="practice-mistake-list">
              {filtered.length === 0 ? (
                <p className="text-sm text-brand-charcoal/50 py-4">
                  {t("practice.emptyCategory")}
                </p>
              ) : (
                filtered.map((it) => {
                  const isDue = (it.next_review_at || now) <= now;
                  return (
                    <div
                      key={it.id}
                      data-testid={`mistake-item-${it.id}`}
                      className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-brand-espresso font-medium leading-snug">
                          {it.content?.prompt}
                        </p>
                        <span
                          className={`shrink-0 text-[10px] uppercase tracking-[0.12em] px-2 py-1 rounded-full ${
                            isDue
                              ? "bg-brand-terracotta/10 text-brand-terracotta"
                              : "bg-black/5 text-brand-charcoal/50"
                          }`}
                        >
                          {isDue ? t("practice.pending") : t("practice.scheduled")}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-brand-charcoal/50">
                        <span className="text-brand-forest">
                          {t(`score.${it.assessment_dimension}`)}
                        </span>
                        <span>·</span>
                        <span>{it.situation_title}</span>
                        {it.times_wrong > 1 && (
                          <>
                            <span>·</span>
                            <span>{t("practice.fails", { n: it.times_wrong })}</span>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function EmptyState({ navigate, t }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      data-testid="practice-empty-state"
      className="mt-10 rounded-3xl bg-white border border-black/5 p-10 text-center shadow-sm"
    >
      <span className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-brand-success-muted text-brand-forest">
        <Sparkles className="w-8 h-8" strokeWidth={1.5} />
      </span>
      <h2 className="mt-6 text-2xl font-serif text-brand-espresso">{t("practice.emptyTitle")}</h2>
      <p className="mt-2 text-brand-charcoal/60 max-w-md mx-auto">
        {t("practice.emptyBody")}
      </p>
      <button
        data-testid="practice-go-learn-btn"
        onClick={() => navigate("/learn")}
        className="mt-8 inline-flex items-center justify-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3.5 font-medium hover:bg-brand-forest-hover transition-colors"
      >
        {t("practice.goLearn")} <ArrowRight className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/* ---------- Review session ---------- */
function ReviewSession({ session, setSession, onEnd, t }) {
  const { queue, index } = session;
  const item = queue[index];
  const [phase, setPhase] = useState("question"); // question | feedback
  const [result, setResult] = useState(null);
  const [submitted, setSubmitted] = useState(null);
  const [busy, setBusy] = useState(false);

  const total = queue.length;

  const onAnswer = async (answer) => {
    setBusy(true);
    setSubmitted(answer);
    try {
      const res = await answerReviewItem(item.id, answer);
      setResult(res);
      setPhase("feedback");
    } finally {
      setBusy(false);
    }
  };

  const onRate = async (rating) => {
    setBusy(true);
    try {
      await rateReviewItem(item.id, rating);
    } finally {
      setBusy(false);
    }
    if (index + 1 >= total) {
      setSession({ ...session, done: true });
    } else {
      setResult(null);
      setSubmitted(null);
      setPhase("question");
      setSession({ ...session, index: index + 1 });
    }
  };

  if (session.done) {
    return (
      <div className="min-h-screen bg-brand-sand">
        <Navbar />
        <main className="max-w-2xl mx-auto px-5 sm:px-8 py-16 text-center">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="grid place-items-center w-20 h-20 mx-auto rounded-full bg-brand-forest text-white"
          >
            <CircleCheck className="w-9 h-9" />
          </motion.div>
          <h1 className="mt-6 text-3xl sm:text-4xl font-serif text-brand-espresso" data-testid="session-complete">
            {t("session.completeTitle")}
          </h1>
          <p className="mt-2 text-brand-charcoal/60">
            {t(total === 1 ? "session.reviewedOne" : "session.reviewedOther", { n: total })}
          </p>
          <button
            data-testid="session-done-btn"
            onClick={onEnd}
            className="mt-8 inline-flex items-center justify-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3.5 font-medium hover:bg-brand-forest-hover transition-colors"
          >
            {t("session.done")} <ArrowRight className="w-4 h-4" />
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button
            data-testid="session-close-btn"
            onClick={onEnd}
            className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors"
          >
            <CircleX className="w-5 h-5" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-brand-forest transition-all duration-500"
              style={{ width: `${(index / total) * 100}%` }}
            />
          </div>
          <span className="text-xs text-brand-charcoal/50 tabular-nums">
            {index + 1} / {total}
          </span>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${item.id}-${phase}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-xs uppercase tracking-[0.15em] text-brand-forest mb-4">
              {t(`score.${item.assessment_dimension}`)} · {item.situation_title}
            </p>
            <QuestionRenderer
              content={item.content}
              phase={phase}
              submitted={submitted}
              busy={busy}
              onAnswer={onAnswer}
              t={t}
            />
            {phase === "feedback" && result && (
              <Feedback result={result} busy={busy} onRate={onRate} t={t} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function QuestionRenderer({ content, phase, submitted, busy, onAnswer, t }) {
  const [selected, setSelected] = useState(null);
  const [text, setText] = useState("");
  const shuffled = useMemo(() => {
    if (content.type !== "word_ordering") return [];
    return content.words.map((w, i) => ({ w, i })).sort(() => Math.random() - 0.5);
  }, [content]);
  const [picked, setPicked] = useState([]);

  const answered = phase === "feedback";

  const canCheck =
    (content.type === "multiple_choice" && selected !== null) ||
    (content.type === "fill_gap" && text.trim().length > 0) ||
    (content.type === "word_ordering" && picked.length === content.words.length);

  const submit = () => {
    if (content.type === "multiple_choice") onAnswer(selected);
    else if (content.type === "fill_gap") onAnswer(text);
    else onAnswer(picked.map((p) => p.w).join(" "));
  };

  return (
    <div>
      <p className="text-lg text-brand-espresso font-medium">{content.prompt}</p>

      {content.type === "multiple_choice" && (
        <div className="mt-5 space-y-3">
          {content.options.map((opt, i) => {
            const chosen = selected === i;
            return (
              <button
                key={i}
                data-testid={`review-option-${i}`}
                disabled={answered}
                onClick={() => setSelected(i)}
                className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${
                  chosen ? "border-brand-forest bg-brand-success-muted" : "border-black/5 bg-white hover:border-brand-forest/30"
                } ${answered ? "opacity-60" : ""}`}
              >
                <span className="text-brand-charcoal">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {content.type === "fill_gap" && (
        <div className="mt-5">
          <p className="text-lg text-brand-espresso bg-white border border-black/5 rounded-xl px-5 py-4">
            {content.sentence}
          </p>
          <input
            data-testid="review-input"
            value={text}
            disabled={answered}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCheck && !answered && submit()}
            placeholder={t("question.gapPlaceholder")}
            className="mt-3 w-full rounded-xl border border-black/10 bg-white px-5 py-4 text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-forest"
          />
        </div>
      )}

      {content.type === "word_ordering" && (
        <div className="mt-5">
          <div
            data-testid="review-answer-area"
            className="min-h-[56px] rounded-xl border border-dashed border-black/15 bg-white px-4 py-3 flex flex-wrap gap-2 items-center"
          >
            {picked.length === 0 && (
              <span className="text-sm text-brand-charcoal/40">{t("question.orderPlaceholder")}</span>
            )}
            {picked.map((p) => (
              <button
                key={p.i}
                disabled={answered}
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
                  disabled={used || answered}
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

      {!answered && (
        <button
          data-testid="review-check-btn"
          disabled={!canCheck || busy}
          onClick={submit}
          className="mt-8 inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
        >
          {t("question.check")}
        </button>
      )}
    </div>
  );
}

function Feedback({ result, busy, onRate, t }) {
  return (
    <div className="mt-6">
      <div
        data-testid="review-feedback"
        className={`rounded-xl p-4 ${
          result.correct ? "bg-brand-success-muted text-brand-forest" : "bg-brand-terracotta/10 text-brand-terracotta-hover"
        }`}
      >
        <p className="font-semibold flex items-center gap-2">
          {result.correct ? <CircleCheck className="w-5 h-5" /> : <CircleX className="w-5 h-5" />}
          {result.correct ? t("question.correct") : t("question.incorrect")}
        </p>
        {!result.correct && result.correct_answer != null && (
          <p className="mt-1 text-sm text-brand-charcoal/70">
            {t("question.correctAnswer")} <span className="font-medium">{result.correct_answer}</span>
          </p>
        )}
        {result.explanation && (
          <p className="mt-1 text-sm text-brand-charcoal/70">{result.explanation}</p>
        )}
      </div>

      <p className="mt-6 flex items-center gap-2 text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
        <RotateCw className="w-4 h-4" /> {t("practice.rateQuestion")}
      </p>
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="review-ratings">
        {RATING_DEFS.map((r) => (
          <button
            key={r.key}
            data-testid={`review-rate-${r.key}`}
            disabled={busy}
            onClick={() => onRate(r.key)}
            className={`rounded-lg px-4 py-3.5 font-medium text-sm transition-colors disabled:opacity-40 ${
              r.tone === "forest"
                ? "bg-brand-forest text-white hover:bg-brand-forest-hover"
                : r.tone === "terracotta"
                ? "border border-brand-terracotta/30 text-brand-terracotta hover:bg-brand-terracotta/5"
                : "border border-black/10 text-brand-charcoal hover:bg-black/[0.03]"
            }`}
          >
            {t(`rate.${r.key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
