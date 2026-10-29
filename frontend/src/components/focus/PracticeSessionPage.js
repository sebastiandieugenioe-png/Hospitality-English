// Generic dedicated practice session: intro → N exercises in FocusLayout → completion. Pool is fixed at start (no mid-session paywall).
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { FocusLayout } from "@/components/focus/FocusUI";
import { SessionIntro, SessionCompletion } from "@/components/focus/PracticeUI";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function PracticeSessionPage({ kind, professionId = "hospitality", getMeta, getPool, Exercise, icon, introTitle, introSub, introMeta, introNotes, completionTitle, completionStat, isSuccess }) {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t, account, authReady } = useApp();
  const billing = useBilling();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [success, setSuccess] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | intro | question | complete | error
  const [guestId, setGuestId] = useState(null);
  const [sessionLang, setSessionLang] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [sessionSeq, setSessionSeq] = useState(0); // bumped only by "practice again"
  // Resolved = auth settled + billing ready/error (error keeps free access) for the CURRENT identity.
  const accessResolved = authReady && (billing.status === "ready" || billing.status === "error")
    && billing.resolvedFor === (account?.id || null);
  const createdSeqRef = useRef(-1);
  const reqRef = useRef(0);
  const latestRef = useRef(null);
  latestRef.current = { billing, language };

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  // Create each session exactly once (StrictMode/re-render safe). Access + language are
  // snapshotted at creation; later entitlement/language changes only affect the next session.
  useEffect(() => {
    if (!accessResolved || createdSeqRef.current === sessionSeq) return;
    createdSeqRef.current = sessionSeq;
    const id = ++reqRef.current;
    const { billing: b, language: lang } = latestRef.current;
    const freeOnly = !b.isPremium(professionId);
    (async () => {
      try {
        const m = await getMeta();
        const gid = await ensureGuest();
        const d = await getPool(gid, { free_only: freeOnly });
        if (id !== reqRef.current) return;
        const list = d.items || [];
        setMeta(m); setGuestId(gid); setSessionLang(lang);
        setItems(list); setIdx(0); setAnswered(0); setSuccess(0);
        setPhase(list.length ? (sessionSeq > 0 ? "question" : "intro") : "complete");
      } catch (e) {
        if (id !== reqRef.current) return;
        console.warn(`${kind} session load failed`, e?.response?.status);
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessResolved, sessionSeq]);

  useEffect(() => { window.scrollTo(0, 0); }, [idx, phase]);

  const leave = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/practice"));
  const requestExit = () => (phase === "question" && answered > 0 ? setConfirmExit(true) : leave());
  const onAnswered = (r) => { setAnswered((n) => n + 1); if (isSuccess(r)) setSuccess((n) => n + 1); };
  const goNext = () => (idx + 1 >= items.length ? setPhase("complete") : setIdx((i) => i + 1));
  const again = () => { setPhase("loading"); setSessionSeq((n) => n + 1); };

  const total = items.length;
  const inQuestion = phase === "question";
  const exitLabel = t("practiceSession.closeAria");

  let body;
  if (phase === "loading" || (!meta && phase !== "error")) body = <p className="text-[#6B736E]">{t("common.loading")}</p>;
  else if (phase === "error") body = <p data-testid={`${kind}-error`} role="alert" className="text-[#6B736E]">{t("practice.errorBody")}</p>;
  else if (phase === "intro") body = (
    <SessionIntro testId={`${kind}-intro`} icon={icon} title={introTitle(meta)} sub={introSub} meta={introMeta(total)} notes={introNotes} t={t} onStart={() => setPhase("question")} />
  );
  else if (phase === "complete") body = (
    <SessionCompletion testId={`${kind}-complete`} title={completionTitle} stat={completionStat({ answered, success, total })} t={t}
      onDone={() => navigate("/practice")} onAgain={total ? again : null} />
  );
  else body = (
    <AnimatePresence mode="wait">
      <motion.div key={items[idx].id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
        <Exercise item={items[idx]} ui={meta.ui} language={sessionLang || language} guestId={guestId} t={t} onAnswered={onAnswered} onContinue={goNext}
          continueLabel={idx + 1 >= total ? t("practiceSession.finish") : t("common.continue")} />
      </motion.div>
    </AnimatePresence>
  );

  return (
    <FocusLayout onExit={requestExit} exitLabel={exitLabel} current={inQuestion ? idx + 1 : undefined} total={inQuestion ? total : undefined}
      progressLabel={t("review.progressAria", { i: idx + 1, n: total })}>
      <AlertDialog open={confirmExit} onOpenChange={setConfirmExit}>
        <AlertDialogContent data-testid={`${kind}-exit-dialog`}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("practiceSession.exitTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("practiceSession.exitBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`${kind}-exit-stay-btn`}>{t("lesson.exitStay")}</AlertDialogCancel>
            <AlertDialogAction data-testid={`${kind}-exit-confirm-btn`} onClick={leave}>{t("lesson.exitLeave")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {body}
    </FocusLayout>
  );
}
