// Generic Focus Mode primitives (profession-agnostic; reusable by Lessons, Listening, Speaking).
import { useEffect, useRef } from "react";
import { X, CircleCheck, CircleAlert } from "lucide-react";

export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31]";

export function FocusLayout({ onExit, exitLabel, current, total, progressLabel, children }) {
  const known = Number.isFinite(current) && Number.isFinite(total) && total > 0;
  return (
    <div className="min-h-screen bg-[#F7F5F0] flex flex-col" data-testid="focus-layout">
      <header className="sticky top-0 z-40 bg-[#F7F5F0]/90 backdrop-blur-xl border-b border-[#DEE2DE]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <button type="button" data-testid="lesson-close-btn" onClick={onExit} aria-label={exitLabel}
            className={`grid place-items-center w-11 h-11 -ml-2 rounded-full text-[#6B736E] hover:text-[#222824] hover:bg-[#EEF3EF] transition-colors ${focusRing}`}>
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
          {known && (
            <>
              <div role="progressbar" aria-label={progressLabel} aria-valuemin={0} aria-valuemax={total} aria-valuenow={current}
                data-testid="focus-progress" className="flex-1 h-1.5 rounded-full bg-[#DEE2DE] overflow-hidden">
                <div className="h-full bg-[#173D31] transition-[width] duration-500" style={{ width: `${(current / total) * 100}%` }} />
              </div>
              <span data-testid="focus-step-counter" className="text-[13px] font-medium text-[#6B736E] tabular-nums">{current} / {total}</span>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 sm:px-8 pt-7 pb-12">{children}</main>
    </div>
  );
}

const base = `inline-flex items-center justify-center gap-2 w-full min-h-[52px] px-6 rounded-[15px] font-semibold text-[16px] transition-colors ${focusRing}`;
export function PrimaryButton({ testId, className = "", ...props }) {
  return <button type="button" data-testid={testId} className={`${base} bg-[#173D31] text-white hover:bg-[#102E25] disabled:opacity-40 disabled:cursor-not-allowed ${className}`} {...props} />;
}
export function SecondaryButton({ testId, className = "", ...props }) {
  return <button type="button" data-testid={testId} className={`${base} border border-[#DEE2DE] bg-white text-[#173D31] hover:bg-[#EEF3EF] ${className}`} {...props} />;
}

export function TeachingBlock({ eyebrow, title, sub, children }) {
  return (
    <section>
      {eyebrow && <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{eyebrow}</p>}
      {title && <h1 className="mt-1 text-[26px] leading-tight font-serif font-semibold text-[#222824] tracking-tight">{title}</h1>}
      {sub && <p className="mt-1.5 text-[15px] text-[#6B736E] leading-relaxed">{sub}</p>}
      {children}
    </section>
  );
}

export function PhraseBlock({ english, translation, testId, children }) {
  return (
    <div data-testid={testId} className="border-l-[3px] border-[#173D31] bg-white rounded-r-2xl px-4 py-3.5">
      <p lang="en" className="text-[17px] text-[#222824] font-medium leading-snug">“{english}”</p>
      {translation && <p className="mt-1 text-[14px] text-[#6B736E]">{translation}</p>}
      {children}
    </div>
  );
}

export function DialogueExample({ lines }) {
  return (
    <ol className="space-y-2.5" data-testid="dialogue-lines">
      {lines.map((l, i) => (
        <li key={i} className={`rounded-2xl px-4 py-3 ${l.isStaff ? "bg-[#EEF3EF] border border-[#173D31]/15" : "bg-white border border-[#DEE2DE]"}`}>
          <p className={`text-[11px] uppercase tracking-[0.15em] font-semibold ${l.isStaff ? "text-[#173D31]" : "text-[#6B736E]"}`}>{l.speaker}</p>
          <p lang="en" className="mt-1 text-[16px] text-[#222824] font-medium">{l.english}</p>
          {l.translation && <p className="mt-0.5 text-[14px] text-[#6B736E]">{l.translation}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ExerciseShell({ testId, instruction, prompt, children, feedback, action }) {
  const fbRef = useRef(null);
  useEffect(() => {
    if (feedback) fbRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [feedback]);
  return (
    <div data-testid={testId}>
      {instruction && <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{instruction}</p>}
      <h2 className="mt-1 text-[21px] leading-snug font-serif font-semibold text-[#222824]">{prompt}</h2>
      <div className="mt-5">{children}</div>
      <div ref={fbRef}>{feedback}</div>
      <div className="mt-6">{action}</div>
    </div>
  );
}

export function AnswerOption({ testId, label, selected, state, disabled, onSelect }) {
  // state: null | "correct" | "incorrect" | "dim" (after answering)
  const cls = state === "correct" ? "border-2 border-[#34785B] bg-[#EEF3EF]"
    : state === "incorrect" ? "border-2 border-[#C7654E] bg-white"
    : selected ? "border-2 border-[#173D31] bg-[#EEF3EF]"
    : "border border-[#DEE2DE] bg-white hover:border-[#173D31]/40";
  return (
    <button type="button" role="radio" aria-checked={selected} data-testid={testId} disabled={disabled} onClick={onSelect}
      className={`flex items-center gap-3 w-full min-h-[52px] text-left rounded-[15px] px-4 py-3 transition-colors ${focusRing} ${cls} ${state === "dim" ? "opacity-70" : ""}`}>
      <span aria-hidden="true" className={`w-5 h-5 rounded-full border-2 shrink-0 grid place-items-center ${selected || state === "correct" ? "border-[#173D31]" : "border-[#DEE2DE]"}`}>
        {selected && <span className="w-2.5 h-2.5 rounded-full bg-[#173D31]" />}
      </span>
      <span className="flex-1 text-[16px] text-[#222824]">{label}</span>
      {state === "correct" && <CircleCheck className="w-5 h-5 text-[#34785B] shrink-0" aria-hidden="true" />}
      {state === "incorrect" && <CircleAlert className="w-5 h-5 text-[#A44F3B] shrink-0" aria-hidden="true" />}
    </button>
  );
}

export function FeedbackPanel({ testId, correct, correctTitle, incorrectTitle, betterLabel, betterAnswer, whyLabel, explanation }) {
  return (
    <div data-testid={testId} data-correct={correct ? "true" : "false"} role="status" aria-live="polite"
      className={`mt-6 rounded-2xl border p-4 ${correct ? "bg-[#EEF3EF] border-[#34785B]/30" : "bg-white border-[#C7654E]/35"}`}>
      <p className={`font-semibold text-[17px] flex items-center gap-2 ${correct ? "text-[#34785B]" : "text-[#A44F3B]"}`}>
        {correct ? <CircleCheck className="w-5 h-5" aria-hidden="true" /> : <CircleAlert className="w-5 h-5" aria-hidden="true" />}
        {correct ? correctTitle : incorrectTitle}
      </p>
      {!correct && betterAnswer != null && (
        <div className="mt-3">
          <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{betterLabel}</p>
          <p lang="en" className="mt-0.5 text-[16px] text-[#222824] font-medium">{betterAnswer}</p>
        </div>
      )}
      {explanation && (
        <div className="mt-3">
          {!correct && <p className="text-[12px] uppercase tracking-[0.12em] font-semibold text-[#6B736E]">{whyLabel}</p>}
          <p className="mt-0.5 text-[15px] text-[#222824]/80 leading-relaxed">{explanation}</p>
        </div>
      )}
    </div>
  );
}
