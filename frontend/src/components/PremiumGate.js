// Central Premium gating UX: guest account-gate -> paywall -> Test Store purchase.
// Entitlement truth is RevenueCat (useBilling). Nothing premium is persisted locally.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, X, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { renderGisButton, GOOGLE_CLIENT_ID, APPLE_ENABLED } from "@/lib/firebase";
import { isNative } from "@/lib/platform";
import { nativeGoogleIdToken } from "@/lib/nativeAuth";
import { rcDiag } from "@/lib/revenuecat";
import { refreshEntitlement } from "@/lib/api";
import { btnDark, btnLight, focusRing } from "@/components/SettingsLayout";
import { AuthProviderButton, GoogleSignInSlot, NativeGoogleButton, AuthStatus, friendlyAuthError } from "@/components/auth/AuthProviders";

const PremiumContext = createContext(null);
const PROFESSION = "hospitality";

const productOf = (pkg) => (pkg ? (pkg.webBillingProduct || pkg.rcBillingProduct || null) : null);
const priceOf = (pkg) => {
  const p = productOf(pkg);
  return p && p.price ? p.price : null; // { formattedPrice, amountMicros, currency }
};

export function PremiumProvider({ children }) {
  const { isAuthenticated, connectGoogle, connectApple, t } = useApp();
  const billing = useBilling();
  const [mode, setMode] = useState(null); // null | "pending" | "account" | "paywall"
  const resumeRef = useRef(null);
  const intentRef = useRef(false);

  const closeAll = () => { setMode(null); intentRef.current = false; resumeRef.current = null; };

  const runResume = () => {
    const fn = resumeRef.current;
    resumeRef.current = null;
    intentRef.current = false;
    setMode(null);
    if (typeof fn === "function") setTimeout(fn, 0);
  };

  const unresolved = billing.status === "loading" || billing.status === "uninitialized";

  // Central entry point. resume() runs once Premium is unlocked. While access is still
  // resolving, a short loading sheet is shown instead of guessing Free/Premium.
  const requestPremium = ({ resume } = {}) => {
    if (billing.status === "error") {
      toast.error(t("paywall.unavailable"));
      return;
    }
    if (!unresolved && billing.isPremium(PROFESSION)) {
      if (typeof resume === "function") resume();
      return;
    }
    resumeRef.current = resume || null;
    intentRef.current = true;
    setMode(unresolved ? "pending" : isAuthenticated ? "paywall" : "account");
  };

  // Resolve "pending" (and post-sign-in) once access for the current identity is known.
  useEffect(() => {
    if (!intentRef.current) return;
    const afterSignIn = mode === "account" && isAuthenticated;
    if (mode !== "pending" && !afterSignIn) return;
    if (unresolved) { if (afterSignIn) setMode("pending"); return; }
    if (billing.status === "error") { closeAll(); toast.error(t("paywall.unavailable")); return; }
    if (billing.isPremium(PROFESSION)) { runResume(); return; }
    setMode(isAuthenticated ? "paywall" : "account");
  }, [isAuthenticated, mode, billing.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = { requestPremium, isPremium: (p = PROFESSION) => billing.isPremium(p) };

  return (
    <PremiumContext.Provider value={value}>
      {children}
      {mode === "pending" && (
        <Overlay onClose={closeAll} testid="premium-pending" labelledBy="premium-pending-title">
          <CloseButton testid="premium-pending-close" label={t("paywall.closeAria")} onClick={closeAll} />
          <p id="premium-pending-title" role="status" aria-live="polite" className="flex items-center justify-center gap-2 py-10 text-[15px] text-[#6B736E]">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {t("paywall.checkingAccess")}
          </p>
        </Overlay>
      )}
      {mode === "account" && (
        <AccountGate t={t} onClose={closeAll} connectGoogle={connectGoogle} connectApple={connectApple} />
      )}
      {mode === "paywall" && (
        <Paywall t={t} billing={billing} onClose={closeAll} onUnlocked={runResume} />
      )}
    </PremiumContext.Provider>
  );
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) throw new Error("usePremium must be used within PremiumProvider");
  return ctx;
}

/* ---------- Guest account gate ---------- */
function AccountGate({ t, onClose, connectGoogle, connectApple }) {
  const gisRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (isNative() || !GOOGLE_CLIENT_ID || !gisRef.current) return;
      try {
        gisRef.current.innerHTML = "";
        await renderGisButton(gisRef.current, async (response) => {
          const token = response?.credential;
          if (!token) return;
          setBusy(true); setErr(null);
          try { await connectGoogle(token); } // intent effect continues to paywall
          catch (e) { if (active) setErr(friendlyAuthError(e, t)); }
          finally { if (active) setBusy(false); }
        }, { width: 300 });
      } catch { /* GIS unavailable */ }
    })();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Native app: native Google SDK -> same connectGoogle(idToken) path as GIS.
  const onNativeGoogle = async () => {
    setBusy(true); setErr(null);
    try { await connectGoogle(await nativeGoogleIdToken()); }
    catch (e) { setErr(friendlyAuthError(e, t)); }
    finally { setBusy(false); }
  };

  const onApple = async () => {
    setBusy(true); setErr(null);
    try { await connectApple(); }
    catch (e) { setErr(friendlyAuthError(e, t)); }
    finally { setBusy(false); }
  };

  return (
    <Overlay onClose={busy ? undefined : onClose} testid="premium-account-gate" labelledBy="account-gate-title">
      <CloseButton testid="premium-gate-close" label={t("paywall.closeAria")} onClick={onClose} disabled={busy} />
      <h2 id="account-gate-title" className="pr-10 text-[26px] leading-tight font-serif font-semibold text-[#222824]">{t("auth.gateTitle")}</h2>
      <p className="mt-2 text-[15px] text-[#6B736E] leading-relaxed">{t("auth.gateBody")}</p>
      <div className="mt-6 space-y-3">
        <AuthStatus busy={busy} busyLabel={t("auth.savingProgress")} err={err} testidPrefix="premium-gate" />
        {isNative()
          ? !busy && <NativeGoogleButton testid="premium-gate-google-native" label={t("account.continueGoogle")} onClick={onNativeGoogle} />
          : <GoogleSignInSlot ref={gisRef} testid="premium-gate-google" hidden={busy} />}
        {APPLE_ENABLED && (
          <AuthProviderButton testid="premium-gate-apple" label={t("account.continueApple")} disabled={busy} onClick={onApple} />
        )}
        <button type="button" data-testid="premium-gate-notnow" disabled={busy} onClick={onClose} className={`w-full ${btnLight}`}>
          {t("auth.notNow")}
        </button>
      </div>
    </Overlay>
  );
}

