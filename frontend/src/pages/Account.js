import { useEffect, useRef, useState } from "react";
import { LogOut, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SecondaryPage, Section, Row, btnLight } from "@/components/SettingsLayout";
import { APPLE_ENABLED, renderGisButton, GOOGLE_CLIENT_ID } from "@/lib/firebase";

// Apple logo (white) for the HIG-compliant "Continue with Apple" button.
const AppleIcon = () => (
  <svg viewBox="0 0 384 512" aria-hidden="true" className="w-4 h-4 fill-current">
    <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/>
  </svg>
);

export default function Account() {
  const { t, account, isAuthenticated, connectGoogle, connectApple, reauthGoogle, reauthRevokeApple, logout, deleteAccount } = useApp();
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
    if (code === "auth/network-request-failed" || e?.message === "gis_unavailable") return t("account.errNetwork");
    if (code === "auth/invalid-credential") return t("account.errInvalid", { provider: label });
    return t("account.errGeneric", { provider: label });
  };

  // Apple linking (popup). Consent is confirmed before this runs.
  const handleApple = async () => {
    setAppleConsent(false);
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await connectApple();
      setMsg(r?.loaded_existing_account
        ? t("account.loadedExisting")
        : t("account.progressSaved"));
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
        setMsg(t("account.deleted"));
      } else {
        const r = await connectGoogle(googleIdToken);
        setMsg(r?.loaded_existing_account
          ? t("account.loadedExisting")
          : t("account.progressSaved"));
      }
    } catch (e) {
      const m = friendly(e);
      if (m) setErr(m);
    } finally {
      setBusy(false);
    }
  };

  // Apple account deletion: fresh reauth + Apple access revocation, then delete.
  // On cancel or missing revoke token, nothing is deleted.
  const handleAppleDelete = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await reauthRevokeApple();          // reauth + revoke; throws on cancel / missing token
      await deleteAccount();              // backend delete + firebase delete + fresh anon guest
      setConfirmDelete(false);
      setMsg(t("account.deleted"));
    } catch (e) {
      const code = e?.code || "";
      if (code.includes("popup") || code.includes("cancelled") || code.includes("user-cancelled")) {
        setErr(t("account.deleteCancelled"));
      } else if (code === "APPLE_REVOKE_TOKEN_MISSING") {
        setErr(t("account.appleRevokeMissing"));
      } else {
        setErr(t("account.deleteFailed"));
      }
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
    try { await logout(); } catch (e) { setErr(t("account.signOutFailed")); }
    finally { setBusy(false); }
  };

  const providers = account?.providers || [];
  const providerName = (p) => (p === "google.com" ? "Google" : p === "apple.com" ? "Apple" : null);
  const signedWith = providers.map(providerName).filter(Boolean).join(", ");
  const darkBtn = "inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] bg-black text-white hover:opacity-90 disabled:opacity-40 transition-opacity";

  return (
    <SecondaryPage title={t("settings.account")} testid="account-page">
      {msg && (
        <p data-testid="account-message" role="status" className="rounded-2xl bg-[#EEF3EF] border border-[#34785B]/25 text-[#173D31] px-4 py-3 text-[15px]">{msg}</p>
      )}
      {err && (
        <p data-testid="account-error" role="alert" className="rounded-2xl bg-white border border-[#C7654E]/40 text-[#A44F3B] px-4 py-3 text-[15px]">{err}</p>
      )}

      {isAuthenticated ? (
        <div data-testid="account-authenticated" className="space-y-8">
          <Section title={t("account.signIn")} id="account-signin-title">
            {account?.email && <Row label={t("settings.email")} value={<span data-testid="account-email">{account.email}</span>} testid="account-email-row" />}
            {signedWith && <Row label={t("account.signedInWith")} value={signedWith} testid="account-providers" />}
          </Section>
          <div className="sr-only">
            {providers.map((p) => <span key={p} data-testid={`account-provider-${p}`}>{providerName(p) || p}</span>)}
          </div>

          <button type="button" data-testid="account-signout-btn" disabled={busy} onClick={handleLogout} className={`w-full ${btnLight}`}>
            <LogOut className="w-4 h-4" aria-hidden="true" /> {t("account.signOut")}
          </button>

          <section aria-labelledby="account-danger-title" className="pt-6 border-t border-[#DEE2DE]">
            <h2 id="account-danger-title" className="text-xs uppercase tracking-[0.15em] font-semibold text-[#A44F3B] mb-3 px-1">{t("account.dangerZone")}</h2>
            <div className="rounded-2xl border border-[#C7654E]/30 bg-white p-5">
              <p className="flex items-center gap-2 text-[16px] font-semibold text-[#222824]">
                <AlertTriangle className="w-4 h-4 text-[#A44F3B]" aria-hidden="true" /> {t("account.deleteTitle")}
              </p>
              <p className="mt-1 text-[14px] text-[#6B736E]">{t("account.deleteBody")}</p>
              {!confirmDelete ? (
                <button type="button" data-testid="account-delete-btn" onClick={() => { setErr(null); setMsg(null); setConfirmDelete(true); }}
                  className="mt-4 inline-flex items-center gap-2 min-h-[44px] px-5 rounded-[15px] border border-[#C7654E]/50 text-[#A44F3B] font-semibold text-[15px] hover:bg-[#C7654E]/5 transition-colors">
                  <Trash2 className="w-4 h-4" aria-hidden="true" /> {t("account.deleteTitle")}
                </button>
              ) : (
                <div className="mt-4 space-y-3">
                  <p className="text-[14px] text-[#222824]">{t("account.deleteConfirm")}</p>
                  {busy ? (
                    <p className="flex items-center gap-2 text-[14px] text-[#6B736E]"><Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("account.deleting")}</p>
                  ) : (
                    <>
                      {providers.includes("google.com") && <div ref={reauthBtnRef} data-testid="account-reauth-google" className="min-h-[44px]" />}
                      {providers.includes("apple.com") && (
                        <button type="button" data-testid="account-reauth-apple-btn" onClick={handleAppleDelete} className={`w-full ${darkBtn}`}>
                          <AppleIcon /> {t("account.confirmAppleDelete")}
                        </button>
                      )}
                      {!providers.some((p) => p === "google.com" || p === "apple.com") && (
                        <div ref={reauthBtnRef} data-testid="account-reauth-google" className="min-h-[44px]" />
                      )}
                    </>
                  )}
                  <button type="button" data-testid="account-delete-cancel-btn" disabled={busy} onClick={() => setConfirmDelete(false)} className={`w-full ${btnLight}`}>
                    {t("account.cancel")}
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <div data-testid="account-guest" className="space-y-5">
          <section className="rounded-2xl bg-white border border-[#DEE2DE] p-6">
            <h2 className="text-[21px] font-serif font-semibold text-[#222824]">{t("more.saveProgressTitle")}</h2>
            <p className="mt-1 text-[15px] text-[#6B736E]">{t("account.guestBody")}</p>
            {busy ? (
              <p className="mt-5 flex items-center gap-2 text-[#6B736E]"><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> {t("account.connecting")}</p>
            ) : gisUnavailable ? (
              <p data-testid="account-gis-unavailable" className="mt-5 text-[14px] text-[#A44F3B]">{t("account.gisUnavailable")}</p>
            ) : (
              <div ref={googleBtnRef} data-testid="account-google-gis" className="mt-5 min-h-[44px]" />
            )}
            {APPLE_ENABLED && (
              appleConsent ? (
                <div data-testid="account-apple-consent" className="mt-3 rounded-2xl border border-[#DEE2DE] bg-[#F7F5F0] p-4">
                  <p className="text-[14px] text-[#222824]">{t("account.appleConsent")}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <button type="button" data-testid="account-apple-confirm-btn" disabled={busy} onClick={handleApple} className={`w-full ${darkBtn}`}>
                      <AppleIcon /> {t("account.continueApple")}
                    </button>
                    <button type="button" data-testid="account-apple-cancel-btn" disabled={busy} onClick={() => setAppleConsent(false)} className={`w-full ${btnLight}`}>
                      {t("account.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" data-testid="account-apple-btn" disabled={busy} onClick={() => { setErr(null); setMsg(null); setAppleConsent(true); }} className={`mt-3 w-full ${darkBtn}`}>
                  <AppleIcon /> {t("account.continueApple")}
                </button>
              )
            )}
          </section>
          <p className="text-center text-[14px] text-[#6B736E]">{t("account.noAccountNeeded")}</p>
        </div>
      )}
    </SecondaryPage>
  );
}
