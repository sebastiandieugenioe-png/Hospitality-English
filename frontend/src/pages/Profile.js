import { Link } from "react-router-dom";
import { SecondaryPage, Section, Row, btnLight } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";
import { useProfileTaxonomies, profileLabels } from "@/lib/useProfileLabels";

export default function Profile() {
  const { t, language, profile, account, isAuthenticated } = useApp();
  const tax = useProfileTaxonomies();
  const l = profileLabels(profile, tax, language, t);
  const rows = [
    ["profession", t("settings.profession"), t("home.professionHospitality")],
    ["role", t("settings.role"), l.role],
    ["venue", t("settings.venue"), l.venue],
    ["country", t("settings.country"), l.country],
    ["goal", t("settings.goal"), l.goal],
    ["level", t("settings.level"), l.level],
    ["employment", t("settings.employment"), l.employment],
  ].filter(([, , v]) => v);

  return (
    <SecondaryPage title={t("settings.profile")} testid="profile-page">
      {isAuthenticated && (account?.display_name || account?.email) && (
        <Section title={t("settings.personal")} id="profile-personal">
          {account?.display_name && <Row label={t("settings.name")} value={account.display_name} testid="profile-name" />}
          {account?.email && <Row label={t("settings.email")} value={account.email} testid="profile-email" />}
        </Section>
      )}
      <Section title={t("settings.learningProfile")} id="profile-learning">
        {rows.map(([k, label, v]) => <Row key={k} label={label} value={v} testid={`profile-${k}`} />)}
      </Section>
      <Link to="/learning-preferences" data-testid="profile-edit-preferences-btn" className={`w-full ${btnLight}`}>
        {t("settings.editPreferences")}
      </Link>
    </SecondaryPage>
  );
}
