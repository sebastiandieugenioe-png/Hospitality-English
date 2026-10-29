import { useState } from "react";
import { Check, CircleCheck, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { SecondaryPage, btnDark, btnLight } from "@/components/SettingsLayout";
import { usePremium } from "@/components/PremiumGate";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { billingConfigFor } from "@/lib/billingConfig";
import { refreshEntitlement } from "@/lib/api";
import { isNative } from "@/lib/platform";

const PROFESSION = "hospitality";
const pkgProductId = (p) => (p ? ((p.rcBillingProduct || p.webBillingProduct)?.identifier || p.identifier || null) : null);

export default function Subscription() {
  const { t, language, isAuthenticated } = useApp();
  const billing = useBilling();
  const { requestPremium, requestRestore } = usePremium();
  const premium = billing.isPremium(PROFESSION);
  const benefits = ["subscription.benefitSituations", "subscription.benefitListening", "subscription.benefitSpeaking", "subscription.benefitReview"];
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState(null); // { kind: "info" | "error", text }

  // Web: re-read the signed-in account's subscription (NOT a store restore).
  const checkStatus = async () => {
    setChecking(true); setCheckMsg(null);
    try {
      const active = await billing.refresh(PROFESSION);
      if (active) { try { await refreshEntitlement(); } catch { /* backend re-verifies on next request */ } }
      else setCheckMsg({ kind: "info", text: t("subscription.noPremiumFound") });
    } catch {
      setCheckMsg({ kind: "error", text: t("subscription.checkFailed") });
    } finally {
      setChecking(false);
    }
  };

  if (billing.status === "loading" || billing.status === "uninitialized") {
    return (
      <SecondaryPage title={t("settings.subscription")} testid="subscription-page">
        <p data-testid="subscription-loading" role="status" aria-live="polite" className="flex items-center gap-2 text-[15px] text-[#6B736E]">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {t("common.loading")}
        </p>
      </SecondaryPage>
    );
  }

  if (premium) {
    const ent = billing.customerInfo?.entitlements?.active?.[billingConfigFor(PROFESSION)?.entitlementId] || null;
    const off = billing.currentOffering(PROFESSION);
    const pid = ent?.productIdentifier;
    const period = pid && pid === pkgProductId(off?.monthly) ? t("subscription.monthly") : pid && pid === pkgProductId(off?.annual) ? t("subscription.annual") : null;
    const exp = ent?.expirationDate ? new Date(ent.expirationDate) : null;
    const date = exp && !Number.isNaN(exp.getTime()) ? new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(exp) : null;
    const manageUrl = billing.customerInfo?.managementURL || null;
    return (
      <SecondaryPage title={t("settings.subscription")} testid="subscription-page">
        <section data-testid="subscription-premium" className="rounded-2xl bg-white border border-[#DEE2DE] p-6">
          <p className="flex items-center gap-2 text-[19px] font-serif font-semibold text-[#222824]">
            <CircleCheck className="w-5 h-5 text-[#34785B]" aria-hidden="true" /> {t("home.premiumEyebrow")}
          </p>
          <p className="mt-1 text-[15px] text-[#6B736E]">{t("subscription.allUnlocked")}</p>
          {(period || date) && (
            <dl className="mt-4 space-y-1 text-[14px]">
              {period && <div className="flex justify-between gap-3"><dt className="text-[#6B736E]">{t("subscription.plan")}</dt><dd data-testid="subscription-period" className="text-[#222824] font-medium">{period}</dd></div>}
              {date && <div className="flex justify-between gap-3"><dt className="text-[#6B736E]">{ent?.willRenew ? t("subscription.renews") : t("subscription.expires")}</dt><dd data-testid="subscription-date" className="text-[#222824] font-medium">{date}</dd></div>}
            </dl>
          )}
          {manageUrl && (
            <a href={manageUrl} target="_blank" rel="noopener noreferrer" data-testid="subscription-manage-btn" className={`mt-5 w-full ${btnLight}`}>
              {t("subscription.manage")} <ExternalLink className="w-4 h-4" aria-hidden="true" />
            </a>
          )}
        </section>
      </SecondaryPage>
    );
  }

  return (
    <SecondaryPage title={t("settings.subscription")} testid="subscription-page">
      <section data-testid="subscription-free" className="rounded-2xl bg-white border border-[#DEE2DE] p-6">
        <p className="text-[13px] uppercase tracking-[0.15em] font-semibold text-[#6B736E]">{t("subscription.current")}</p>
        <p className="mt-1 text-[21px] font-serif font-semibold text-[#222824]">{t("more.planFreeShort")}</p>
        <p className="mt-1 text-[15px] text-[#6B736E]">{t("subscription.freeAccess")}</p>
      </section>
      <section data-testid="subscription-benefits" className="rounded-2xl bg-[#EEF3EF] border border-[#173D31]/15 p-6">
        <p className="text-[19px] font-serif font-semibold text-[#173D31]">{t("home.premiumEyebrow")}</p>
        <ul className="mt-3 space-y-2">
          {benefits.map((k) => (
            <li key={k} className="flex items-start gap-2 text-[15px] text-[#222824]">
              <Check className="w-5 h-5 text-[#34785B] shrink-0" aria-hidden="true" /> {t(k)}
            </li>
          ))}
        </ul>
        {billing.status === "error" && (
          <p data-testid="subscription-unavailable" role="status" className="mt-4 text-[14px] text-[#6B736E]">{t("paywall.unavailable")}</p>
        )}
        <button type="button" data-testid="subscription-upgrade-btn" disabled={!billing.ready} onClick={() => requestPremium()} className={`mt-5 w-full ${btnDark}`}>
          {t("subscription.upgrade")}
        </button>
      </section>
      {isNative() && (
        <button type="button" data-testid="subscription-restore-btn" onClick={requestRestore} className={`w-full ${btnLight}`}>
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> {t("paywall.restore")}
        </button>
      )}
      {isAuthenticated && !isNative() && (
        <section className="space-y-3">
          <button type="button" data-testid="subscription-check-status-btn" disabled={checking} aria-busy={checking} onClick={checkStatus} className={`w-full ${btnLight}`}>
            {checking ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="w-4 h-4" aria-hidden="true" />} {t("subscription.checkStatus")}
          </button>
          {checkMsg && (
            <p data-testid="subscription-check-msg" role={checkMsg.kind === "error" ? "alert" : "status"}
              className={`text-[14px] ${checkMsg.kind === "error" ? "text-[#A44F3B]" : "text-[#6B736E]"}`}>{checkMsg.text}</p>
          )}
        </section>
      )}
    </SecondaryPage>
  );
}
