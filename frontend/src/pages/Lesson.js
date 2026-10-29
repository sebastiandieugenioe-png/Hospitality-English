import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  RotateCw,
  CircleCheck,
  CircleX,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { getRecommendedSituations, getLesson, startAttempt, submitResponse, completeAttempt, getListeningMeta, getListeningItem, getSpeakingMeta, getSpeakingItem } from "@/lib/api";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { usePremium } from "@/components/PremiumGate";
import { Lock } from "lucide-react";
import { getLocalizedField, getText, getLocalizedOptions } from "@/lib/i18n";
import { ServiceNote } from "@/components/ServiceNote";
import { ListeningQuestion } from "@/components/ListeningQuestion";
import { SpeakingQuestion } from "@/components/SpeakingQuestion";
import { FocusLayout, PrimaryButton, SecondaryButton, TeachingBlock, PhraseBlock, DialogueExample, ExerciseShell, AnswerOption, FeedbackPanel, focusRing } from "@/components/focus/FocusUI";
import { canAccessSituation } from "@/lib/accessConfig";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

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

  // Reset lesson state when moving to another situation within the same route.
  useEffect(() => {
    setStepIdx(0); setScore({ correct: 0, total: 0 }); setAttemptId(null); setAttemptResult(null);
    recordedRef.current = false;
  }, [slug]);

  useEffect(() => {
    setLoading(true);
    const premium = billing.isPremium("hospitality");
    // Never show "locked" while access is unresolved; this effect re-runs once it resolves.
    const unresolved = billing.status === "loading" || billing.status === "uninitialized";
    let wait = false;
    getLesson(slug)
      .then((d) => {
        // Route-level freemium gate: non-free situation requires premium entitlement.
        if (d?.situation && d.situation.is_free === false && !premium) {
          if (unresolved) wait = true; else setData({ locked: true });
        } else {
          setData(d);
        }
      })
      .catch((e) => {
        if (e?.response?.status !== 403) setData(null);
        else if (unresolved) wait = true;
        else setData({ locked: true });
      })
      .finally(() => { if (!wait) setLoading(false); });
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
  const [confirmExit, setConfirmExit] = useState(false);
  const leave = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/learn"));
  const requestExit = () => (stepIdx > 0 && step !== "completion" ? setConfirmExit(true) : leave());
  useEffect(() => { window.scrollTo(0, 0); }, [stepIdx]);
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
      <FocusLayout onExit={leave} exitLabel={t("lesson.closeAria")}>
        <p className="text-[#6B736E]">{t("lesson.loading")}</p>
      </FocusLayout>
    );
  }

  if (data?.locked) {
    return (
      <FocusLayout onExit={leave} exitLabel={t("lesson.closeAria")}>
        <div className="text-center py-16" data-testid="lesson-locked">
          <span className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-brand-forest/10 text-brand-forest">
            <Lock className="w-8 h-8" />
          </span>
          <h1 className="mt-6 text-2xl font-serif text-brand-espresso">{t("lesson.lockedTitle")}</h1>
          <p className="mt-3 text-brand-charcoal/60 max-w-sm mx-auto">
            {t("lesson.lockedBody")}
          </p>
          <button
            data-testid="lesson-unlock-btn"
            onClick={() => requestPremium({ resume: () => { setLoading(true); getLesson(slug).then((d) => setData(d)).catch((e) => setData(e?.response?.status === 403 ? { locked: true } : null)).finally(() => setLoading(false)); } })}
            className="mt-8 inline-flex items-center gap-2 bg-brand-forest text-white rounded-lg px-6 py-3 font-medium hover:bg-brand-forest-hover transition-colors"
          >
            <Lock className="w-4 h-4" /> {t("lesson.lockedCta")}
          </button>
        </div>
      </FocusLayout>
    );
  }

  if (!data?.available) {
    return (
      <FocusLayout onExit={leave} exitLabel={t("lesson.closeAria")}>
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
      </FocusLayout>
    );
  }

  const lesson = data.lesson;
  const totalSteps = STEPS.length - 1;
  const stepLabel = step === "listening" && listeningMeta ? getText(listeningMeta.ui.section_title, language) : step === "speaking" && speakingMeta ? getText(speakingMeta.ui.section_title, language) : t(`lesson.step.${step}`);

  return (
    <FocusLayout onExit={requestExit} exitLabel={t("lesson.closeAria")} current={Math.min(stepIdx + 1, totalSteps)} total={totalSteps}
      progressLabel={t("lesson.progressAria", { step: stepLabel, n: Math.min(stepIdx + 1, totalSteps), total: totalSteps })}>
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent data-testid="lesson-exit-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("lesson.exitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("lesson.exitBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="lesson-exit-stay-btn">{t("lesson.exitStay")}</AlertDialogCancel>
            <AlertDialogAction data-testid="lesson-exit-confirm-btn" onClick={leave}>{t("lesson.exitLeave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
        >
          {step === "intro" && <Intro lesson={lesson} situation={data.situation} onNext={next} />}
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
    </FocusLayout>
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

const PrimaryBtn = ({ testId, ...props }) => <PrimaryButton testId={testId} {...props} />;

/* ---------- Step 1: Intro ---------- */
function Intro({ lesson, situation, onNext }) {
  const { t, language } = useApp();
  const intro = lesson.intro;
  const context = getLocalizedField(intro, "context", language);
  const guestOpening = getLocalizedField(intro, "guest_opening", language);
  const summary = getLocalizedField(intro, "summary", language);
  const objectives = getLocalizedField(intro, "objectives", language) || [];
  const title = getLocalizedField(situation, "title", language) || situation?.title_en;
  return (
    <div data-testid="lesson-intro">
      <TeachingBlock eyebrow={t("intro.eyebrow")} title={title} sub={context || summary}>
        {situation?.estimated_minutes && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-[#6B736E]">
            <Clock className="w-4 h-4" aria-hidden="true" /> {t("learn.minutes", { n: situation.estimated_minutes })}
          </p>
        )}
      </TeachingBlock>
      {intro.guest_opening_en && (
        <div className="mt-5">
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-2">{t("intro.guest")}</p>
          <PhraseBlock english={intro.guest_opening_en} translation={guestOpening} testId="intro-guest-opening" />
        </div>
      )}
      {context && summary && <p className="mt-5 text-[15px] text-[#222824] leading-relaxed">{summary}</p>}
      {objectives.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[15px] font-semibold text-[#222824]">{t("intro.objectivesTitle")}</h2>
          <ul className="mt-2 space-y-2">
            {objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[15px] text-[#222824] leading-snug">
                <Check className="w-4 h-4 mt-0.5 text-[#34785B] shrink-0" aria-hidden="true" /> {obj}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-8">
        <PrimaryBtn testId="intro-start-btn" onClick={onNext}>
          {t("intro.start")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
      <TeachingBlock title={t("phrases.title")} sub={t("phrases.sub")} />
      <div className="mt-5 space-y-3">
        {lesson.phrases.map((p) => (
          <PhraseBlock key={p.id} testId={`phrase-${p.id}`} english={p.english_content} translation={getText(p.translations, language)}>
            <ServiceNote item={p} />
          </PhraseBlock>
        ))}
      </div>
      <div className="mt-8 flex gap-3">
        <BackBtn onClick={onBack} />
        <PrimaryBtn testId="phrases-next-btn" onClick={onNext}>
          {t("common.continue")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </PrimaryBtn>
      </div>
    </div>
  );
}

/* ---------- Step 3: Dialogue ---------- */
function Dialogue({ lesson, situation, onNext, onBack }) {
  const { t, language } = useApp();
  const [showEs, setShowEs] = useState(true);
  // Anyone who is not the guest/customer is treated as staff (role-agnostic).
  const isStaffSpeaker = (speaker) => !["customer", "guest", "client"].includes(speaker);
  const subtitle = getLocalizedField(situation, "description", language) || t("dialogue.fallbackSub");
  const lines = lesson.dialogue.map((line) => ({
    isStaff: isStaffSpeaker(line.speaker),
    speaker: getLocalizedField(line, "speaker_label", language) || line.speaker_label_es,
    english: line.english,
    translation: showEs ? (getText(line.translations, language) ?? line.spanish) : null,
  }));
  return (
    <div>
      <TeachingBlock title={t("dialogue.title")} sub={subtitle} />
      <button type="button" data-testid="dialogue-toggle-translation" aria-pressed={showEs} onClick={() => setShowEs((v) => !v)}
        className={`mt-3 min-h-[44px] text-[14px] font-semibold text-[#173D31] hover:underline ${focusRing}`}>
        {showEs ? t("dialogue.hideTranslation") : t("dialogue.showTranslation")}
      </button>
      <div className="mt-3"><DialogueExample lines={lines} /></div>
      <div className="mt-8 flex gap-3">
        <BackBtn onClick={onBack} />
        <PrimaryBtn testId="dialogue-next-btn" onClick={onNext}>
          {t("common.continue")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
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
  const { t } = useApp();
  useEffect(() => { if (idx > 0) window.scrollTo(0, 0); }, [idx]);

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
      <p data-testid={`${testPrefix}-counter`} className="mb-4 text-[13px] font-medium text-[#6B736E] tabular-nums">{t("lesson.questionOf", { n: idx + 1, total: questions.length })}</p>
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

  const instruction = q.type === "multiple_choice" ? t("lesson.chooseBest") : q.type === "fill_gap" ? t("lesson.completePhrase") : t("lesson.buildSentence");
  const optionState = (i) => {
    if (!answered) return null;
    if (i === q.answer_index) return "correct";
    return selected === i ? "incorrect" : "dim";
  };
  const inputId = `${testId}-input`;

  return (
    <ExerciseShell
      testId={testId}
      instruction={instruction}
      prompt={prompt}
      feedback={answered && (
        <FeedbackPanel
          testId={`${testId}-feedback`}
          correct={isCorrect}
          correctTitle={t("review.correct")}
          incorrectTitle={t("review.notQuite")}
          betterLabel={t("review.betterAnswer")}
          betterAnswer={q.answer || options?.[q.answer_index]}
          whyLabel={t("review.why")}
          explanation={explanation}
        />
      )}
      action={!answered ? (
        <PrimaryBtn testId={`${testId}-check-btn`} disabled={!canCheck} onClick={evaluate}>{t("question.check")}</PrimaryBtn>
      ) : (
        <PrimaryBtn testId={`${testId}-continue-btn`} onClick={() => onContinue(isCorrect)}>
          {isLast ? finishLabel : t("common.continue")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </PrimaryBtn>
      )}
    >
      {q.type === "multiple_choice" && (
        <div className="space-y-2.5" role="radiogroup" aria-label={prompt}>
          {options.map((opt, i) => (
            <AnswerOption key={i} testId={`${testId}-option-${i}`} label={opt} selected={selected === i} state={optionState(i)} disabled={answered} onSelect={() => setSelected(i)} />
          ))}
        </div>
      )}

      {q.type === "fill_gap" && (
        <div>
          <p lang="en" className="text-[17px] text-[#222824] bg-white border border-[#DEE2DE] rounded-[15px] px-4 py-3.5">{q.sentence}</p>
          <label htmlFor={inputId} className="sr-only">{t("question.gapPlaceholder")}</label>
          <input
            id={inputId}
            data-testid={inputId}
            value={text}
            disabled={answered}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(e) => setText(e.target.value)}
            onFocus={(e) => setTimeout(() => e.target.scrollIntoView({ block: "center", behavior: "smooth" }), 250)}
            onKeyDown={(e) => e.key === "Enter" && canCheck && !answered && evaluate()}
            placeholder={t("question.gapPlaceholder")}
            className="mt-3 w-full min-h-[52px] rounded-[15px] border border-[#DEE2DE] bg-white px-4 text-[16px] text-[#222824] focus:outline-none focus:ring-2 focus:ring-[#173D31]"
          />
        </div>
      )}

      {q.type === "word_ordering" && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-2">{t("lesson.yourAnswer")}</p>
          <div data-testid={`${testId}-answer-area`} aria-live="polite"
            className="min-h-[60px] rounded-[15px] border border-dashed border-[#6B736E]/40 bg-white px-3 py-2.5 flex flex-wrap gap-2 items-center">
            {picked.length === 0 && <span className="text-[14px] text-[#6B736E]">{t("question.orderPlaceholder")}</span>}
            {picked.map((p) => (
              <button key={p.i} type="button" disabled={answered} aria-label={t("lesson.removeWord", { w: p.w })}
                onClick={() => setPicked((prev) => prev.filter((x) => x.i !== p.i))}
                className={`min-h-[44px] px-3.5 rounded-xl bg-[#173D31] text-white text-[16px] ${focusRing}`}>
                {p.w}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[11px] uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-2">{t("lesson.wordBank")}</p>
          <div className="flex flex-wrap gap-2">
            {shuffled.map((p) => {
              const used = picked.some((x) => x.i === p.i);
              return (
                <button key={p.i} type="button" disabled={used || answered} onClick={() => setPicked((prev) => [...prev, p])}
                  className={`min-h-[44px] px-3.5 rounded-xl border text-[16px] transition-colors ${focusRing} ${
                    used ? "opacity-30 border-[#DEE2DE] bg-white" : "border-[#DEE2DE] bg-white text-[#222824] hover:border-[#173D31]/40"}`}>
                  {p.w}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </ExerciseShell>
  );
}

/* ---------- Step 7: Completion ---------- */
function Completion({ result, score, situation, slug }) {
  const navigate = useNavigate();
  const { t, language, guestId, profile } = useApp();
  const billing = useBilling();
  const [nextSit, setNextSit] = useState(undefined);
  const title = getLocalizedField(situation, "title", language) || situation?.title_en || "";
  const scores = result?.scores;
  const overall = scores?.overall;
  const dims = [
    { key: "english", label: t("score.english") },
    { key: "comprehension", label: t("score.comprehension") },
    { key: "service", label: t("score.service") },
  ].filter((d) => scores && scores[d.key] != null);

  useEffect(() => {
    if (!guestId) { setNextSit(null); return; }
    const premium = billing.isPremium("hospitality");
    getRecommendedSituations(guestId, { limit: 5 })
      .then((recs) => setNextSit(recs.find((r) => r.slug !== slug && canAccessSituation({ professionId: "hospitality", role: profile?.role, situationSlug: r.slug, isPremium: premium })) || null))
      .catch(() => setNextSit(null));
  }, [guestId, slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="text-center pt-6" data-testid="lesson-completion">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-[#173D31] text-white">
        <CircleCheck className="w-8 h-8" aria-hidden="true" />
      </motion.div>
      <h1 className="mt-5 text-[28px] font-serif font-bold text-[#222824] tracking-tight">{t("lesson.situationComplete")}</h1>
      <p className="mt-1 text-[15px] text-[#6B736E]">{title}</p>

      <div className="mt-6 rounded-2xl bg-white border border-[#DEE2DE] p-5">
        {score.total > 0 && (
          <p data-testid="completion-quiz-correct" className="text-[17px] font-semibold text-[#222824]">
            {t("lesson.quizCorrect", { n: score.correct, total: score.total })}
          </p>
        )}
        {overall != null && (
          <p className="mt-1 text-[14px] text-[#6B736E]">
            {t("completion.score")}: <span data-testid="completion-score" className="font-semibold text-[#173D31]">{overall}%</span>
          </p>
        )}
        {dims.length > 0 && (
          <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[#DEE2DE] pt-4">
            {dims.map((d) => (
              <div key={d.key} data-testid={`score-${d.key}`}>
                <dd className="text-[19px] font-serif font-semibold text-[#222824]">{scores[d.key]}%</dd>
                <dt className="text-[12px] text-[#6B736E]">{d.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="mt-8 space-y-3">
        {nextSit ? (
          <PrimaryBtn testId="completion-continue-btn" onClick={() => navigate(`/lesson/${nextSit.slug}`, { replace: true })}>
            {t("review.continueLearning")} <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </PrimaryBtn>
        ) : (
          <PrimaryBtn testId="completion-back-learn-btn" disabled={nextSit === undefined} onClick={() => navigate("/learn")}>{t("lesson.backToLearn")}</PrimaryBtn>
        )}
        {nextSit && <SecondaryButton testId="completion-done-btn" onClick={() => navigate("/learn")}>{t("review.done")}</SecondaryButton>}
        <button type="button" data-testid="completion-retry-btn" onClick={() => navigate(0)}
          className={`inline-flex items-center gap-2 min-h-[44px] px-3 text-[14px] font-medium text-[#6B736E] hover:text-[#173D31] ${focusRing}`}>
          <RotateCw className="w-4 h-4" aria-hidden="true" /> {t("completion.retry")}
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
      className={`inline-flex items-center justify-center min-h-[52px] min-w-[52px] rounded-[15px] border border-[#DEE2DE] bg-white text-[#173D31] hover:bg-[#EEF3EF] transition-colors shrink-0 ${focusRing}`}
      aria-label={t("common.back")}
    >
      <ArrowLeft className="w-4 h-4" />
    </button>
  );
}
