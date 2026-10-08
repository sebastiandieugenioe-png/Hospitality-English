// Central Premium gating UX: guest account-gate -> paywall -> Test Store purchase.
// Entitlement truth is RevenueCat (useBilling). Nothing premium is persisted locally.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Lock, Check, X, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { renderGisButton, GOOGLE_CLIENT_ID, APPLE_ENABLED } from "@/lib/firebase";

const PremiumContext = createContext(null);
const PROFESSION = "hospitality";

const AppleGlyph = () => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className="w-4 h-4 fill-current">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

const productOf = (pkg) => (pkg ? (pkg.webBillingProduct || pkg.rcBillingProduct || null) : null);
const priceOf = (pkg) => {
  const p = productOf(pkg);
  return p && p.price ? p.price : null; // { formattedPrice, amountMicros, currency }
};

export function PremiumProvider({ children }) {
  const { isAuthenticated, connectGoogle, connectApple } = useApp();
  const billing = useBilling();
  const [mode, setMode] = useState(null); // null | "account" | "paywall"
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

  // Central entry point. resume() runs once Premium is unlocked.
  const requestPremium = ({ resume } = {}) => {
    if (billing.status === "loading" || billing.status === "uninitialized" || billing.status === "error") {
      toast.error("Premium is temporarily unavailable. Please try again.");
      return;
    }
    if (billing.isPremium(PROFESSION)) {
      if (typeof resume === "function") resume();
      return;
    }
    resumeRef.current = resume || null;
    intentRef.current = true;
    setMode(isAuthenticated ? "paywall" : "account");
  };

  // After the guest signs in, continue automatically to the paywall if intent held.
  useEffect(() => {
    if (isAuthenticated && intentRef.current && mode === "account") {
      if (billing.isPremium(PROFESSION)) { runResume(); return; }
      setMode("paywall");
    }
  }, [isAuthenticated, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = { requestPremium, isPremium: (p = PROFESSION) => billing.isPremium(p) };

  return (
    <PremiumContext.Provider value={value}>
      {children}
      {mode === "account" && (
        <AccountGate
          onClose={closeAll}
          connectGoogle={connectGoogle}
          connectApple={connectApple}
        />
      )}
      {mode === "paywall" && (
        <Paywall
          billing={billing}
          onClose={closeAll}
          onUnlocked={runResume}
        />
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
function AccountGate({ onClose, connectGoogle, connectApple }) {
  const gisRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!GOOGLE_CLIENT_ID || !gisRef.current) return;
      try {
        gisRef.current.innerHTML = "";
        await renderGisButton(gisRef.current, async (response) => {
          const token = response?.credential;
          if (!token) return;
          setBusy(true); setErr(null);
          try { await connectGoogle(token); } // intent effect continues to paywall
          catch (e) { if (active) setErr("Could not sign in. Please try again."); }
          finally { if (active) setBusy(false); }
        }, { width: 300 });
      } catch { /* GIS unavailable */ }
    })();
    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onApple = async () => {
    setBusy(true); setErr(null);
    try { await connectApple(); }
    catch (e) {
      const code = e?.code || "";
      if (!(code.includes("popup") || code.includes("cancelled"))) setErr("Could not sign in. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <Overlay onClose={onClose} testid="premium-account-gate">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-brand-forest"><Sparkles className="w-5 h-5" /></span>
        <button data-testid="premium-gate-close" onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-espresso"><X className="w-5 h-5" /></button>
      </div>
      <h2 className="mt-3 text-2xl font-serif text-brand-espresso">Create an account to save your progress and unlock Premium.</h2>
      {err && <p data-testid="premium-gate-error" className="mt-3 text-sm text-brand-terracotta">{err}</p>}
      <div className="mt-5 space-y-3">
        <div ref={gisRef} data-testid="premium-gate-google" className="min-h-[44px]" />
        {APPLE_ENABLED && (
          <button
            data-testid="premium-gate-apple"
            disabled={busy}
            onClick={onApple}
            className="inline-flex items-center justify-center gap-3 w-full rounded-lg bg-black text-white px-6 py-3.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <AppleGlyph /> Continue with Apple
          </button>
        )}
        <button
          data-testid="premium-gate-notnow"
          disabled={busy}
          onClick={onClose}
          className="w-full rounded-lg border border-black/10 text-brand-charcoal/70 px-6 py-3 font-medium hover:bg-brand-sand transition-colors"
        >
          Not now
        </button>
      </div>
    </Overlay>
  );
}

/* ---------- Custom paywall (prices from RevenueCat) ---------- */
function Paywall({ billing, onClose, onUnlocked }) {
  const offering = billing.currentOffering(PROFESSION);
  const annual = offering?.annual || null;
  const monthly = offering?.monthly || null;
  const [selected, setSelected] = useState("annual"); // default to best value
  const [state, setState] = useState("idle"); // idle | purchasing | error
  const [err, setErr] = useState(null);

  const benefits = [
    "All 25 situations for your role",
    "Full Listening practice",
    "Full Speaking practice",
    "Full review and practice access",
    "Future Hospitality content included",
  ];

  // Savings only when currencies match and numeric prices are comparable.
  let savingsPct = null;
  const ap = priceOf(annual), mp = priceOf(monthly);
  if (ap && mp && ap.currency === mp.currency && ap.amountMicros > 0 && mp.amountMicros > 0) {
    const annualPerMonth = ap.amountMicros / 12;
    const pct = Math.round((1 - annualPerMonth / mp.amountMicros) * 100);
    if (pct > 0) savingsPct = pct;
  }

  const chosenPkg = selected === "annual" ? annual : monthly;

  const buy = async () => {
    if (!chosenPkg) return;
    setState("purchasing"); setErr(null);
    try {
      const { premium } = await billing.purchase(chosenPkg, PROFESSION);
      if (premium) {
        toast.success("Premium unlocked.");
        onUnlocked();
      } else {
        setState("error");
        setErr("Your purchase could not be confirmed yet. Please try again.");
      }
    } catch (e) {
      if (e?.errorCode === 1) { setState("idle"); return; } // UserCancelledError: no error, no unlock
      setState("error");
      setErr("Something went wrong with the purchase. Please try again.");
    }
  };

  return (
    <Overlay onClose={state === "purchasing" ? undefined : onClose} testid="premium-paywall">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-brand-forest"><Lock className="w-5 h-5" /></span>
        {state !== "purchasing" && (
          <button data-testid="paywall-close" onClick={onClose} className="text-brand-charcoal/40 hover:text-brand-espresso"><X className="w-5 h-5" /></button>
        )}
      </div>
      <h2 className="mt-3 text-2xl sm:text-3xl font-serif text-brand-espresso">Unlock all Hospitality English</h2>
      <ul className="mt-4 space-y-2">
        {benefits.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm text-brand-charcoal/80">
            <Check className="w-4 h-4 text-brand-forest mt-0.5 shrink-0" /> {b}
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-3">
        <PlanOption
          testid="paywall-plan-annual" label="Annual" pkg={annual}
          selected={selected === "annual"} onSelect={() => setSelected("annual")}
          badge={savingsPct ? `Save ${savingsPct}%` : null}
        />
        <PlanOption
          testid="paywall-plan-monthly" label="Monthly" pkg={monthly}
          selected={selected === "monthly"} onSelect={() => setSelected("monthly")}
        />
      </div>

      {err && <p data-testid="paywall-error" className="mt-3 text-sm text-brand-terracotta">{err}</p>}

      <button
        data-testid="paywall-continue"
        disabled={!chosenPkg || state === "purchasing"}
        onClick={buy}
        className="mt-6 inline-flex items-center justify-center gap-2 w-full rounded-lg bg-brand-forest text-white px-6 py-4 font-medium hover:bg-brand-forest-hover disabled:opacity-40 transition-colors"
      >
        {state === "purchasing" ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</> : "Continue"}
      </button>
    </Overlay>
  );
}

function PlanOption({ testid, label, pkg, selected, onSelect, badge }) {
  const price = priceOf(pkg);
  return (
    <button
      data-testid={testid}
      disabled={!pkg}
      onClick={onSelect}
      className={`flex items-center justify-between w-full rounded-xl border px-5 py-4 text-left transition-all ${
        selected ? "border-brand-forest bg-brand-success-muted" : "border-black/10 bg-white hover:border-brand-forest/40"
      } ${!pkg ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      <div>
        <span className="font-serif text-lg text-brand-espresso">{label}</span>
        {badge && (
          <span className="ml-2 text-[10px] uppercase tracking-wider font-semibold text-brand-forest bg-brand-forest/10 px-2 py-0.5 rounded-full">{badge}</span>
        )}
      </div>
      <span data-testid={`${testid}-price`} className="text-brand-espresso font-semibold">
        {price ? price.formattedPrice : "—"}
      </span>
    </button>
  );
}

function Overlay({ children, onClose, testid }) {
  return (
    <div data-testid={testid} className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-brand-espresso/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
