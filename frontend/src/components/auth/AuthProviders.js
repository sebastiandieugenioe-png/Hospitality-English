// Shared auth presentation (used by the Premium AccountGate and /account).
import { forwardRef } from "react";
import { Loader2 } from "lucide-react";

const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31]";

export const AppleGlyph = () => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className="w-4 h-4 fill-current">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

// Apple-style dark provider button (HIG). Google uses the official GIS-rendered slot below.
export function AuthProviderButton({ label, onClick, disabled, testid }) {
  return (
    <button
      type="button"
      data-testid={testid}
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center justify-center gap-2.5 w-full min-h-[48px] px-6 rounded-[15px] bg-black text-white font-semibold text-[16px] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity ${focusRing}`}
    >
      <AppleGlyph /> {label}
    </button>
  );
}

// Container where Google Identity Services renders its official button. Kept mounted
// (only hidden) while busy so the button is still there for a retry.
export const GoogleSignInSlot = forwardRef(function GoogleSignInSlot({ testid, hidden }, ref) {
  return <div ref={ref} data-testid={testid} className={`min-h-[44px] w-full flex justify-center ${hidden ? "hidden" : ""}`} />;
});

export function AuthStatus({ busy, busyLabel, err, msg, testidPrefix }) {
  return (
    <>
      {busy && (
        <p data-testid={`${testidPrefix}-busy`} role="status" aria-live="polite" className="flex items-center gap-2 text-[15px] text-[#6B736E]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {busyLabel}
        </p>
      )}
      {err && (
        <p data-testid={`${testidPrefix}-error`} role="alert" className="rounded-2xl bg-white border border-[#C7654E]/40 text-[#A44F3B] px-4 py-3 text-[15px]">{err}</p>
      )}
      {msg && (
        <p data-testid={`${testidPrefix}-message`} role="status" className="rounded-2xl bg-[#EEF3EF] border border-[#34785B]/25 text-[#173D31] px-4 py-3 text-[15px]">{msg}</p>
      )}
    </>
  );
}

// Human-readable auth error. Returns null for user cancellation (not an error).
export function friendlyAuthError(e, t) {
  const code = String(e?.code || "");
  if (code.includes("popup-closed") || code.includes("cancelled") || code.includes("user-cancelled") || e?.type === "gis_cancelled") return null;
  if (code === "auth/network-request-failed" || e?.message === "gis_unavailable" || e?.message === "Network Error") return t("account.errNetwork");
  if (e?.isAxiosError) return t("auth.errSaving");
  return t("auth.errSignIn");
}