// RevenueCat ErrorCode -> calm, non-technical copy (cancel is handled before this).
export function purchaseErrorMessage(e, t) {
  const code = e?.errorCode;
  if (code === 10 || String(e?.message || "").toLowerCase().includes("network")) return t("account.errNetwork");
  if (code === 20) return t("paywall.errPending");
  if (code === 2 || code === 3 || code === 5) return t("paywall.errStore");
  return t("paywall.errPurchase");
}

/* ---------- Custom paywall (prices from RevenueCat) ---------- */
function Paywall({ t, billing, onClose, onUnlocked }) {
  const offering = billing.currentOffering(PROFESSION);
  const annual = offering?.annual || null;
  const monthly = offering?.monthly || null;
  const [selected, setSelected] = useState(annual || !monthly ? "annual" : "monthly");
  const [state, setState] = useState("idle"); // idle | purchasing | error | success
  const [err, setErr] = useState(null);

  const benefits = [
    t("subscription.benefitSituations"),
    t("subscription.benefitListening"),
    t("subscription.benefitSpeaking"),
    t("subscription.benefitReview"),
  ];

  // Savings only when currencies match and numeric prices are comparable.
  let savingsPct = null;
  const ap = priceOf(annual), mp = priceOf(monthly);
  if (ap && mp && ap.currency === mp.currency && ap.amountMicros > 0 && mp.amountMicros > 0) {
    const pct = Math.round((1 - ap.amountMicros / 12 / mp.amountMicros) * 100);
    if (pct > 0) savingsPct = pct;
  }

  const chosenPkg = selected === "annual" ? annual : monthly;
  const purchasing = state === "purchasing";

  const buy = async () => {
    if (!chosenPkg || purchasing) return;
    const productId = productOf(chosenPkg)?.identifier || null;
    setState("purchasing"); setErr(null);
    rcDiag("PURCHASE_START", { stage: "before_checkout", product: productId });
    try {
      const { premium } = await billing.purchase(chosenPkg, PROFESSION);
      if (premium) {
        try { await refreshEntitlement(); } catch { /* backend re-verifies on next request */ }
        setState("success");
      } else {
        rcDiag("CONFIRM_FAILED", { stage: "after_purchase", product: productId });
        setState("error");
        setErr(t("paywall.errConfirm"));
      }
    } catch (e) {
      const code = e?.errorCode;
      rcDiag("PURCHASE_ERROR", { stage: "during_purchase", code, message: e?.message, product: productId });
      if (code === 1) { setState("idle"); return; } // UserCancelledError: no error, no unlock
      if (code === 6) { // ProductAlreadyPurchased: re-sync the account instead of failing
        try {
          if (await billing.refresh(PROFESSION)) {
            try { await refreshEntitlement(); } catch { /* backend re-verifies on next request */ }
            setState("success"); return;
          }
        } catch { /* fall through to confirm error */ }
        setState("error"); setErr(t("paywall.errConfirm")); return;
      }
      setState("error");
      setErr(purchaseErrorMessage(e, t));
    }
  };

  if (state === "success") {
    return (
      <Overlay onClose={onUnlocked} testid="premium-paywall" labelledBy="paywall-success-title">
        <div data-testid="paywall-success" role="status" className="py-4 text-center">
          <CheckCircle2 className="mx-auto w-12 h-12 text-[#34785B]" aria-hidden="true" />
          <h2 id="paywall-success-title" className="mt-4 text-[26px] font-serif font-semibold text-[#222824]">{t("paywall.successTitle")}</h2>
          <p className="mt-2 text-[15px] text-[#6B736E]">{t("paywall.successBody")}</p>
          <button type="button" data-testid="paywall-success-continue" onClick={onUnlocked} className={`mt-7 w-full ${btnDark}`}>
            {t("common.continue")}
          </button>
        </div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={purchasing ? undefined : onClose} testid="premium-paywall" labelledBy="paywall-title">
      <CloseButton testid="paywall-close" label={t("paywall.closeAria")} onClick={onClose} disabled={purchasing} />
      <p className="text-xs uppercase tracking-[0.15em] font-semibold text-[#34785B]">Premium</p>
      <h2 id="paywall-title" className="mt-2 pr-10 text-[26px] sm:text-[30px] leading-tight font-serif font-semibold text-[#222824]">{t("paywall.title")}</h2>
      <p className="mt-2 text-[15px] text-[#6B736E]">{t("paywall.subtitle")}</p>

      <ul data-testid="paywall-benefits" className="mt-5 space-y-2.5">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[15px] text-[#222824]">
            <Check className="w-4 h-4 text-[#34785B] mt-1 shrink-0" aria-hidden="true" /> {b}
          </li>
        ))}
      </ul>

      <p data-testid="paywall-free-note" className="mt-4 rounded-2xl bg-[#F7F5F0] px-4 py-3 text-[14px] text-[#6B736E] leading-relaxed">{t("paywall.freeNote")}</p>

      <div role="radiogroup" aria-label={t("paywall.choosePlan")} className="mt-5 space-y-3">
        <PlanOption t={t} testid="paywall-plan-annual" label={t("subscription.annual")} period={t("paywall.perYear")} pkg={annual}
          selected={selected === "annual"} onSelect={() => setSelected("annual")} disabled={purchasing}
          badge={savingsPct ? t("paywall.save", { pct: savingsPct }) : null} />
        <PlanOption t={t} testid="paywall-plan-monthly" label={t("subscription.monthly")} period={t("paywall.perMonth")} pkg={monthly}
          selected={selected === "monthly"} onSelect={() => setSelected("monthly")} disabled={purchasing} />
      </div>

      {err && <p data-testid="paywall-error" role="alert" className="mt-4 text-[14px] text-[#A44F3B]">{err}</p>}

      <button type="button" data-testid="paywall-continue" disabled={!chosenPkg || purchasing} onClick={buy} aria-busy={purchasing} className={`mt-5 w-full ${btnDark}`}>
        {purchasing ? <><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("paywall.processing")}</> : t("paywall.subscribe")}
      </button>
      <span className="sr-only" role="status" aria-live="polite">{purchasing ? t("paywall.processing") : ""}</span>
      <p data-testid="paywall-renewal-note" className="mt-4 text-[13px] text-[#6B736E] leading-relaxed">{t("paywall.renewalNote")}</p>
      <p data-testid="paywall-legal" className="mt-2 text-[13px] text-[#6B736E]">
        <a href="/terms" target="_blank" rel="noopener noreferrer" data-testid="paywall-terms-link" className={`underline underline-offset-2 hover:text-[#222824] ${focusRing}`}>{t("legal.terms")}</a>
        <span aria-hidden="true"> · </span>
        <a href="/privacy" target="_blank" rel="noopener noreferrer" data-testid="paywall-privacy-link" className={`underline underline-offset-2 hover:text-[#222824] ${focusRing}`}>{t("legal.privacy")}</a>
      </p>
    </Overlay>
  );
}

