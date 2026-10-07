import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Trash2, Mail, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Navbar } from "@/components/Navbar";
import { APPLE_ENABLED, renderGisButton, GOOGLE_CLIENT_ID } from "@/lib/firebase";

// Apple logo (white) for the HIG-compliant "Continue with Apple" button.
const AppleIcon = () => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className="w-4 h-4 fill-current">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

export default function Account() {
  const navigate = useNavigate();
  const { account, isAuthenticated, connectGoogle, connectApple, reauthGoogle, logout, deleteAccount } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [gisUnavailable, setGisUnavailable] = useState(false);
  const [appleConsent, setAppleConsent] = useState(false);

  const googleBtnRef = useRef(null);
  const reauthBtnRef = useRef(null);
  // Latest auth state for the single shared GIS callback.
  const stateRef = useRef({ isAuthenticated, confirmDelete });
  stateRef.current = { isAuthenticated, confirmDelete };

  const friendly = (e, label = "Google") => {
    const code = e?.code || "";
    if (code.includes("popup") || code.includes("cancelled") || e?.type === "gis_cancelled") return null; // user cancelled
    if (code === "auth/network-request-failed" || e?.message === "gis_unavailable") return "Network problem. Please check your connection and try again.";
    if (code === "auth/invalid-credential") return `That ${label} sign-in could not be verified. Please try again.`;
    return `Could not complete ${label} sign-in. Please try again.`;
  };

  // Apple linking (popup). Consent is confirmed before this runs.
  const handleApple = async () => {
    setAppleConsent(false);
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await connectApple();
      setMsg(r?.loaded_existing_account
        ? "Your saved account progress has been loaded."
        : "Your progress is now saved to your account.");
    } catch (e) {
      const m = friendly(e, "Apple");
      if (m) setErr(m);
    } finally {
      setBusy(false);
    }
  };

  // Single GIS credential callback. Purpose inferred from current state:
  // authenticated + confirming delete -> reauth+delete; otherwise -> link/sign-in.
  const onCredential = async (response) => {
    const googleIdToken = response?.credential; // kept only in memory
    if (!googleIdToken) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      if (stateRef.current.isAuthenticated && stateRef.current.confirmDelete) {
        await reauthGoogle(googleIdToken);
        await deleteAccount();
        setConfirmDelete(false);
        setMsg("Your account and learning data have been deleted.");
      } else {
        const r = await connectGoogle(googleIdToken);
        setMsg(r?.loaded_existing_account
          ? "Your saved account progress has been loaded."
          : "Your progress is now saved to your account.");
      }
    } catch (e) {
      const m = friendly(e);
      if (m) setErr(m);
    } finally {
      setBusy(false);
    }
  };

  // Render the GIS button for the guest "Continue with Google" entry point.
  useEffect(() => {
    if (isAuthenticated || !GOOGLE_CLIENT_ID) {
      if (!GOOGLE_CLIENT_ID) setGisUnavailable(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        if (googleBtnRef.current) {
          googleBtnRef.current.innerHTML = "";
          await renderGisButton(googleBtnRef.current, onCredential, { width: 300 });
        }
      } catch (e) {
        if (!cancelled) setGisUnavailable(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [isAuthenticated]);

  // Render a GIS button to confirm deletion (recent-login reauthentication).
  useEffect(() => {
    if (!isAuthenticated || !confirmDelete || !GOOGLE_CLIENT_ID) return;
    (async () => {
      try {
        if (reauthBtnRef.current) {
          reauthBtnRef.current.innerHTML = "";
          await renderGisButton(reauthBtnRef.current, onCredential, { width: 300 });
        }
      } catch (e) {
        setGisUnavailable(true);
      }
    })();
    // eslint-disable-next-line
  }, [isAuthenticated, confirmDelete]);

  const handleLogout = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { await logout(); } catch (e) { setErr("Sign out failed. Please try again."); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-10 sm:py-14">
        <button
          data-testid="account-back-btn"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-brand-charcoal/60 hover:text-brand-forest transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <h1 className="mt-5 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">Account</h1>

        {msg && (
          <p data-testid="account-message" className="mt-5 rounded-xl bg-brand-success-muted border border-brand-forest/15 text-brand-forest px-4 py-3 text-sm">
            {msg}
          </p>
        )}
        {err && (
          <p data-testid="account-error" className="mt-5 rounded-xl bg-brand-terracotta/10 border border-brand-terracotta/20 text-brand-terracotta-hover px-4 py-3 text-sm">
            {err}
          </p>
        )}

        {isAuthenticated ? (
          /* ---- Signed in ---- */
          <div data-testid="account-authenticated" className="mt-8 space-y-6">
            <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
              {account?.display_name && <p className="text-lg font-serif text-brand-espresso">{account.display_name}</p>}
              {account?.email && (
                <p className="mt-1 flex items-center gap-2 text-sm text-brand-charcoal/70">
                  <Mail className="w-4 h-4" /> <span data-testid="account-email">{account.email}</span>
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {(account?.providers || []).map((p) => (
                  <span key={p} data-testid={`account-provider-${p}`} className="inline-flex items-center gap-1.5 text-xs font-medium bg-brand-sand border border-black/5 rounded-full px-3 py-1 text-brand-charcoal/70">
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-forest" /> {p === "google.com" ? "Google" : p}
                  </span>
                ))}
              </div>
            </div>

            <button
              data-testid="account-signout-btn"
              disabled={busy}
              onClick={handleLogout}
              className="inline-flex items-center justify-center gap-2 w-full rounded-lg border border-brand-forest/30 text-brand-forest px-6 py-3.5 font-medium hover:bg-brand-forest/5 disabled:opacity-40 transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>

            <div className="rounded-2xl border border-brand-terracotta/20 bg-brand-terracotta/5 p-6">
              <p className="flex items-center gap-2 text-sm font-semibold text-brand-terracotta-hover">
                <AlertTriangle className="w-4 h-4" /> Delete account
              </p>
              <p className="mt-1 text-sm text-brand-charcoal/60">This permanently deletes your account and all your learning data. This cannot be undone.</p>
              {!confirmDelete ? (
                <button
                  data-testid="account-delete-btn"
                  onClick={() => { setErr(null); setMsg(null); setConfirmDelete(true); }}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-terracotta text-white px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" /> Delete account
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-brand-charcoal/70">For your security, confirm it's you with Google, then your account will be deleted:</p>
                  {busy ? (
                    <p className="flex items-center gap-2 text-sm text-brand-charcoal/60"><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</p>
                  ) : (
                    <div ref={reauthBtnRef} data-testid="account-reauth-google" className="min-h-[44px]" />
                  )}
                  <button
                    data-testid="account-delete-cancel-btn"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-lg border border-black/10 text-brand-charcoal/70 px-5 py-2.5 font-medium hover:bg-brand-sand transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ---- Guest (no visible account) ---- */
          <div data-testid="account-guest" className="mt-8 space-y-5">
            <div className="rounded-2xl bg-white border border-black/5 p-6 shadow-sm">
              <p className="text-lg font-serif text-brand-espresso">Save your progress</p>
              <p className="mt-1 text-sm text-brand-charcoal/60">Save your progress and continue on another device.</p>

              {busy ? (
                <p className="mt-5 flex items-center gap-2 text-brand-charcoal/60"><Loader2 className="w-5 h-5 animate-spin" /> Connecting…</p>
              ) : gisUnavailable ? (
                <p data-testid="account-gis-unavailable" className="mt-5 text-sm text-brand-terracotta-hover">Google sign-in is temporarily unavailable. Please try again later.</p>
              ) : (
                <div ref={googleBtnRef} data-testid="account-google-gis" className="mt-5 min-h-[44px]" />
              )}

              {APPLE_ENABLED && (
                appleConsent ? (
                  <div data-testid="account-apple-consent" className="mt-3 rounded-lg border border-black/10 bg-brand-sand/60 p-4">
                    <p className="text-sm text-brand-charcoal/80">
                      Your current HospitalityEnglish progress will be linked to your Apple account and available across devices.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        data-testid="account-apple-confirm-btn"
                        disabled={busy}
                        onClick={handleApple}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-black text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                      >
                        <AppleIcon /> Continue with Apple
                      </button>
                      <button
                        data-testid="account-apple-cancel-btn"
                        disabled={busy}
                        onClick={() => setAppleConsent(false)}
                        className="rounded-lg border border-black/10 text-brand-charcoal/70 px-5 py-2.5 text-sm font-medium hover:bg-brand-sand transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    data-testid="account-apple-btn"
                    disabled={busy}
                    onClick={() => { setErr(null); setMsg(null); setAppleConsent(true); }}
                    className="mt-3 inline-flex items-center justify-center gap-3 w-full rounded-lg bg-black text-white px-6 py-3.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    <AppleIcon /> Continue with Apple
                  </button>
                )
              )}
            </div>
            <p className="text-center text-sm text-brand-charcoal/50">No account is required to keep learning.</p>
          </div>
        )}
      </main>
    </div>
  );
}
