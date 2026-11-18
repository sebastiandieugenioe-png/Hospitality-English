// Generic practice-session UI (profession-agnostic): AudioPlayer, RecordingControl, SpeakingResult, SessionIntro, SessionCompletion.
import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Mic, Square, Loader2, CircleCheck, CircleAlert, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { PrimaryButton, SecondaryButton, focusRing } from "@/components/focus/FocusUI";

const fmt = (s) => {
  if (!Number.isFinite(s) || s < 0) return null;
  const n = Math.round(s);
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};

// Custom player over a hidden <audio>. Replays are unlimited and never counted.
export function AudioPlayer({ src, label, autoPlay = false, testId = "audio", t, onError }) {
  const ref = useRef(null);
  const [state, setState] = useState("loading"); // loading | ready | playing | error
  const [duration, setDuration] = useState(null);

  useEffect(() => {
    setState("loading");
    setDuration(null);
    const a = ref.current;
    if (a) { a.pause(); a.currentTime = 0; if (autoPlay) a.play().catch(() => {}); }
  }, [src, autoPlay]);

  const toggle = () => {
    const a = ref.current;
    if (!a) return;
    if (state === "playing") { a.pause(); return; }
    if (a.ended) a.currentTime = 0;
    a.play().catch((e) => console.warn("audio play failed", e));
  };
  const replay = () => {
    const a = ref.current;
    if (!a) return;
    a.currentTime = 0;
    a.play().catch((e) => console.warn("audio play failed", e));
  };
  const retry = () => { setState("loading"); ref.current?.load(); };
  const playing = state === "playing";

  return (
    <div data-testid={`${testId}-player`} data-state={state} className="rounded-2xl bg-white border border-[#DEE2DE] p-5 text-center">
      <audio
        ref={ref}
        src={src}
        preload="auto"
        data-testid={testId}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setState((s) => (s === "playing" ? s : "ready")); }}
        onCanPlay={() => setState((s) => (s === "loading" ? "ready" : s))}
        onPlay={() => setState("playing")}
        onPause={() => setState((s) => (s === "error" ? s : "ready"))}
        onEnded={() => setState("ready")}
        onError={(e) => { console.warn("audio load error", e.currentTarget.error); setState("error"); onError?.(); }}
      />
      {label && <p className="text-[14px] text-[#6B736E]">{label}</p>}
      {state === "error" ? (
        <div role="alert" className="mt-3">
          <p className="text-[15px] text-[#A44F3B] flex items-center justify-center gap-2"><CircleAlert className="w-4 h-4" aria-hidden="true" /> {t("practiceSession.audioError")}</p>
          <button type="button" data-testid={`${testId}-retry-btn`} onClick={retry} className={`mt-3 min-h-[44px] px-5 rounded-[15px] border border-[#DEE2DE] text-[#173D31] font-semibold ${focusRing}`}>
            {t("common.retry")}
          </button>
        </div>
      ) : (
        <>
          <button type="button" data-testid={`${testId}-play-btn`} onClick={toggle} aria-label={playing ? t("practiceSession.pause") : t("practiceSession.play")}
            className={`mt-3 mx-auto grid place-items-center w-16 h-16 rounded-full bg-[#173D31] text-white hover:bg-[#102E25] transition-colors ${focusRing}`}>
            {state === "loading" ? <Loader2 className="w-6 h-6 animate-spin" aria-hidden="true" />
              : playing ? <Pause className="w-6 h-6" aria-hidden="true" /> : <Play className="w-6 h-6 translate-x-0.5" aria-hidden="true" />}
          </button>
          {fmt(duration) && <p className="mt-2 text-[13px] text-[#6B736E] tabular-nums" data-testid={`${testId}-duration`}>{fmt(duration)}</p>}
          <button type="button" data-testid={`${testId}-replay-btn`} onClick={replay}
            className={`mt-1 inline-flex items-center gap-1.5 min-h-[44px] px-3 text-[14px] font-semibold text-[#173D31] hover:underline ${focusRing}`}>
            <RotateCcw className="w-4 h-4" aria-hidden="true" /> {t("practiceSession.playAgain")}
          </button>
        </>
      )}
    </div>
  );
}