export function PlanOption({ t, testid, label, period, pkg, selected, onSelect, badge, disabled }) {
  const price = priceOf(pkg);
  const unavailable = !pkg;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      data-testid={testid}
      data-selected={selected ? "true" : "false"}
      disabled={unavailable || disabled}
      onClick={onSelect}
      className={`flex items-center gap-3 w-full min-h-[64px] rounded-2xl border px-4 py-3.5 text-left transition-colors ${focusRing} ${
        selected ? "border-[#173D31] border-2 bg-[#EEF3EF]" : "border-[#DEE2DE] bg-white hover:border-[#173D31]/40"
      } ${unavailable ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <span aria-hidden="true" className={`grid place-items-center w-5 h-5 rounded-full border-2 shrink-0 ${selected ? "border-[#173D31] bg-[#173D31]" : "border-[#B9BFBA]"}`}>
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[16px] font-semibold text-[#222824]">{label}</span>
          {badge && <span className="text-[11px] uppercase tracking-wider font-semibold text-[#173D31] bg-[#173D31]/10 px-2 py-0.5 rounded-full">{badge}</span>}
        </span>
      </span>
      <span className="text-right shrink-0">
        <span data-testid={`${testid}-price`} className="block text-[16px] font-semibold text-[#222824]">
          {price ? price.formattedPrice : "—"}
        </span>
        <span className="block text-[12px] text-[#6B736E]">{price ? period : t("paywall.priceUnavailable")}</span>
      </span>
    </button>
  );
}

function CloseButton({ testid, label, onClick, disabled }) {
  if (disabled) return null;
  return (
    <button type="button" data-testid={testid} aria-label={label} onClick={onClick}
      className={`absolute top-3 right-3 grid place-items-center w-11 h-11 rounded-full text-[#6B736E] hover:bg-[#F7F5F0] hover:text-[#222824] transition-colors ${focusRing}`}>
      <X className="w-5 h-5" aria-hidden="true" />
    </button>
  );
}

function Overlay({ children, onClose, testid, labelledBy }) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div data-testid={testid} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-[#222824]/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-8 shadow-xl max-h-[92dvh] overflow-y-auto overscroll-contain">
        {children}
      </div>
    </div>
  );
}
