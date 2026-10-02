import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, LogOut, Trash2, Mail, ShieldCheck, Loader2, AlertTriangle } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { Navbar } from "@/components/Navbar";
import { APPLE_ENABLED } from "@/lib/firebase";

export default function Account() {
  const navigate = useNavigate();
  const { account, isAuthenticated, signInWithGoogle, logout, deleteAccount } = useApp();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [err, setErr] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleGoogle = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await signInWithGoogle();
      if (r?.loaded_existing_account) setMsg("Your saved account progress has been loaded.");
      else setMsg("Your progress is now saved to your account.");
    } catch (e) {
      if (e?.code === "auth/popup-closed-by-user" || e?.code === "auth/cancelled-popup-request") {
        setErr(null);
      } else {
        setErr("Could not complete Google sign-in. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try { await logout(); setMsg(null); } catch (e) { setErr("Sign out failed. Please try again."); }
    finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setBusy(true); setErr(null);
    try {
      await deleteAccount();
      setConfirmDelete(false);
      setMsg("Your account and learning data have been deleted.");
    } catch (e) {
      setErr("Could not delete the account. Please try again.");
    } finally {
      setBusy(false);
    }
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
                  onClick={() => setConfirmDelete(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-terracotta text-white px-5 py-2.5 font-medium hover:opacity-90 transition-opacity"
                >
                  <Trash2 className="w-4 h-4" /> Delete account
                </button>
              ) : (
                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    data-testid="account-delete-confirm-btn"
                    disabled={busy}
                    onClick={handleDelete}
                    className="inline-flex items-center justify-center gap-2 flex-1 rounded-lg bg-brand-terracotta text-white px-5 py-2.5 font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Yes, delete everything
                  </button>
                  <button
                    data-testid="account-delete-cancel-btn"
                    disabled={busy}
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 rounded-lg border border-black/10 text-brand-charcoal/70 px-5 py-2.5 font-medium hover:bg-brand-sand transition-colors"
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
              <button
                data-testid="account-google-btn"
                disabled={busy}
                onClick={handleGoogle}
                className="mt-5 inline-flex items-center justify-center gap-3 w-full rounded-lg bg-brand-forest text-white px-6 py-3.5 font-medium hover:bg-brand-forest-hover disabled:opacity-40 transition-colors"
              >
                {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <GoogleGlyph />} Continue with Google
              </button>
              <button
                data-testid="account-apple-btn"
                disabled
                title="Apple Sign In is not available yet."
                className="mt-3 inline-flex items-center justify-center gap-3 w-full rounded-lg border border-black/10 text-brand-charcoal/40 px-6 py-3.5 font-medium cursor-not-allowed"
              >
                Continue with Apple
              </button>
              {!APPLE_ENABLED && (
                <p className="mt-2 text-xs text-brand-charcoal/40">Apple Sign In coming soon.</p>
              )}
            </div>
            <p className="text-center text-sm text-brand-charcoal/50">No account is required to keep learning.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.1-11.3-7.6l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.6l6.3 5.2C41.9 35.5 44 30.1 44 24c0-1.3-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
