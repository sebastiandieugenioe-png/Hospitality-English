import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  X,
  Check,
  RotateCw,
  CircleCheck,
  CircleX,
  Trophy,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { getLesson, startAttempt, submitResponse, completeAttempt, getListeningMeta, getListeningItem, getSpeakingMeta, getSpeakingItem } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { usePremium } from "@/components/PremiumGate";
import { Lock } from "lucide-react";
import { getLocalizedField, getText, getLocalizedOptions } from "@/lib/i18n";
import { ServiceNote } from "@/components/ServiceNote";
import { ListeningQuestion } from "@/components/ListeningQuestion";
import { SpeakingQuestion } from "@/components/SpeakingQuestion";

const STEPS = ["intro", "phrases", "dialogue", "flashcards", "listening", "speaking", "exercises", "quiz", "completion"];

export default function Lesson() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { logCompletion, ensureGuest, language, t } = useApp();
  const billing = useBilling();
  const { requestPremium } = usePremium();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stepIdx, setStepIdx] = useState(0);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [attemptId, setAttemptId] = useState(null);
  const [attemptResult, setAttemptResult] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [listeningMeta, setListeningMeta] = useState(null);
  const [listeningItem, setListeningItem] = useState(null);
  const [speakingMeta, setSpeakingMeta] = useState(null);
  const [speakingItem, setSpeakingItem] = useState(null);
  const recordedRef = useRef(false);

  useEffect(() => {
    setLoading(true);
    const premium = billing.isPremium("hospitality");
    getLesson(slug)
      .then((d) => {
        // Route-level freemium gate: non-free situation requires premium entitlement.
        if (d?.situation && d.situation.is_free === false && !premium) {
          setData({ locked: true });
        } else {
          setData(d);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, billing.status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!data?.available) return;
    (async () => {
      const gid = await ensureGuest();
      setGuestId(gid);
      try {
        const a = await startAttempt(gid, slug);
        setAttemptId(a.attempt_id);
      } catch (e) {
        console.error("startAttempt failed", e);
      }
    })();
  }, [data, slug, ensureGuest]);

  // Listening step content (pre-generated audio; answer-free, localized).
  useEffect(() => {
    if (!data?.available) return;
    let active = true;
    (async () => {
      try {
        const [m, it] = await Promise.all([
          listeningMeta ? Promise.resolve(listeningMeta) : getListeningMeta(),
          getListeningItem(slug, language),
        ]);
        if (!active) return;
        setListeningMeta(m);
        setListeningItem(it);
      } catch (e) {
        if (active) setListeningItem(null); // no item → step auto-skips
      }
    })();
    return () => { active = false; };
  }, [data, slug, language]); // eslint-disable-line

  // Speaking step content (reuses Listening prompt audio; optional in MVP).
  useEffect(() => {
    if (!data?.available) return;
    let active = true;
    (async () => {
      try {
        const [m, it] = await Promise.all([
          speakingMeta ? Promise.resolve(speakingMeta) : getSpeakingMeta(),
          getSpeakingItem(slug, language),
        ]);
        if (!active) return;
        setSpeakingMeta(m);
        setSpeakingItem(it);
      } catch (e) {
        if (active) setSpeakingItem(null); // no item → step auto-skips
      }
    })();
    return () => { active = false; };
  }, [data, slug, language]); // eslint-disable-line

  const sendResponse = async (question, section, submitted) => {
    if (!attemptId) return;
    try {
      await submitResponse(attemptId, { question_id: question.id, section, submitted_answer: submitted });
    } catch (e) {
      console.error("submitResponse failed", e);
    }
  };

  const step = STEPS[stepIdx];
  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const prev = () => setStepIdx((i) => Math.max(i - 1, 0));

  useEffect(() => {
    if (step === "completion" && !recordedRef.current && data?.lesson) {
      recordedRef.current = true;
      logCompletion(slug, score.correct, score.total);
    }
  }, [step, data, slug, score, logCompletion]);

  if (loading) {
    return (
      <Shell onClose={() => navigate(-1)} progress={0} label="">
        <p className="text-brand-charcoal/50">{t("lesson.loading")}</p>
      </Shell>
    );
  }

  if (data?.locked) {
    return (
      <Shell onClose={() => navigate("/home")} progress={0} label="">
        <div className="text-center py-16" data-testid="lesson-locked">
          <span className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-brand-forest/10 text-brand-forest">
            <Lock className="w-8 h-8" />
          </span>
          <h1 className="mt-6 text-2xl font-serif text-brand-espresso">Premium situation</h1>
          <p className="mt-3 text-brand-charcoal/60 max-w-sm mx-auto">
            Unlock all 25 situations for your role with Hospitality Premium.
          </p>
          <button
            data-testid="lesson-unlock-btn"
            onClick={() => requestPremium({ resume: () => { setLoading(true); getLesson(slug).then((d) => setData(d)).catch(() => {}).finally(() => setLoading(false)); } })}
            className="mt-8 inline-flex items-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3 font-medium hover:bg-brand-forest-hover transition-colors"
          >
            <Lock className="w-4 h-4" /> Unlock Premium
          </button>
        </div>
      </Shell>
    );
  }

  if (!data?.available) {
    return (
      <Shell onClose={() => navigate("/home")} progress={0} label="">
        <div className="text-center py-16">
          <h1 className="text-2xl font-serif text-brand-espresso">
            {t("lesson.soonTitle")}
          </h1>
          <p className="mt-3 text-brand-charcoal/60">
            {t("lesson.soonBody")}
          </p>
          <button
            data-testid="lesson-back-home-btn"
            onClick={() => navigate("/home")}
            className="mt-8 inline-flex items-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3 font-medium hover:bg-brand-forest-hover transition-colors"
          >
            {t("lesson.backHome")}
          </button>
        </div>
      </Shell>
    );
  }

  const lesson = data.lesson;
  const progress = (stepIdx / (STEPS.length - 1)) * 100;

  return (
    <Shell onClose={() => navigate("/home")} progress={progress} label={step === "listening" && listeningMeta ? getText(listeningMeta.ui.section_title, language) : step === "speaking" && speakingMeta ? getText(speakingMeta.ui.section_title, language) : t(`lesson.step.${step}`)}>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          {step === "intro" && <Intro lesson={lesson} onNext={next} />}
          {step === "phrases" && <Phrases lesson={lesson} onNext={next} onBack={prev} />}
          {step === "dialogue" && <Dialogue lesson={lesson} situation={data.situation} onNext={next} onBack={prev} />}
          {step === "flashcards" && <Flashcards lesson={lesson} onNext={next} />}
          {step === "listening" && (
            listeningItem && listeningMeta ? (
              <ListeningQuestion
                item={listeningItem}
                ui={listeningMeta.ui}
                language={language}
                guestId={guestId}
                onContinue={next}
                submitLabel={t("question.next")}
                continueLabel={t("question.next")}
              />
            ) : (
              <SkipListening onDone={next} failed={listeningItem === null} />
            )
          )}
          {step === "speaking" && (
            speakingItem && speakingMeta ? (
              <SpeakingQuestion
                item={speakingItem}
                ui={speakingMeta.ui}
                language={language}
                guestId={guestId}
                onContinue={next}
                continueLabel={t("question.next")}
              />
            ) : (
              <SkipListening onDone={next} failed={speakingItem === null} />
            )
          )}
          {step === "exercises" && <Exercises lesson={lesson} onNext={next} onSubmit={sendResponse} />}
          {step === "quiz" && (
            <Quiz
              lesson={lesson}
              onSubmit={sendResponse}
              onNext={async (correct, total) => {
                setScore({ correct, total });
                if (attemptId) {
                  try {
                    const res = await completeAttempt(attemptId);
                    setAttemptResult(res);
                  } catch (e) {
                    console.error("completeAttempt failed", e);
                  }
                }
                next();
              }}
            />
          )}
          {step === "completion" && (
            <Completion result={attemptResult} score={score} situation={data.situation} slug={slug} />
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}


// Edge-case safety: if a situation has no listening item (should not happen for the
// 50 active hospitality situations), auto-advance so the lesson never gets stuck.
function SkipListening({ onDone, failed }) {
  const { t } = useApp();
  useEffect(() => {
    if (failed) onDone();
  }, [failed, onDone]);
  return <p className="text-brand-charcoal/50">{t("lesson.loading")}</p>;
}

/* ---------- Layout ---------- */
function Shell({ children, onClose, progress, label }) {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button
            data-testid="lesson-close-btn"
            onClick={onClose}
            className="text-brand-charcoal/50 hover:text-brand-espresso transition-colors"
            aria-label={t("lesson.closeAria")}
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 h-1.5 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-brand-forest transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {label && (
            <span className="text-xs uppercase tracking-[0.15em] text-brand-charcoal/50 hidden sm:block">
              {label}
            </span>
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        {children}
      </main>
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

/* ---------- Step 1: Intro ---------- */
function Intro({ lesson, onNext }) {
  const { t, language } = useApp();
  const intro = lesson.intro;
  const contextEs = getLocalizedField(intro, "context", language);
  const guestOpeningEs = getLocalizedField(intro, "guest_opening", language);
  const summary = getLocalizedField(intro, "summary", language);
  const objectives = getLocalizedField(intro, "objectives", language) || [];
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand-terracotta mb-3">
        {t("intro.eyebrow")}
      </p>
      {/* Turn context (shift framing) */}
      {contextEs && (
        <div className="rounded-2xl bg-white border border-black/5 p-5 shadow-sm">
          <p className="text-brand-charcoal/70 leading-relaxed">{contextEs}</p>
          {intro.guest_opening_en && (
            <div className="mt-3 rounded-xl bg-brand-sand border border-black/5 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/40 mb-1">
                {t("intro.guest")}
              </p>
              <p className="text-lg text-brand-espresso font-medium">“{intro.guest_opening_en}”</p>
              {guestOpeningEs && (
                <p className="mt-0.5 text-sm text-brand-charcoal/60">{guestOpeningEs}</p>
              )}
            </div>
          )}
        </div>
      )}
      <p className="mt-6 text-base text-brand-charcoal/70 leading-relaxed">{summary}</p>
      <div className="mt-8 space-y-3">
        <p className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
          {t("intro.objectivesTitle")}
        </p>
        {objectives.map((obj, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl bg-white border border-black/5 p-4"
          >
            <span className="grid place-items-center w-6 h-6 rounded-full bg-brand-success-muted text-brand-forest text-sm font-semibold shrink-0">
              {i + 1}
            </span>
            <span className="text-brand-charcoal">{obj}</span>
          </div>
        ))}
      </div>
      <div className="mt-10">
        <PrimaryBtn testId="intro-start-btn" onClick={onNext}>
          {t("intro.start")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ---------- Step 2: Phrases ---------- */
function Phrases({ lesson, onNext, onBack }) {
  const { t, language } = useApp();
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight">
        {t("phrases.title")}
      </h2>
      <p className="mt-2 text-sm text-brand-charcoal/60">
        {t("phrases.sub")}
      </p>
      <div className="mt-6 space-y-3">
        {lesson.phrases.map((p) => (
          <div
            key={p.id}
            data-testid={`phrase-${p.id}`}
            className="rounded-xl bg-white border border-black/5 p-5 shadow-sm"
          >
            <p className="text-lg text-brand-espresso font-medium">{p.english_content}</p>
            <p className="mt-1 text-sm text-brand-charcoal/60">{getText(p.translations, language)}</p>
            <ServiceNote item={p} />
          </div>
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        <BackBtn onClick={onBack} />
        <PrimaryBtn testId="phrases-next-btn" onClick={onNext}>
          {t("common.continue")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ---------- Step 3: Dialogue ---------- */
function Dialogue({ lesson, situation, onNext, onBack }) {
  const { t, language } = useApp();
  const [showEs, setShowEs] = useState(true);
  // Anyone who is not the guest/customer is treated as staff (future-proof for
  // waiter, bartender, host, barista… without hardcoding each role).
  const isStaffSpeaker = (speaker) => !["customer", "guest", "client"].includes(speaker);
  const subtitle = getLocalizedField(situation, "description", language) || t("dialogue.fallbackSub");
  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight">
          {t("dialogue.title")}
        </h2>
        <button
          data-testid="dialogue-toggle-translation"
          onClick={() => setShowEs((v) => !v)}
          className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
        >
          {showEs ? t("dialogue.hideTranslation") : t("dialogue.showTranslation")}
        </button>
      </div>
      <p className="mt-2 text-sm text-brand-charcoal/60">
        {subtitle}
      </p>
      <div className="mt-6 space-y-4">
        {lesson.dialogue.map((line, i) => {
          const isWaiter = isStaffSpeaker(line.speaker);
          const translation = getText(line.translations, language) ?? line.spanish;
          return (
            <div
              key={i}
              className={`flex ${isWaiter ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-3 ${
                  isWaiter
                    ? "bg-brand-forest text-white rounded-br-sm"
                    : "bg-white border border-black/5 text-brand-espresso rounded-bl-sm shadow-sm"
                }`}
              >
                <p
                  className={`text-[10px] uppercase tracking-[0.15em] mb-1 ${
                    isWaiter ? "text-white/60" : "text-brand-charcoal/40"
                  }`}
                >
                  {getLocalizedField(line, "speaker_label", language) || line.speaker_label_es}
                </p>
                <p className="text-base font-medium">{line.english}</p>
                {showEs && (
                  <p
                    className={`mt-1 text-sm ${
                      isWaiter ? "text-white/70" : "text-brand-charcoal/60"
                    }`}
                  >
                    {translation}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-10 flex gap-3">
        <BackBtn onClick={onBack} />
        <PrimaryBtn testId="dialogue-next-btn" onClick={onNext}>
          {t("common.continue")} <ArrowRight className="w-4 h-4" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ---------- Step 4: Flashcards ---------- */
function Flashcards({ lesson, onNext }) {
  const { logFlashcard, t, language } = useApp();
  const langCode = language.toUpperCase();
  const cards = useMemo(
    () =>
      lesson.phrases
        // Negative pedagogical examples (inappropriate service) stay in Phrases with
        // their ServiceNote, but must never become a flashcard to memorize.
        .filter((p) => p.service_rating !== "inappropriate")
        .map((p, i) => {
        const enToEs = i % 2 === 0;
        const translated = getText(p.translations, language);
        return {
          id: p.id,
          direction: enToEs ? `EN → ${langCode}` : `${langCode} → EN`,
          front: enToEs ? p.english_content : translated,
          back: enToEs ? translated : p.english_content,
        };
      }),
    [lesson, language, langCode]
  );

  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];

  const answer = (knew) => {
    logFlashcard(card.id, knew);
    if (idx + 1 >= cards.length) {
      onNext();
    } else {
      setIdx((i) => i + 1);
      setFlipped(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight">
          {t("flashcards.title")}
        </h2>
        <span className="text-sm text-brand-charcoal/50 tabular-nums">
          {idx + 1} / {cards.length}
        </span>
      </div>
      <p className="mt-2 text-sm text-brand-charcoal/60">
        {t("flashcards.sub")}
      </p>

      <div className="mt-8 flashcard-perspective">
        <button
          data-testid="flashcard"
          onClick={() => setFlipped((f) => !f)}
          className="relative block w-full h-64 sm:h-72 text-left"
          aria-label={t("lesson.flipCardAria")}
        >
          <motion.div
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            style={{ transformStyle: "preserve-3d" }}
            className="relative w-full h-full"
          >
            <div className="flashcard-face absolute inset-0 rounded-2xl bg-white border border-black/5 shadow-sm flex flex-col items-center justify-center p-8 text-center">
              <span className="absolute top-4 left-5 text-[10px] uppercase tracking-[0.2em] text-brand-charcoal/40">
                {card.direction}
              </span>
              <p className="text-2xl sm:text-3xl font-serif text-brand-espresso">
                {card.front}
              </p>
              <span className="absolute bottom-4 flex items-center gap-1 text-xs text-brand-charcoal/40">
                <RotateCw className="w-3 h-3" /> {t("flashcards.reveal")}
              </span>
            </div>
            <div
              className="flashcard-face absolute inset-0 rounded-2xl bg-brand-forest text-white shadow-sm flex items-center justify-center p-8 text-center"
              style={{ transform: "rotateY(180deg)" }}
            >
              <p className="text-2xl sm:text-3xl font-serif" data-testid="flashcard-back">
                {card.back}
              </p>
            </div>
          </motion.div>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3">
        <button
          data-testid="flashcard-didnt-know"
          onClick={() => answer(false)}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-4 font-medium border border-brand-terracotta/30 text-brand-terracotta hover:bg-brand-terracotta/5 transition-colors"
        >
          <CircleX className="w-4 h-4" /> {t("flashcards.didntKnow")}
        </button>
        <button
          data-testid="flashcard-knew"
          onClick={() => answer(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-4 font-medium bg-brand-forest text-white hover:bg-brand-forest-hover transition-colors"
        >
          <CircleCheck className="w-4 h-4" /> {t("flashcards.knew")}
        </button>
      </div>
    </div>
  );
}

/* ---------- Steps 5 & 6: Exercises / Quiz (shared question flow) ---------- */
function Exercises({ lesson, onNext, onSubmit }) {
  const { t } = useApp();
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight mb-2">
        {t("exercises.title")}
      </h2>
      <p className="text-sm text-brand-charcoal/60 mb-6">
        {t("exercises.sub")}
      </p>
      <QuestionFlow
        questions={lesson.exercises}
        section="exercise"
        onSubmit={onSubmit}
        testPrefix="exercise"
        finishLabel={t("exercises.toQuiz")}
        onComplete={() => onNext()}
      />
    </div>
  );
}

function Quiz({ lesson, onNext, onSubmit }) {
  const { t } = useApp();
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl font-serif text-brand-espresso tracking-tight mb-2">
        {t("quiz.title")}
      </h2>
      <p className="text-sm text-brand-charcoal/60 mb-6">
        {t("quiz.sub", { n: lesson.quiz.length })}
      </p>
      <QuestionFlow
        questions={lesson.quiz}
        section="quiz"
        onSubmit={onSubmit}
        testPrefix="quiz"
        finishLabel={t("quiz.result")}
        onComplete={(correct) => onNext(correct, lesson.quiz.length)}
      />
    </div>
  );
}

function QuestionFlow({ questions, onComplete, finishLabel, testPrefix, section, onSubmit }) {
  const [idx, setIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const isLast = idx + 1 >= questions.length;

  const handleNext = (wasCorrect) => {
    const newCount = correctCount + (wasCorrect ? 1 : 0);
    setCorrectCount(newCount);
    if (isLast) {
      onComplete(newCount);
    } else {
      setIdx((i) => i + 1);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full ${
              i <= idx ? "bg-brand-forest" : "bg-black/5"
            }`}
          />
        ))}
      </div>
      <QuestionCard
        key={idx}
        q={questions[idx]}
        section={section}
        onSubmit={onSubmit}
        testId={`${testPrefix}-${idx}`}
        isLast={isLast}
        finishLabel={finishLabel}
        onContinue={handleNext}
      />
    </div>
  );
}

function QuestionCard({ q, onContinue, isLast, finishLabel, testId, section, onSubmit }) {
  const { t, language } = useApp();
  const [answered, setAnswered] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const options = getLocalizedOptions(q, language);
  const prompt = getLocalizedField(q, "prompt", language);
  const explanation = getLocalizedField(q, "explanation", language);

  // multiple choice
  const [selected, setSelected] = useState(null);
  // fill gap
  const [text, setText] = useState("");
  // word ordering
  const shuffled = useMemo(() => {
    if (q.type !== "word_ordering") return [];
    return q.words
      .map((w, i) => ({ w, i }))
      .sort(() => Math.random() - 0.5);
  }, [q]);
  const [picked, setPicked] = useState([]);

  const evaluate = () => {
    let ok = false;
    let submitted = null;
    if (q.type === "multiple_choice") {
      ok = selected === q.answer_index;
      submitted = selected;
    } else if (q.type === "fill_gap") {
      ok = text.trim().toLowerCase() === q.answer.toLowerCase();
      submitted = text;
    } else if (q.type === "word_ordering") {
      const norm = (s) =>
        s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
      const built = picked.map((p) => p.w).join(" ");
      ok = norm(built) === norm(q.answer);
      submitted = built;
    }
    setIsCorrect(ok);
    setAnswered(true);
    if (onSubmit) onSubmit(q, section, submitted);
  };

  const canCheck =
    (q.type === "multiple_choice" && selected !== null) ||
    (q.type === "fill_gap" && text.trim().length > 0) ||
    (q.type === "word_ordering" && picked.length === q.words.length);

  return (
    <div data-testid={testId}>
      <p className="text-lg text-brand-espresso font-medium">{prompt}</p>

      {/* Multiple choice */}
      {q.type === "multiple_choice" && (
        <div className="mt-5 space-y-3">
          {options.map((opt, i) => {
            const chosen = selected === i;
            let cls = "border-black/5 bg-white hover:border-brand-forest/30";
            if (answered) {
              if (i === q.answer_index) cls = "border-brand-forest bg-brand-success-muted";
              else if (chosen) cls = "border-brand-terracotta bg-brand-terracotta/5";
              else cls = "border-black/5 bg-white opacity-60";
            } else if (chosen) {
              cls = "border-brand-forest bg-brand-success-muted";
            }
            return (
              <button
                key={i}
                data-testid={`${testId}-option-${i}`}
                disabled={answered}
                onClick={() => setSelected(i)}
                className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${cls}`}
              >
                <span className="text-brand-charcoal">{opt}</span>
                {answered && i === q.answer_index && (
                  <Check className="w-5 h-5 text-brand-forest" />
                )}
                {answered && chosen && i !== q.answer_index && (
                  <X className="w-5 h-5 text-brand-terracotta" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Fill the gap */}
      {q.type === "fill_gap" && (
        <div className="mt-5">
          <p className="text-lg text-brand-espresso bg-white border border-black/5 rounded-xl px-5 py-4">
            {q.sentence}
          </p>
          <input
            data-testid={`${testId}-input`}
            value={text}
            disabled={answered}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canCheck && !answered && evaluate()}
            placeholder={t("question.gapPlaceholder")}
            className="mt-3 w-full rounded-xl border border-black/10 bg-white px-5 py-4 text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-forest"
          />
        </div>
      )}

      {/* Word ordering */}
      {q.type === "word_ordering" && (
        <div className="mt-5">
          <div
            data-testid={`${testId}-answer-area`}
            className="min-h-[56px] rounded-xl border border-dashed border-black/15 bg-white px-4 py-3 flex flex-wrap gap-2 items-center"
          >
            {picked.length === 0 && (
              <span className="text-sm text-brand-charcoal/40">
                {t("question.orderPlaceholder")}
              </span>
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
                    used
                      ? "opacity-30 border-black/5 bg-white"
                      : "border-black/10 bg-white hover:border-brand-forest/40"
                  }`}
                >
                  {p.w}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback */}
      {answered && (
        <div
          data-testid={`${testId}-feedback`}
          className={`mt-6 rounded-xl p-4 ${
            isCorrect
              ? "bg-brand-success-muted text-brand-forest"
              : "bg-brand-terracotta/10 text-brand-terracotta-hover"
          }`}
        >
          <p className="font-semibold flex items-center gap-2">
            {isCorrect ? <CircleCheck className="w-5 h-5" /> : <CircleX className="w-5 h-5" />}
            {isCorrect ? t("question.correct") : t("question.incorrect")}
          </p>
          {!isCorrect && (
            <p className="mt-1 text-sm text-brand-charcoal/70">
              {t("question.correctAnswer")} <span className="font-medium">{q.answer || options?.[q.answer_index]}</span>
            </p>
          )}
          <p className="mt-1 text-sm text-brand-charcoal/70">{explanation}</p>
        </div>
      )}

      <div className="mt-8">
        {!answered ? (
          <PrimaryBtn testId={`${testId}-check-btn`} disabled={!canCheck} onClick={evaluate}>
            {t("question.check")}
          </PrimaryBtn>
        ) : (
          <PrimaryBtn testId={`${testId}-continue-btn`} onClick={() => onContinue(isCorrect)}>
            {isLast ? finishLabel : t("question.next")} <ArrowRight className="w-4 h-4" />
          </PrimaryBtn>
        )}
      </div>
    </div>
  );
}

/* ---------- Step 7: Completion ---------- */
function Completion({ result, score, situation, slug }) {
  const navigate = useNavigate();
  const { t, language } = useApp();
  const title = getLocalizedField(situation, "title", language) || situation?.title_en || "";
  const scores = result?.scores;
  const overall = scores?.overall ?? Math.round((score.correct / (score.total || 1)) * 100);
  const mastered = result?.met_mastery_threshold ?? result?.mastered;
  const dims = [
    { key: "english", label: t("score.english") },
    { key: "comprehension", label: t("score.comprehension") },
    { key: "service", label: t("score.service") },
  ].filter((d) => scores && scores[d.key] != null);

  return (
    <div className="text-center py-6">
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="grid place-items-center w-20 h-20 mx-auto rounded-full bg-brand-forest text-white"
      >
        <Trophy className="w-9 h-9" />
      </motion.div>
      <h1 className="mt-6 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
        {t("completion.title")}
      </h1>
      <p className="mt-2 text-brand-charcoal/60">{title}</p>

      <div className="mt-8 rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
        <p className="text-5xl font-serif text-brand-forest" data-testid="completion-score">
          {overall}%
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.15em] text-brand-charcoal/50">
          {t("completion.score")}
        </p>
        {dims.length > 0 && (
          <div className="mt-5 grid grid-cols-3 gap-3">
            {dims.map((d) => (
              <div key={d.key} data-testid={`score-${d.key}`}>
                <p className="text-2xl font-serif text-brand-espresso">{scores[d.key]}%</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-brand-charcoal/45">
                  {d.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <p
        data-testid="mastery-message"
        className={`mt-6 font-medium ${mastered ? "text-brand-forest" : "text-brand-charcoal/70"}`}
      >
        {mastered ? t("completion.mastered") : t("completion.goodPractice")}
      </p>

      <div className="mt-8 space-y-3">
        <PrimaryBtn
          testId="completion-retry-btn"
          onClick={() => navigate(0)}
        >
          <RotateCw className="w-4 h-4" /> {t("completion.retry")}
        </PrimaryBtn>
        <button
          data-testid="completion-skill-btn"
          onClick={() => navigate(situation?.primary_skill ? `/skill/${situation.primary_skill}` : "/learn")}
          className="inline-flex items-center justify-center gap-2 w-full bg-white text-brand-forest border border-brand-forest/20 hover:bg-brand-sand transition-colors rounded-lg px-6 py-4 font-medium"
        >
          <BookOpen className="w-4 h-4" /> {t("completion.backSkill")}
        </button>
        <button
          data-testid="completion-progress-btn"
          onClick={() => navigate("/progress")}
          className="text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest transition-colors"
        >
          {t("completion.viewProgress")}
        </button>
      </div>
    </div>
  );
}

/* ---------- shared ---------- */
function BackBtn({ onClick }) {
  const { t } = useApp();
  return (
    <button
      data-testid="lesson-back-btn"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest border border-brand-forest/20 hover:bg-brand-sand transition-colors rounded-lg px-5 py-4 font-medium shrink-0"
      aria-label={t("common.back")}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
