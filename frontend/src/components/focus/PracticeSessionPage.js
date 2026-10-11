// Generic dedicated practice session: intro → N exercises in FocusLayout → completion. Pool is fixed at start (no mid-session paywall).
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { FocusLayout } from "@/components/focus/FocusUI";
import { SessionIntro, SessionCompletion } from "@/components/focus/PracticeUI";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function PracticeSessionPage({ kind, professionId = "hospitality", getMeta, getPool, Exercise, icon, introTitle, introSub, introMeta, introNotes, completionTitle, completionStat, isSuccess }) {
  const navigate = useNavigate();
  const { language, ensureGuest, loading, onboardingCompleted, t } = useApp();
  const billing = useBilling();
  const [meta, setMeta] = useState(null);
  const [items, setItems] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [success, setSuccess] = useState(0);
  const [phase, setPhase] = useState("loading"); // loading | intro | question | complete | error
  const [guestId, setGuestId] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);

  useEffect(() => {
    if (!loading && !onboardingCompleted) navigate("/onboarding", { replace: true });
  }, [loading, onboardingCompleted, navigate]);

  const loadPool = async (gid) => {
    const d = await getPool(gid, { free_only: !billing.isPremium(professionId) });
    setItems(d.items || []); setIdx(0); setAnswered(0); setSuccess(0);
    return d.items || [];
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const m = await getMeta();
        const gid = await ensureGuest();
        if (!active) return;
        setMeta(m); setGuestId(gid);
        const list = await loadPool(gid);
        if (active) setPhase(list.length ? "intro" : "complete");
      } catch (e) {
        console.warn(`${kind} session load failed`, e?.response?.status);
        if (active) setPhase("error");
      }
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ensureGuest, language]);

  useEffect(() => { window.scrollTo(0, 0); }, [idx, phase]);

  const leave = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate("/practice"));
  const requestExit = () => (phase === "question" && answered > 0 ? setConfirmExit(true) : leave());
  const onAnswered = (r) => { setAnswered((n) => n + 1); if (isSuccess(r)) setSuccess((n) => n + 1); };
  const goNext = () => (idx + 1 >= items.length ? setPhase("complete") : setIdx((i) => i + 1));
  const again = async () => { setPhase("loading"); const list = await loadPool(guestId); setPhase(list.length ? "question" : "complete"); };

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
        <Exercise item={items[idx]} ui={meta.ui} language={language} guestId={guestId} t={t} onAnswered={onAnswered} onContinue={goNext}
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
