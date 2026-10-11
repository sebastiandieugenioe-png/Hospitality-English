import { Link, useNavigate } from "react-router-dom";
import { UserRound, SlidersHorizontal, Globe, CreditCard, ShieldCheck, LifeBuoy, MessageSquare, FileText, Scale, CircleCheck, Sparkles, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Section, Row, btnDark, focusRing } from "@/components/SettingsLayout";
import { usePremium } from "@/components/PremiumGate";
import { useApp } from "@/context/AppContext";
import { useBilling } from "@/context/BillingContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";
import { toolsFor } from "@/lib/toolRegistry";
import { useProfileTaxonomies, profileLabels } from "@/lib/useProfileLabels";

const PROFESSION = "hospitality";

function ProfileSummary({ isAuthenticated, name, subline, premium, t }) {
  const navigate = useNavigate();
  return (
    <section data-testid="more-profile-summary" data-auth={isAuthenticated ? "account" : "guest"} className="rounded-2xl bg-white border border-[#DEE2DE]">
      <Link to="/profile" data-testid="more-profile-link" className={`flex items-center gap-4 p-5 rounded-2xl hover:bg-[#F7F5F0] transition-colors ${focusRing}`}>
        <span className="grid place-items-center w-12 h-12 rounded-full bg-[#173D31] text-white shrink-0">
          <UserRound className="w-6 h-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span data-testid="more-profile-name" className="block font-serif text-[21px] font-semibold text-[#222824] truncate">{name}</span>
          {subline && <span className="block text-[14px] text-[#6B736E] truncate">{subline}</span>}
          <span data-testid="more-plan-status" className={`mt-1 inline-flex items-center gap-1 text-[13px] font-medium ${premium ? "text-[#34785B]" : "text-[#6B736E]"}`}>
            {premium && <CircleCheck className="w-3.5 h-3.5" aria-hidden="true" />}
            {premium ? t("more.planPremium") : t("more.planFree")}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />
      </Link>
      {!isAuthenticated && (
        <div className="px-5 pb-5 -mt-1">
          <p className="text-[14px] text-[#222824]">{t("more.saveProgress")}</p>
          <button type="button" data-testid="more-create-account-btn" onClick={() => navigate("/account")} className={`mt-3 w-full ${btnDark}`}>
            {t("more.createAccount")}
          </button>
        </div>
      )}
    </section>
  );
}

export default function More() {
  const { t, language, profile, account, isAuthenticated } = useApp();
  const billing = useBilling();
  const { requestPremium } = usePremium();
  const premium = billing.isPremium(PROFESSION);
  const tax = useProfileTaxonomies();
  const labels = profileLabels(profile, tax, language, t);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  const name = (isAuthenticated && account?.display_name) || (isAuthenticated ? t("more.yourAccount") : t("more.guest"));

  return (
    <AppShell title={t("more.title")}>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-6 pb-10 space-y-8" data-testid="more-page">
        <div className="space-y-3">
          <ProfileSummary isAuthenticated={isAuthenticated} name={name} subline={[labels.role, labels.country].filter(Boolean).join(" · ")} premium={premium} t={t} />
          {billing.ready && !premium && (
            <section data-testid="more-premium-cta" className="rounded-2xl bg-[#EEF3EF] border border-[#173D31]/15 p-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#173D31] shrink-0" aria-hidden="true" />
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-semibold text-[#173D31]">{t("home.premiumEyebrow")}</span>
                <span className="block text-[13px] text-[#222824]">{t("more.premiumSub")}</span>
              </span>
              <button type="button" data-testid="more-view-premium-btn" onClick={() => requestPremium()}
                className={`shrink-0 min-h-[44px] px-4 rounded-[15px] bg-[#173D31] text-white text-[14px] font-semibold hover:bg-[#102E25] transition-colors ${focusRing}`}>
                {t("more.viewPremium")}
              </button>
            </section>
          )}
        </div>

        <Section title={t("more.tools")} id="more-tools-title">
          {toolsFor(PROFESSION).map((tool) => (
            <Row key={tool.id} to={tool.route} icon={tool.icon} label={t(`tools.${tool.id}.title`)} sub={t(`tools.${tool.id}.sub`)} testid={`more-tool-${tool.id}`} />
          ))}
        </Section>

        <Section title={t("more.accountPrefs")} id="more-account-title">
          <Row to="/profile" icon={UserRound} label={t("settings.profile")} testid="more-profile" />
          <Row to="/learning-preferences" icon={SlidersHorizontal} label={t("settings.preferences")} testid="more-preferences" />
          <Row to="/language" icon={Globe} label={t("more.language")} value={current.native_name} testid="more-language" />
          <Row to="/subscription" icon={CreditCard} label={t("settings.subscription")} value={premium ? t("more.planPremiumShort") : t("more.planFreeShort")} testid="more-subscription" />
          <Row to="/account" icon={ShieldCheck} label={t("settings.account")} testid="more-account" />
        </Section>

        <Section title={t("more.support")} id="more-support-title">
          <Row to="/support" icon={LifeBuoy} label={t("support.title")} testid="more-help" />
          <Row to="/support/feedback" icon={MessageSquare} label={t("support.sendFeedback")} testid="more-feedback" />
        </Section>

        <Section title={t("more.legal")} id="more-legal-title">
          <Row to="/privacy" icon={FileText} label={t("legal.privacy")} testid="more-privacy" />
          <Row to="/terms" icon={Scale} label={t("legal.terms")} testid="more-terms" />
        </Section>
      </main>
    </AppShell>
  );
}
