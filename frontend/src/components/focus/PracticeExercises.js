// Dedicated-mode exercises (Listening/Speaking Practice). Same API calls and rules as the lesson components;
// kept separate so in-lesson steps stay visually unchanged.
import { useEffect, useRef, useState } from "react";
import { getText } from "@/lib/i18n";
import { submitListeningAttempt, submitSpeakingAttempt } from "@/lib/api";
import { ExerciseShell, AnswerOption, FeedbackPanel, PrimaryButton, focusRing } from "@/components/focus/FocusUI";
import { AudioPlayer, RecordingControl, SpeakingResult } from "@/components/focus/PracticeUI";
import { ArrowRight } from "lucide-react";

const MAX_SECONDS = 30;
const MIME_PREFS = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"];
function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_PREFS) { try { if (MediaRecorder.isTypeSupported(m)) return m; } catch {} }
  return "";
}

export function ListeningExercise({ item, ui, language, guestId, t, onAnswered, onContinue, continueLabel }) {
  const tx = (key) => getText(ui[key], language) || key;
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);

  useEffect(() => { setSelected(null); setResult(null); setBusy(false); setShowTranslation(false); }, [item.id]);

  const submit = async () => {
    if (selected === null || busy || result) return;
    setBusy(true);
    try {
      const r = await submitListeningAttempt(guestId, { listening_item_id: item.id, selected_index: selected });
      setResult(r);
      onAnswered?.(r);
    } finally {
      setBusy(false);
    }
  };
  const state = (i) => (!result ? null : i === result.correct_index ? "correct" : selected === i ? "incorrect" : "dim");

  return (
    <ExerciseShell
      testId="listening-question"
      instruction={tx("section_title")}
      prompt={item.prompt}
      feedback={result && (
        <div>
          <FeedbackPanel testId="listening-feedback" correct={result.correct} correctTitle={t("review.correct")} incorrectTitle={t("review.notQuite")}
            betterLabel={t("review.betterAnswer")} betterAnswer={item.options[result.correct_index]?.label} />
          <div className="mt-4">
            <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{t("practiceSession.guestSaid")}</p>
            <p data-testid="listening-transcript" lang="en" className="mt-1 text-[16px] text-[#222824] bg-white border border-[#DEE2DE] rounded-2xl px-4 py-3">“{result.reveal.transcript_en}”</p>
            {result.reveal.transcript_translation && (
              <>
                <button type="button" data-testid="listening-show-translation-btn" aria-pressed={showTranslation} onClick={() => setShowTranslation((v) => !v)}
                  className={`mt-1 min-h-[44px] text-[14px] font-semibold text-[#173D31] hover:underline ${focusRing}`}>
                  {tx("show_translation")}
                </button>
                {showTranslation && <p data-testid="listening-translation" className="text-[14px] text-[#6B736E]">{result.reveal.transcript_translation}</p>}
              </>
            )}
          </div>
          {result.reveal.model_response_en && (
            <div className="mt-3">
              <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{tx("best_response")}</p>
              <p data-testid="listening-model-response" lang="en" className="mt-1 text-[16px] text-[#222824] border-l-[3px] border-[#173D31] bg-white rounded-r-2xl px-4 py-3">“{result.reveal.model_response_en}”</p>
              {result.reveal.model_response_translation && <p className="mt-1 text-[14px] text-[#6B736E]">{result.reveal.model_response_translation}</p>}
            </div>
          )}
        </div>
      )}
      action={!result ? (
        <PrimaryButton testId="listening-check-btn" disabled={selected === null || busy} onClick={submit}>{t("question.check")}</PrimaryButton>
      ) : (
        <PrimaryButton testId="listening-continue-btn" onClick={onContinue}>{continueLabel} <ArrowRight className="w-4 h-4" aria-hidden="true" /></PrimaryButton>
      )}
    >
      <AudioPlayer src={item.audio_url} label={t("practiceSession.guestSpeaking")} autoPlay testId="listening-audio" t={t} />
      <div className="mt-5 space-y-2.5" role="radiogroup" aria-label={item.prompt}>
        {item.options.map((opt, i) => (
          <AnswerOption key={opt.slug} testId={`listening-option-${i}`} label={opt.label} selected={selected === i} state={state(i)} disabled={!!result} onSelect={() => setSelected(i)} />
        ))}
      </div>
    </ExerciseShell>
  );
}

