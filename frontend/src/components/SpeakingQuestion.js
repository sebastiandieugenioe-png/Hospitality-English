import { useEffect, useRef, useState } from "react";
import { Play, Mic, Square, RotateCw, ArrowRight, Check, Loader2 } from "lucide-react";
import { getText } from "@/lib/i18n";
import { submitSpeakingAttempt } from "@/lib/api";

const MIME_PREFS = ["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"];

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of MIME_PREFS) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {}
  }
  return "";
}

// Open-ended speaking practice for one situation.
// Mic permission is requested ONLY when the user taps Record. Max 30s, min 1s.
// Raw audio is sent to the backend only on submit and never stored.
export function SpeakingQuestion({ item, ui, language, guestId, onAnswered, onContinue, continueLabel }) {
  const tx = (key) => getText(ui[key], language) || key;
  const [phase, setPhase] = useState("idle"); // idle | recording | recorded | processing | result | mic_denied
  const [result, setResult] = useState(null);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [mime, setMime] = useState("audio/webm");
  const [seconds, setSeconds] = useState(0);
  const [submitError, setSubmitError] = useState(null); // null | "daily_limit" | "send_failed"
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const startedAtRef = useRef(0);
  const timerRef = useRef(null);
  const promptAudioRef = useRef(null);

  useEffect(() => {
    // reset for a new item
    cleanup();
    setPhase("idle");
    setResult(null);
    setSubmitError((e) => (e === "daily_limit" ? e : null)); // the daily limit stays until reload
    setBlob(null);
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setSeconds(0);
    const a = promptAudioRef.current;
    if (a) { a.pause(); a.currentTime = 0; a.play().catch(() => {}); }
    return cleanup;
    // eslint-disable-next-line
  }, [item.id]);

  function cleanup() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  const playPrompt = () => {
    const a = promptAudioRef.current;
    if (a) { a.currentTime = 0; a.play().catch(() => {}); }
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
        const type = chosen || rec.mimeType || "audio/webm";
        const b = new Blob(chunksRef.current, { type });
        setBlob(b);
        setBlobUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(b); });
        if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
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
        if (s >= 30) stopRecording();
      }, 250);
    } catch (e) {
      setPhase("mic_denied");
    }
  };

  const stopRecording = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") {
      try { rec.stop(); } catch {}
    }
  };

  const submit = async () => {
    const elapsed = Date.now() - startedAtRef.current;
    if (!blob || blob.size === 0) return;
    setPhase("processing");
    setSubmitError(null);
    try {
      const ext = mime.includes("mp4") ? "mp4" : mime.includes("mpeg") ? "mp3" : mime.includes("wav") ? "wav" : "webm";
      const r = await submitSpeakingAttempt(guestId, {
        speaking_item_id: item.id,
        duration_ms: Math.max(elapsed, seconds * 1000),
        blob,
        filename: `response.${ext}`,
      });
      setResult(r);
      if (onAnswered) onAnswered(r);
      setPhase("result");
    } catch (e) {
      const status = e?.response?.status;
      setSubmitError(status === 429 ? "daily_limit" : "send_failed");
      setPhase("recorded"); // allow retry on failure
    }
  };

  const recordAgain = () => {
    setResult(null);
    setSubmitError((e) => (e === "daily_limit" ? e : null));
    setBlob(null);
    setBlobUrl((u) => { if (u) URL.revokeObjectURL(u); return null; });
    setSeconds(0);
    setPhase("idle");
  };

  return (
    <div data-testid="speaking-question">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
        <Mic className="w-4 h-4" /> {tx("section_title")}
      </p>
      <h2 className="mt-2 text-xl sm:text-2xl font-serif text-brand-espresso leading-snug">{tx("listen_then_respond")}</h2>

      {/* Prompt audio (reuses the Listening clip) + transcript */}
      <audio ref={promptAudioRef} src={item.audio_url} preload="auto" data-testid="speaking-prompt-audio" />
      <div className="mt-4 flex items-center gap-3">
        <button
          data-testid="speaking-play-prompt-btn"
          onClick={playPrompt}
          className="inline-flex items-center gap-2 rounded-full border border-brand-forest/30 text-brand-forest px-5 py-2.5 font-medium hover:bg-brand-forest/5 transition-colors"
        >
          <Play className="w-4 h-4" /> {item.prompt_transcript_en}
        </button>
      </div>
      {item.prompt_translation && (
        <p className="mt-1 text-sm text-brand-charcoal/60 italic">{item.prompt_translation}</p>
      )}

      {/* Recorder */}
      {phase !== "result" && (
        <div className="mt-8 flex flex-col items-center gap-4">
          {phase === "idle" && (
            <button
              data-testid="speaking-record-btn"
              onClick={startRecording}
              className="inline-flex items-center gap-2 rounded-full bg-brand-forest text-white px-8 py-4 font-medium hover:bg-brand-forest-hover transition-colors"
            >
              <Mic className="w-5 h-5" /> {tx("record")}
            </button>
          )}

          {phase === "recording" && (
            <button
              data-testid="speaking-stop-btn"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-full bg-brand-terracotta text-white px-8 py-4 font-medium hover:opacity-90 transition-opacity animate-pulse"
            >
              <Square className="w-5 h-5" /> {tx("stop")} · {seconds}s
            </button>
          )}

          {phase === "recorded" && blobUrl && (
            <div className="w-full flex flex-col items-center gap-4">
              <audio data-testid="speaking-playback" src={blobUrl} controls className="w-full max-w-sm" />
              {seconds < 1 && <p data-testid="speaking-too-short" className="text-sm text-brand-terracotta-hover">{tx("too_short")}</p>}
              {submitError && (
                <p data-testid={`speaking-error-${submitError}`} role="alert" className="text-sm text-center text-brand-terracotta-hover max-w-sm">
                  {tx(submitError)}
                </p>
              )}
              <div className="flex gap-3">
                <button
                  data-testid="speaking-retry-btn"
                  onClick={recordAgain}
                  className="inline-flex items-center gap-2 rounded-full border border-brand-forest/30 text-brand-forest px-5 py-3 font-medium hover:bg-brand-forest/5 transition-colors"
                >
                  <RotateCw className="w-4 h-4" /> {tx("retry")}
                </button>
                <button
                  data-testid="speaking-submit-btn"
                  disabled={seconds < 1 || submitError === "daily_limit"}
                  onClick={submit}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-forest text-white px-6 py-3 font-medium hover:bg-brand-forest-hover disabled:opacity-40 transition-colors"
                >
                  <Check className="w-4 h-4" /> {tx("submit")}
                </button>
              </div>
            </div>
          )}

          {phase === "processing" && (
            <p data-testid="speaking-analyzing" className="flex items-center gap-2 text-brand-charcoal/60">
              <Loader2 className="w-5 h-5 animate-spin" /> {tx("analyzing")}
            </p>
          )}

          {phase === "mic_denied" && (
            <p data-testid="speaking-mic-denied" className="text-sm text-brand-terracotta-hover text-center max-w-sm">{tx("mic_permission")}</p>
          )}
        </div>
      )}

      {/* Result */}
      {phase === "result" && result && (
        <div data-testid="speaking-result" className="mt-8 border-t border-black/5 pt-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Rating label={tx("clear")} value={result.understandable ? "strong" : "missed"} ui={ui} language={language} testId="speaking-clear" />
            <Rating label={tx("handled")} value={result.situation_handled} ui={ui} language={language} testId="speaking-handled" />
            <Rating label={tx("professional")} value={result.professional_service_english} ui={ui} language={language} testId="speaking-professional" />
            <Rating label={tx("grammar_vocab")} value={result.grammar_vocabulary} ui={ui} language={language} testId="speaking-grammar" />
            <Rating label={tx("naturalness")} value={result.naturalness} ui={ui} language={language} testId="speaking-naturalness" />
          </div>

          <div className="rounded-xl bg-brand-sand border border-black/5 p-4">
            <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("your_transcript")}</p>
            <p data-testid="speaking-transcript" className="mt-1 text-brand-espresso">“{result.transcript_en}”</p>
          </div>

          {result.improved_response_en && (
            <div className="rounded-xl bg-brand-success-muted border border-black/5 p-4">
              <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("improved_response")}</p>
              <p data-testid="speaking-improved" className="mt-1 text-brand-espresso">“{result.improved_response_en}”</p>
            </div>
          )}

          <div className="rounded-xl bg-white border border-black/5 p-4">
            <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("model_response")}</p>
            <p data-testid="speaking-model-response" className="mt-1 text-brand-espresso">“{result.model_response_en}”</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              data-testid="speaking-record-again-btn"
              onClick={recordAgain}
              className="inline-flex items-center justify-center gap-2 flex-1 rounded-lg border border-brand-forest/30 text-brand-forest px-6 py-3 font-medium hover:bg-brand-forest/5 transition-colors"
            >
              <RotateCw className="w-4 h-4" /> {tx("retry")}
            </button>
            {onContinue && (
              <button
                data-testid="speaking-continue-btn"
                onClick={onContinue}
                className="inline-flex items-center justify-center gap-2 flex-1 bg-brand-forest text-white hover:bg-brand-forest-hover transition-colors rounded-lg px-6 py-3 font-medium"
              >
                {continueLabel} <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Optional in MVP: continue even without granting mic / recording */}
      {onContinue && phase !== "result" && (
        <div className="mt-8">
          <button
            data-testid="speaking-skip-continue-btn"
            onClick={onContinue}
            className="w-full text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest py-2"
          >
            {continueLabel}
          </button>
        </div>
      )}
    </div>
  );
}

function Rating({ label, value, ui, language, testId }) {
  const key = value === "strong" ? "strong" : value === "partial" ? "partial" : "needs_work";
  const text = getText(ui[key], language) || key;
  const color =
    value === "strong" ? "text-brand-forest bg-brand-success-muted"
    : value === "partial" ? "text-brand-espresso bg-brand-sand"
    : "text-brand-terracotta-hover bg-brand-terracotta/10";
  return (
    <div data-testid={testId} className="flex items-center justify-between rounded-lg border border-black/5 px-3 py-2">
      <span className="text-sm text-brand-charcoal">{label}</span>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>{text}</span>
    </div>
  );
}