// Presentational recorder states; recording logic stays in the caller.
export function RecordingControl({ phase, seconds, maxSeconds, blobUrl, tooShort, micState, t, onRecord, onStop, onSubmit, onRerecord, submitDisabled = false }) {
  return (
    <div className="mt-6 rounded-2xl bg-white border border-[#DEE2DE] p-6 text-center" data-testid="recording-control" data-phase={phase}>
      {phase === "idle" && (
        <>
          <button type="button" data-testid="speaking-record-btn" onClick={onRecord} aria-label={t("practiceSession.tapToSpeak")}
            className={`mx-auto grid place-items-center w-20 h-20 rounded-full bg-[#173D31] text-white hover:bg-[#102E25] transition-colors ${focusRing}`}>
            <Mic className="w-8 h-8" aria-hidden="true" />
          </button>
          <p className="mt-3 text-[16px] font-semibold text-[#222824]">{t("practiceSession.tapToSpeak")}</p>
          <p className="text-[13px] text-[#6B736E]">{t("practiceSession.upTo", { n: maxSeconds })}</p>
        </>
      )}
      {phase === "recording" && (
        <>
          <p role="status" aria-live="polite" className="text-[15px] font-semibold text-[#A44F3B] flex items-center justify-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C7654E] animate-pulse" aria-hidden="true" /> {t("practiceSession.recording")}
          </p>
          <p data-testid="speaking-timer" className="mt-1 text-[28px] font-serif font-semibold text-[#222824] tabular-nums" aria-label={t("practiceSession.secondsAria", { n: seconds, max: maxSeconds })}>
            {fmt(seconds)} <span className="text-[15px] text-[#6B736E]">/ {fmt(maxSeconds)}</span>
          </p>
          <button type="button" data-testid="speaking-stop-btn" onClick={onStop} aria-label={t("practiceSession.stop")}
            className={`mt-3 mx-auto grid place-items-center w-16 h-16 rounded-full bg-[#C7654E] text-white hover:opacity-90 transition-opacity ${focusRing}`}>
            <Square className="w-6 h-6" aria-hidden="true" />
          </button>
          <p className="mt-2 text-[14px] text-[#6B736E]">{t("practiceSession.stop")}</p>
        </>
      )}
      {phase === "recorded" && blobUrl && (
        <div className="space-y-4 text-left">
          <p className="text-[16px] font-semibold text-[#222824] text-center">{t("practiceSession.ready")}</p>
          <AudioPlayer src={blobUrl} testId="speaking-playback" t={t} />
          {tooShort && <p data-testid="speaking-too-short" role="alert" className="text-[14px] text-[#A44F3B] text-center">{t("practiceSession.tooShort")}</p>}
          <PrimaryButton testId="speaking-submit-btn" disabled={tooShort || submitDisabled} onClick={onSubmit}>{t("practiceSession.submit")}</PrimaryButton>
          <SecondaryButton testId="speaking-retry-btn" onClick={onRerecord}><RotateCcw className="w-4 h-4" aria-hidden="true" /> {t("practiceSession.recordAgain")}</SecondaryButton>
        </div>
      )}
      {phase === "processing" && (
        <div data-testid="speaking-analyzing" role="status" aria-live="polite" className="py-4">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-[#173D31]" aria-hidden="true" />
          <p className="mt-3 text-[16px] font-semibold text-[#222824]">{t("practiceSession.checking")}</p>
          <p className="mt-1 text-[14px] text-[#6B736E]">{t("practiceSession.checkingSub")}</p>
        </div>
      )}
      {phase === "mic_denied" && (
        <div data-testid="speaking-mic-denied" data-mic={micState} role="alert" className="py-2">
          <p className="text-[16px] font-semibold text-[#222824]">{micState === "blocked" ? t("practiceSession.micBlocked") : t("practiceSession.micNeeded")}</p>
          {micState === "blocked" && <p className="mt-1 text-[14px] text-[#6B736E]">{t("practiceSession.micBlockedSub")}</p>}
          <PrimaryButton testId="speaking-mic-retry-btn" className="mt-4" onClick={onRecord}>
            {micState === "blocked" ? t("common.retry") : t("practiceSession.allowMic")}
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}

const LEVEL_KEY = { strong: "strong", partial: "partial" };
export function SpeakingResult({ result, ui, tx, t, onTryAgain, onContinue, continueLabel }) {
  const dims = [
    ["speaking-clear", "clear", result.understandable ? "strong" : "missed"],
    ["speaking-handled", "handled", result.situation_handled],
    ["speaking-professional", "professional", result.professional_service_english],
    ["speaking-grammar", "grammar_vocab", result.grammar_vocabulary],
    ["speaking-naturalness", "naturalness", result.naturalness],
  ];
  return (
    <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} data-testid="speaking-result" aria-labelledby="speaking-result-title" className="mt-6 space-y-5">
      <div className="rounded-2xl bg-white border border-[#DEE2DE] p-5">
        <h2 id="speaking-result-title" className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{t("practiceSession.thisResponse")}</h2>
        <p data-testid="speaking-overall" className="mt-1 text-[24px] font-serif font-semibold text-[#173D31]">{t(`practiceSession.overall.${result.overall || "needs_practice"}`)}</p>
        <dl className="mt-4 divide-y divide-[#DEE2DE] border-t border-[#DEE2DE]">
          {dims.map(([testId, key, v]) => (
            <div key={key} data-testid={testId} className="flex items-center justify-between gap-3 py-2.5">
              <dt className="text-[15px] text-[#222824]">{tx(key)}</dt>
              <dd className={`text-[14px] font-semibold flex items-center gap-1.5 ${v === "strong" ? "text-[#34785B]" : v === "partial" ? "text-[#173D31]" : "text-[#A44F3B]"}`}>
                {v === "strong" ? <CircleCheck className="w-4 h-4" aria-hidden="true" /> : v !== "partial" ? <CircleAlert className="w-4 h-4" aria-hidden="true" /> : null}
                {tx(LEVEL_KEY[v] || "needs_work")}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{tx("your_transcript")}</p>
        <p data-testid="speaking-transcript" lang="en" className="mt-1 text-[16px] text-[#222824] bg-white border border-[#DEE2DE] rounded-2xl px-4 py-3">“{result.transcript_en}”</p>
      </div>
      {result.improved_response_en && (
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{t("practiceSession.naturalAlternative")}</p>
          <p data-testid="speaking-improved" lang="en" className="mt-1 text-[16px] text-[#222824] border-l-[3px] border-[#173D31] bg-white rounded-r-2xl px-4 py-3">“{result.improved_response_en}”</p>
        </div>
      )}
      {result.model_response_en && (
        <div>
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{tx("model_response")}</p>
          <p data-testid="speaking-model-response" lang="en" className="mt-1 text-[16px] text-[#222824] bg-[#EEF3EF] rounded-2xl px-4 py-3">“{result.model_response_en}”</p>
        </div>
      )}
      <div className="space-y-3 pt-1">
        <PrimaryButton testId="speaking-continue-btn" onClick={onContinue}>{continueLabel} <ArrowRight className="w-4 h-4" aria-hidden="true" /></PrimaryButton>
        <SecondaryButton testId="speaking-record-again-btn" onClick={onTryAgain}><RotateCcw className="w-4 h-4" aria-hidden="true" /> {t("practiceSession.tryAgain")}</SecondaryButton>
      </div>
    </motion.section>
  );
}

export function SessionIntro({ icon: Icon, title, sub, meta, notes = [], t, onStart, testId }) {
  return (
    <div data-testid={testId} className="pt-4">
      <span className="grid place-items-center w-14 h-14 rounded-2xl bg-[#EEF3EF] text-[#173D31]"><Icon className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" /></span>
      <h1 className="mt-5 text-[30px] leading-tight font-serif font-bold text-[#222824] tracking-tight">{title}</h1>
      <p className="mt-1.5 text-[16px] text-[#6B736E]">{sub}</p>
      {meta && <p data-testid={`${testId}-meta`} className="mt-4 text-[15px] font-semibold text-[#173D31]">{meta}</p>}
      {notes.length > 0 && (
        <ul className="mt-5 space-y-2">
          {notes.map((n, i) => <li key={i} className="text-[14px] text-[#6B736E] leading-snug border-l-2 border-[#DEE2DE] pl-3">{n}</li>)}
        </ul>
      )}
      <div className="mt-8"><PrimaryButton testId={`${testId}-start-btn`} onClick={onStart}>{t("learn.start")} <ArrowRight className="w-4 h-4" aria-hidden="true" /></PrimaryButton></div>
    </div>
  );
}

export function SessionCompletion({ title, stat, sub, t, onDone, onAgain, testId }) {
  return (
    <div data-testid={testId} className="text-center pt-10">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="grid place-items-center w-16 h-16 mx-auto rounded-full bg-[#173D31] text-white"><CircleCheck className="w-8 h-8" aria-hidden="true" /></motion.div>
      <h1 className="mt-5 text-[28px] font-serif font-bold text-[#222824]">{title}</h1>
      <p data-testid={`${testId}-stat`} className="mt-2 text-[19px] font-semibold text-[#173D31]">{stat}</p>
      {sub && <p className="mt-1 text-[15px] text-[#6B736E]">{sub}</p>}
      <div className="mt-8 space-y-3">
        <PrimaryButton testId={`${testId}-done-btn`} onClick={onDone}>{t("review.done")}</PrimaryButton>
        {onAgain && <SecondaryButton testId={`${testId}-again-btn`} onClick={onAgain}>{t("practiceSession.again")}</SecondaryButton>}
      </div>
    </div>
  );
}
