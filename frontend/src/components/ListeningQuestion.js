import { useEffect, useRef, useState } from "react";
import { Play, RotateCw, Check, XCircle, ArrowRight, Volume2 } from "lucide-react";
import { getText } from "@/lib/i18n";
import { submitListeningAttempt } from "@/lib/api";

// One self-contained listening comprehension question.
// Audio first; transcript / translation / model response are hidden until answered.
// answer_index is never known to the client before submitting.
export function ListeningQuestion({ item, ui, language, guestId, onAnswered, onContinue, submitLabel, continueLabel }) {
  const tx = (key) => getText(ui[key], language) || key;
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null); // { correct, correct_index, reveal }
  const [busy, setBusy] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    // Reset for a new item.
    setSelected(null);
    setResult(null);
    setBusy(false);
    setShowTranscript(false);
    setShowTranslation(false);
    // Autoplay the clip when the item appears (best-effort; browsers may block).
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.currentTime = 0;
      a.play().catch(() => {});
    }
  }, [item.id]);

  const play = () => {
    const a = audioRef.current;
    if (a) {
      a.currentTime = 0;
      a.play().catch(() => {});
    }
  };

  const locked = !!result;

  const submit = async () => {
    if (locked) {
      onContinue();
      return;
    }
    if (selected === null) return;
    setBusy(true);
    try {
      const r = await submitListeningAttempt(guestId, { listening_item_id: item.id, selected_index: selected });
      setResult(r);
      if (onAnswered) onAnswered(r);
    } finally {
      setBusy(false);
    }
  };

  const audioSrc = item.audio_url; // relative; served statically from the app origin

  return (
    <div data-testid="listening-question">
      <p className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">
        <Volume2 className="w-4 h-4" /> {tx("section_title")}
      </p>
      <h2 className="mt-2 text-xl sm:text-2xl font-serif text-brand-espresso leading-snug">{item.prompt}</h2>

      {/* Audio player (pre-generated clip; no runtime TTS) */}
      <audio ref={audioRef} src={audioSrc} preload="auto" data-testid="listening-audio" />
      <div className="mt-5 flex items-center gap-3">
        <button
          data-testid="listening-play-btn"
          onClick={play}
          className="inline-flex items-center gap-2 rounded-full bg-brand-forest text-white px-6 py-3 font-medium hover:bg-brand-forest-hover transition-colors"
        >
          <Play className="w-4 h-4" /> {tx("play")}
        </button>
        <button
          data-testid="listening-replay-btn"
          onClick={play}
          className="inline-flex items-center gap-2 rounded-full border border-brand-forest/30 text-brand-forest px-5 py-3 font-medium hover:bg-brand-forest/5 transition-colors"
        >
          <RotateCw className="w-4 h-4" /> {tx("replay")}
        </button>
      </div>

      {/* Options */}
      <div className="mt-6 space-y-3">
        {item.options.map((opt, i) => {
          const isCorrect = result && result.correct_index === i;
          const isWrongPick = result && !result.correct && selected === i;
          return (
            <button
              key={opt.slug}
              data-testid={`listening-option-${i}`}
              disabled={locked}
              onClick={() => setSelected(i)}
              className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${
                isCorrect
                  ? "border-brand-forest bg-brand-success-muted"
                  : isWrongPick
                  ? "border-brand-terracotta bg-brand-terracotta/10"
                  : selected === i
                  ? "border-brand-forest bg-brand-success-muted"
                  : "border-black/5 bg-white hover:border-brand-forest/30"
              }`}
            >
              <span className="text-brand-charcoal">{opt.label}</span>
              {isCorrect && <Check className="w-5 h-5 text-brand-forest" />}
              {isWrongPick && <XCircle className="w-5 h-5 text-brand-terracotta" />}
            </button>
          );
        })}
      </div>

      {/* Feedback + reveal (only after answering) */}
      {result && (
        <div className="mt-6 border-t border-black/5 pt-6">
          <p
            data-testid="listening-feedback"
            className={`font-semibold ${result.correct ? "text-brand-forest" : "text-brand-terracotta-hover"}`}
          >
            {result.correct ? `✓ ${tx("correct")}` : `✕ ${tx("try_again")}`}
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              data-testid="listening-show-transcript-btn"
              onClick={() => setShowTranscript((v) => !v)}
              className="text-sm font-medium text-brand-forest hover:underline"
            >
              {showTranscript ? tx("hide_transcript") : tx("show_transcript")}
            </button>
          </div>

          {showTranscript && (
            <div className="mt-3 rounded-xl bg-brand-sand border border-black/5 p-4">
              {/* English target — never translated */}
              <p data-testid="listening-transcript" className="text-brand-espresso">“{result.reveal.transcript_en}”</p>
              {result.reveal.transcript_translation && (
                <>
                  <button
                    data-testid="listening-show-translation-btn"
                    onClick={() => setShowTranslation((v) => !v)}
                    className="mt-2 text-xs font-medium text-brand-charcoal/60 hover:underline"
                  >
                    {tx("show_translation")}
                  </button>
                  {showTranslation && (
                    <p data-testid="listening-translation" className="mt-1 text-sm text-brand-charcoal/70 italic">
                      {result.reveal.transcript_translation}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="mt-4 rounded-xl bg-brand-success-muted border border-black/5 p-4">
            <p className="text-xs uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50">{tx("best_response")}</p>
            {/* English target — never translated */}
            <p data-testid="listening-model-response" className="mt-1 text-brand-espresso">
              “{result.reveal.model_response_en}”
            </p>
            {result.reveal.model_response_translation && (
              <p className="mt-1 text-sm text-brand-charcoal/70 italic">{result.reveal.model_response_translation}</p>
            )}
          </div>
        </div>
      )}

      <div className="mt-8">
        <button
          data-testid="listening-continue-btn"
          disabled={(selected === null && !locked) || busy}
          onClick={submit}
          className="inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
        >
          {locked ? continueLabel : submitLabel}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
