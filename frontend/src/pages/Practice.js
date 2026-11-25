import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ChevronRight, CircleCheck, CircleAlert, X, Headphones, Mic, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import {
  getReviewItems,
  getListeningMeta,
  getSpeakingMeta,
  answerReviewItem,
  rateReviewItem,
} from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";

const FILTER_KEYS = ["all", "english", "comprehension", "service"];
const RATING_KEYS = ["again", "hard", "good", "easy"];
const eyebrow = "text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]";
const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31]";
const btn = `inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] transition-colors ${focusRing}`;
const btnDark = `${btn} bg-[#173D31] text-white hover:bg-[#102E25] disabled:opacity-40 disabled:cursor-not-allowed`;
const btnLight = `${btn} border border-[#DEE2DE] bg-white text-[#173D31] hover:bg-[#EEF3EF]`;

export default function Practice() {
  const navigate = useNavigate();
  const { loading: guestLoading, onboardingCompleted, guestId, language, t } = useApp();
  const billing = useBilling();
  const premiumParam = () => ({ free_only: !billing.isPremium("hospitality") });
  const [items, setItems] = useState([]);
  const [dueCount, setDueCount] = useState(0);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null); // null = landing
  const [error, setError] = useState(false);
  const [sizes, setSizes] = useState({ listening: null, speaking: null });
  const modesRef = useRef(null);

  useEffect(() => {
    if (!guestLoading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [guestLoading, onboardingCompleted, navigate]);

  useEffect(() => {
    getListeningMeta().then((m) => setSizes((s) => ({ ...s, listening: m?.session_size ?? null }))).catch(() => {});
    getSpeakingMeta().then((m) => setSizes((s) => ({ ...s, speaking: m?.session_size ?? null }))).catch(() => {});
  }, []);

  const load = async () => {
    if (!guestId) return;
    setLoading(true);
    setError(false);
    try {
      const [all, due] = await Promise.all([
        getReviewItems(guestId, premiumParam()),
        getReviewItems(guestId, { due: true, limit: 200, ...premiumParam() }),
      ]);
      setItems(all);
      setDueCount(due.length);
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
  }, [guestId, onboardingCompleted, language, billing.customerInfo]);

  const startSession = async () => {
    const due = await getReviewItems(guestId, { due: true, limit: 10, ...premiumParam() });
    if (!due.length) return;
    setSession({ queue: due, index: 0, correct: 0 });
    window.scrollTo(0, 0);
  };

  const endSession = async () => {
    setSession(null);
    await load();
  };

  const scrollToModes = () => modesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  const filtered = items.filter((it) => filter === "all" || it.assessment_dimension === filter);
  const reviewState = items.length === 0 ? "empty" : dueCount > 0 ? "due" : "caught-up";

  if (session) {
    return <ReviewSession session={session} setSession={setSession} onEnd={endSession} t={t} navigate={navigate} />;
  }

  return (
    <AppShell title={t("nav.practice")}>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-8 pb-10 sm:pt-12 space-y-8" data-testid="practice-page">
        <motion.header initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <h1 className="text-[30px] leading-tight sm:text-4xl font-serif font-bold text-[#222824] tracking-tight">{t("practice.title")}</h1>
          <p className="mt-1.5 text-[15px] text-[#6B736E]">{t("practice.hubSubtitle")}</p>
        </motion.header>

        {loading ? (
          <div data-testid="practice-loading" className="h-[176px] rounded-2xl bg-[#EEF3EF] animate-pulse" />
        ) : error ? (
          <ErrorState onRetry={load} t={t} />
        ) : (
          <RecommendedCard
            state={reviewState}
            due={dueCount}
            t={t}
            onReview={startSession}
            onAnyway={scrollToModes}
            onLearn={() => navigate("/learn")}
          />
        )}

        <section ref={modesRef} aria-labelledby="practice-modes-title" className="scroll-mt-20" data-testid="practice-modes">
          <h2 id="practice-modes-title" className={`${eyebrow} mb-3 px-1`}>{t("practice.modesTitle")}</h2>
          <ul className="rounded-2xl border border-[#DEE2DE] bg-white divide-y divide-[#DEE2DE] overflow-hidden">
            <ModeRow testid="practice-mode-listening" icon={Headphones} title={t("home.listening")} sub={t("home.listeningSub")}
              meta={sizes.listening ? t("practice.listeningCount", { n: sizes.listening }) : null} onClick={() => navigate("/listening-practice")} />
            <ModeRow testid="practice-mode-speaking" icon={Mic} title={t("home.speaking")} sub={t("practice.speakingSub")}
              meta={sizes.speaking ? t("practice.speakingCount", { n: sizes.speaking }) : null} onClick={() => navigate("/speaking-practice")} />
            <ModeRow testid="practice-mode-review" icon={RotateCcw} title={t("home.reviewTitle")} sub={t("practice.reviewSub")}
              meta={t("practice.reviewSession")}
              onClick={() => (reviewState === "due" ? startSession() : reviewState === "empty" ? navigate("/learn") : document.getElementById("practice-review-items")?.scrollIntoView({ behavior: "smooth" }))} />
          </ul>
        </section>

        {!loading && !error && items.length > 0 && (
          <ReviewItemsList items={filtered} filter={filter} setFilter={setFilter} t={t} />
        )}
      </main>
    </AppShell>
  );
}

function RecommendedCard({ state, due, t, onReview, onAnyway, onLearn }) {
  const cfg = {
    due: {
      icon: RotateCcw,
      title: due === 1 ? t("home.reviewDueOne") : t("home.reviewDueOther", { n: due }),
      sub: t("home.reviewDueSub"),
      cta: t("home.reviewNow"),
      onClick: onReview,
      testid: "practice-start-btn",
    },
    "caught-up": {
      icon: CircleCheck,
      title: t("home.caughtUp"),
      sub: t("home.caughtUpSub"),
      cta: t("home.practiceAnyway"),
      onClick: onAnyway,
      testid: "practice-anyway-btn",
    },
    empty: {
      icon: Sparkles,
      title: t("practice.noReviewsTitle"),
      sub: t("practice.noReviewsBody"),
      cta: t("practice.startLearning"),
      onClick: onLearn,
      testid: "practice-go-learn-btn",
    },
  }[state];
  const dark = state === "due";
  const Icon = cfg.icon;
  return (
    <section aria-labelledby="practice-rec-title" data-testid="practice-recommended" data-state={state}>
      <h2 className={`${eyebrow} mb-3 px-1`}>{t("practice.recommended")}</h2>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className={`rounded-2xl p-6 sm:p-7 ${dark ? "bg-[#173D31] text-white" : "bg-white border border-[#DEE2DE]"}`}
      >
        <span className={`grid place-items-center w-11 h-11 rounded-xl ${dark ? "bg-white/10 text-white" : "bg-[#EEF3EF] text-[#34785B]"}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </span>
        <p id="practice-rec-title" data-testid="practice-due-count" className={`mt-4 text-[24px] leading-tight font-serif font-semibold ${dark ? "" : "text-[#222824]"}`}>
          {cfg.title}
        </p>
        <p className={`mt-1 text-[15px] ${dark ? "text-white/75" : "text-[#6B736E]"}`}>{cfg.sub}</p>
        <button
          type="button"
          data-testid={cfg.testid}
          onClick={cfg.onClick}
          className={`mt-5 w-full sm:w-auto ${dark ? `${btn} bg-white text-[#173D31] hover:bg-[#EEF3EF]` : btnDark}`}
        >
          {cfg.cta} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </motion.div>
    </section>
  );
}

function ModeRow({ testid, icon: Icon, title, sub, meta, onClick }) {
  return (
    <li>
      <button
        type="button"
        data-testid={testid}
        onClick={onClick}
        className={`w-full min-h-[72px] flex items-center gap-4 px-4 py-3.5 text-left hover:bg-[#F7F5F0] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#173D31]`}
      >
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#EEF3EF] text-[#173D31] shrink-0">
          <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[16px] font-semibold text-[#222824]">{title}</span>
          <span className="block text-[13px] text-[#6B736E] leading-snug">{[sub, meta].filter(Boolean).join(" · ")}</span>
        </span>
        <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />
      </button>
    </li>
  );
}

function ReviewItemsList({ items, filter, setFilter, t }) {
  const now = new Date().toISOString();
  return (
    <section id="practice-review-items" aria-labelledby="practice-items-title" className="scroll-mt-20">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3 px-1">
        <h2 id="practice-items-title" className={eyebrow}>{t("practice.reviewItems")}</h2>
        <div className="flex items-center gap-1.5 flex-wrap" data-testid="practice-filters">
          {FILTER_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              data-testid={`practice-filter-${key}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
              className={`text-[13px] font-medium rounded-full px-3.5 min-h-[36px] transition-colors ${focusRing} ${
                filter === key ? "bg-[#173D31] text-white" : "bg-white border border-[#DEE2DE] text-[#6B736E] hover:text-[#173D31]"
              }`}
            >
              {t(`filter.${key}`)}
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#6B736E] py-4 px-1">{t("practice.emptyCategory")}</p>
      ) : (
        <ul data-testid="practice-mistake-list" className="rounded-2xl border border-[#DEE2DE] bg-white divide-y divide-[#DEE2DE] overflow-hidden">
          {items.map((it) => {
            const isDue = (it.next_review_at || now) <= now;
            return (
              <li key={it.id} data-testid={`mistake-item-${it.id}`} className="px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] text-[#222824] font-medium leading-snug">{it.content?.prompt}</p>
                  <span className={`shrink-0 text-[11px] uppercase tracking-[0.1em] font-semibold px-2 py-1 rounded-full ${isDue ? "bg-[#173D31] text-white" : "bg-[#EEF3EF] text-[#6B736E]"}`}>
                    {isDue ? t("practice.pending") : t("practice.scheduled")}
                  </span>
                </div>
                <p className="mt-1 text-[13px] text-[#6B736E]">
                  {[t(`score.${it.assessment_dimension}`), it.situation_title, it.times_wrong > 1 ? t("practice.fails", { n: it.times_wrong }) : null].filter(Boolean).join(" · ")}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function ErrorState({ onRetry, t }) {
  return (
    <div data-testid="practice-error-state" className="rounded-2xl bg-white border border-[#DEE2DE] p-6 text-center">
      <h2 className="text-[21px] font-serif font-semibold text-[#222824]">{t("practice.errorTitle")}</h2>
      <p className="mt-1 text-[15px] text-[#6B736E]">{t("practice.errorBody")}</p>
      <button type="button" data-testid="practice-retry-btn" onClick={onRetry} className={`mt-5 ${btnDark}`}>
        <RotateCw className="w-4 h-4" aria-hidden="true" /> {t("common.retry")}
      </button>
    </div>
  );
}

/* ---------- Review session (focus mode: no AppShell / bottom nav) ---------- */
function ReviewSession({ session, setSession, onEnd, t, navigate }) {
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
      if (res.correct) setSession((s) => ({ ...s, correct: (s.correct || 0) + 1 }));
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
      setSession((s) => ({ ...s, done: true }));
    } else {
      setResult(null);
      setSubmitted(null);
      setPhase("question");
      setSession((s) => ({ ...s, index: index + 1 }));
    }
  };

  if (session.done) {
    return <SessionComplete total={total} correct={session.correct || 0} t={t} onDone={onEnd} onLearn={() => navigate("/learn")} />;
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col" data-testid="review-session">
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/90 backdrop-blur-xl border-b border-[#DEE2DE] pt-[env(safe-area-inset-top)]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button
            type="button"
            data-testid="session-close-btn"
            onClick={onEnd}
            aria-label={t("review.closeAria")}
            className={`grid place-items-center w-11 h-11 -ml-2 rounded-full text-[#6B736E] hover:text-[#222824] hover:bg-[#EEF3EF] transition-colors ${focusRing}`}
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          <div
            role="progressbar"
            aria-label={t("review.progressAria", { i: index + 1, n: total })}
            aria-valuemin={0}
            aria-valuemax={total}
            aria-valuenow={index + 1}
            className="flex-1 h-1.5 rounded-full bg-[#DEE2DE] overflow-hidden"
          >
            <div className="h-full bg-[#173D31] transition-[width] duration-500" style={{ width: `${((index + (phase === "feedback" ? 1 : 0)) / total) * 100}%` }} />
          </div>
          <span data-testid="session-counter" className="text-[13px] font-medium text-[#6B736E] tabular-nums">{index + 1} / {total}</span>
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 pt-8 pb-12">
        <AnimatePresence mode="wait">
          <motion.div key={item.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.25 }}>
            <p className="text-[13px] text-[#6B736E] mb-3">
              {t(`score.${item.assessment_dimension}`)} · {item.situation_title}
            </p>
            <QuestionRenderer content={item.content} phase={phase} submitted={submitted} busy={busy} onAnswer={onAnswer} t={t} />
            {phase === "feedback" && result && <Feedback result={result} busy={busy} onRate={onRate} t={t} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function SessionComplete({ total, correct, t, onDone, onLearn }) {
  return (
    <div className="min-h-screen bg-[#F7F5F0]" data-testid="review-complete">
      <main className="max-w-md mx-auto px-5 sm:px-8 pt-20 pb-12 text-center">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-[#173D31] text-white"
        >
          <CircleCheck className="w-8 h-8" aria-hidden="true" />
        </motion.div>
        <h1 className="mt-6 text-[30px] font-serif font-bold text-[#222824]" data-testid="session-complete">{t("review.complete")}</h1>
        <dl className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white border border-[#DEE2DE] p-4">
            <dt className="text-[13px] text-[#6B736E]">{t("review.reviewedLabel")}</dt>
            <dd data-testid="session-reviewed-count" className="mt-1 text-[28px] font-serif font-semibold text-[#222824]">{total}</dd>
          </div>
          <div className="rounded-2xl bg-white border border-[#DEE2DE] p-4">
            <dt className="text-[13px] text-[#6B736E]">{t("review.correctLabel")}</dt>
            <dd data-testid="session-correct-count" className="mt-1 text-[28px] font-serif font-semibold text-[#34785B]">{correct}</dd>
          </div>
        </dl>
        <div className="mt-8 flex flex-col gap-3">
          <button type="button" data-testid="session-done-btn" onClick={onDone} className={`w-full ${btnDark}`}>{t("review.done")}</button>
          <button type="button" data-testid="session-continue-learning-btn" onClick={onLearn} className={`w-full ${btnLight}`}>{t("review.continueLearning")}</button>
        </div>
      </main>
    </div>
  );
}

function QuestionRenderer({ content, phase, busy, onAnswer, t }) {
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
      <h1 className="text-[21px] leading-snug font-serif font-semibold text-[#222824]">{content.prompt}</h1>

      {content.type === "multiple_choice" && (
        <div className="mt-5 space-y-2.5" role="radiogroup">
          {content.options.map((opt, i) => {
            const chosen = selected === i;
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen}
                data-testid={`review-option-${i}`}
                disabled={answered}
                onClick={() => setSelected(i)}
                className={`flex items-center gap-3 w-full min-h-[52px] text-left rounded-[15px] border px-4 py-3 transition-colors ${focusRing} ${
                  chosen ? "border-[#173D31] bg-[#EEF3EF] border-2" : "border-[#DEE2DE] bg-white hover:border-[#173D31]/40"
                } ${answered && !chosen ? "opacity-70" : ""}`}
              >
                <span className={`w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center ${chosen ? "border-[#173D31]" : "border-[#DEE2DE]"}`} aria-hidden="true">
                  {chosen && <span className="w-2.5 h-2.5 rounded-full bg-[#173D31]" />}
                </span>
                <span className="text-[16px] text-[#222824]">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {content.type === "fill_gap" && (
        <div className="mt-5">
          <p className="text-[17px] text-[#222824] bg-white border border-[#DEE2DE] rounded-[15px] px-4 py-3.5">{content.sentence}</p>
          <input
            data-testid="review-input"
            value={text}
            disabled={answered}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCheck && !answered && submit()}
            placeholder={t("question.gapPlaceholder")}
            aria-label={t("question.gapPlaceholder")}
            className="mt-3 w-full min-h-[52px] rounded-[15px] border border-[#DEE2DE] bg-white px-4 text-[16px] text-[#222824] focus:outline-none focus:ring-2 focus:ring-[#173D31]"
          />
        </div>
      )}

      {content.type === "word_ordering" && (
        <div className="mt-5">
          <div data-testid="review-answer-area" className="min-h-[56px] rounded-[15px] border border-dashed border-[#6B736E]/40 bg-white px-3 py-2.5 flex flex-wrap gap-2 items-center">
            {picked.length === 0 && <span className="text-sm text-[#6B736E]">{t("question.orderPlaceholder")}</span>}
            {picked.map((p) => (
              <button
                key={p.i}
                type="button"
                disabled={answered}
                onClick={() => setPicked((prev) => prev.filter((x) => x.i !== p.i))}
                className={`min-h-[44px] px-3.5 rounded-xl bg-[#173D31] text-white text-[15px] ${focusRing}`}
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
                  type="button"
                  disabled={used || answered}
                  onClick={() => setPicked((prev) => [...prev, p])}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-[15px] transition-colors ${focusRing} ${
                    used ? "opacity-30 border-[#DEE2DE] bg-white" : "border-[#DEE2DE] bg-white hover:border-[#173D31]/40"
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
        <button type="button" data-testid="review-check-btn" disabled={!canCheck || busy} onClick={submit} className={`mt-8 w-full ${btnDark}`}>
          {t("question.check")}
        </button>
      )}
    </div>
  );
}

function Feedback({ result, busy, onRate, t }) {
  const ok = result.correct;
  return (
    <div className="mt-6" aria-live="polite">
      <div
        data-testid="review-feedback"
        data-correct={ok ? "true" : "false"}
        className={`rounded-2xl border p-4 ${ok ? "bg-[#EEF3EF] border-[#34785B]/30" : "bg-white border-[#C7654E]/35"}`}
      >
        <p className={`font-semibold text-[17px] flex items-center gap-2 ${ok ? "text-[#34785B]" : "text-[#A44F3B]"}`}>
          {ok ? <CircleCheck className="w-5 h-5" aria-hidden="true" /> : <CircleAlert className="w-5 h-5" aria-hidden="true" />}
          {ok ? t("review.correct") : t("review.notQuite")}
        </p>
        {!ok && result.correct_answer != null && (
          <div className="mt-3">
            <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{t("review.betterAnswer")}</p>
            <p data-testid="review-better-answer" className="mt-0.5 text-[16px] text-[#222824] font-medium">{result.correct_answer}</p>
          </div>
        )}
        {result.explanation && (
          <div className="mt-3">
            {!ok && <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{t("review.why")}</p>}
            <p className="mt-0.5 text-[15px] text-[#222824]/80 leading-relaxed">{result.explanation}</p>
          </div>
        )}
      </div>

      <p className="mt-6 text-[15px] font-semibold text-[#222824]">{t("practice.rateQuestion")}</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5" data-testid="review-ratings">
        {RATING_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            data-testid={`review-rate-${key}`}
            disabled={busy}
            onClick={() => onRate(key)}
            className={`min-h-[52px] rounded-[15px] font-semibold text-[16px] transition-colors disabled:opacity-40 ${focusRing} ${
              key === "good" ? "bg-[#173D31] text-white hover:bg-[#102E25]" : "border border-[#DEE2DE] bg-white text-[#222824] hover:bg-[#EEF3EF]"
            }`}
          >
            {t(`rate.${key}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