async function micPermissionState() {
  try { return (await navigator.permissions?.query({ name: "microphone" }))?.state || null; } catch { return null; }
}

export function SpeakingExercise({ item, ui, language, guestId, t, onAnswered, onContinue, continueLabel }) {
  const tx = (key) => getText(ui[key], language) || key;
  const [phase, setPhase] = useState("idle"); // idle | recording | recorded | processing | result | mic_denied
  const [micState, setMicState] = useState(null);
  const [result, setResult] = useState(null);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [mime, setMime] = useState("audio/webm");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const submittingRef = useRef(false);

  function cleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") { try { recorderRef.current.stop(); } catch {} }
    if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
  }

  useEffect(() => {
    cleanup();
    setPhase("idle"); setResult(null); setBlob(null); setSeconds(0);
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") { try { rec.stop(); } catch {} }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const chosen = pickMime();
      setMime(chosen || "audio/webm");
      const rec = chosen ? new MediaRecorder(stream, { mimeType: chosen }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const b = new Blob(chunksRef.current, { type: chosen || rec.mimeType || "audio/webm" });
        setBlob(b);
        setBlobUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
        if (streamRef.current) { streamRef.current.getTracks().forEach((tr) => tr.stop()); streamRef.current = null; }
        setPhase("recorded");
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      setSeconds(0);
      rec.start();
      setPhase("recording");
      timerRef.current = setInterval(() => {
        const s = Math.floor((Date.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        if (s >= MAX_SECONDS) stopRecording();
      }, 250);
    } catch (e) {
      console.warn("microphone unavailable", e?.name);
      const perm = await micPermissionState();
      setMicState(perm === "denied" || (e?.name === "NotAllowedError" && perm !== "prompt") ? "blocked" : "needed");
      setPhase("mic_denied");
    }
  };

  const submit = async () => {
    if (!blob || blob.size === 0 || submittingRef.current) return;
    submittingRef.current = true;
    const elapsed = Date.now() - startedAtRef.current;
    setPhase("processing");
    try {
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
      const r = await submitSpeakingAttempt(guestId, { speaking_item_id: item.id, duration_ms: Math.max(elapsed, seconds * 1000), blob, filename: `response.${ext}` });
      setResult(r);
      onAnswered?.(r);
      setPhase("result");
    } catch (e) {
      console.warn("speaking submit failed", e?.response?.status);
      setPhase("recorded");
    } finally {
      submittingRef.current = false;
    }
  };

  const recordAgain = () => {
    setResult(null); setBlob(null); setSeconds(0);
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setPhase("idle");
  };

  return (
    <div data-testid="speaking-question">
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{t("practiceSession.guestSays")}</p>
      <p data-testid="speaking-prompt" lang="en" className="mt-2 text-[21px] leading-snug font-serif font-semibold text-[#222824]">“{item.prompt_transcript_en}”</p>
      {item.prompt_translation && <p className="mt-1 text-[14px] text-[#6B736E]">{item.prompt_translation}</p>}
      <div className="mt-4"><AudioPlayer src={item.audio_url} autoPlay testId="speaking-prompt-audio" t={t} /></div>
      <h2 className="mt-6 text-[17px] font-semibold text-[#222824]">{t("practiceSession.howRespond")}</h2>
      {phase !== "result" && (
        <RecordingControl phase={phase} seconds={seconds} maxSeconds={MAX_SECONDS} blobUrl={blobUrl} tooShort={seconds < 1} micState={micState} t={t}
          onRecord={startRecording} onStop={stopRecording} onSubmit={submit} onRerecord={recordAgain} />
      )}
      {phase === "result" && result && (
        <SpeakingResult result={result} ui={ui} tx={tx} t={t} onTryAgain={recordAgain} onContinue={onContinue} continueLabel={continueLabel} />
      )}
      {phase !== "result" && phase !== "recording" && phase !== "processing" && (
        <button type="button" data-testid="speaking-skip-continue-btn" onClick={onContinue}
          className={`mt-6 w-full min-h-[44px] text-[14px] font-medium text-[#6B736E] hover:text-[#173D31] ${focusRing}`}>
          {t("practiceSession.skip")}
        </button>
      )}
    </div>
  );
}
