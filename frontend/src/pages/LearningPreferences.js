import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SecondaryPage, Section, Row, btnDark } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";
import { updateProfile } from "@/lib/api";
import { getLocalizedField } from "@/lib/i18n";
import { useProfileTaxonomies, profileLabels } from "@/lib/useProfileLabels";

const EMPLOYMENT = ["looking_for_job", "interview_soon", "starting_new_job", "already_working"];
const EDITABLE = ["venue_type", "target_country", "goal", "employment_status"];

function SelectRow({ id, label, value, options, onChange }) {
  return (
    <li className="px-4 py-3">
      <label htmlFor={id} className="block text-[13px] text-[#6B736E]">{label}</label>
      <select
        id={id}
        data-testid={id}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full min-h-[48px] rounded-[12px] border border-[#DEE2DE] bg-white px-3 text-[16px] text-[#222824] focus:outline-none focus:ring-2 focus:ring-[#173D31]"
      >
        {!value && <option value="" disabled>—</option>}
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </li>
  );
}

export default function LearningPreferences() {
  const { t, language, profile, guestId, refreshGuest } = useApp();
  const tax = useProfileTaxonomies();
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (profile && !draft) setDraft({ ...profile }); }, [profile, draft]);

  const l = profileLabels(profile, tax, language, t);
  const opts = (list, key) => (list || []).map((x) => ({ value: x[key], label: getLocalizedField(x, "name", language) || x[key] }));
  const dirty = draft && profile && EDITABLE.some((k) => (draft[k] || null) !== (profile[k] || null));
  const set = (k) => (v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      // Full profile is sent so non-edited fields (role, english_level) are preserved.
      await updateProfile(guestId, {
        role: profile.role,
        venue_type: draft.venue_type,
        target_country: draft.target_country,
        goal: draft.goal,
        english_level: profile.english_level ?? null,
        employment_status: draft.employment_status || null,
      });
      await refreshGuest();
      toast.success(t("settings.saved"));
    } catch {
      toast.error(t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SecondaryPage title={t("settings.preferences")} testid="preferences-page">
      <p className="text-[15px] text-[#6B736E] px-1">{t("settings.preferencesIntro")}</p>
      <Section title={t("settings.fixed")} id="prefs-fixed">
        <Row label={t("settings.profession")} value={t("home.professionHospitality")} testid="prefs-profession" />
        <Row label={t("settings.role")} value={l.role} sub={t("settings.roleReadOnly")} testid="prefs-role" />
        {l.level && <Row label={t("settings.level")} value={l.level} testid="prefs-level" />}
      </Section>
      {draft && tax ? (
        <Section title={t("settings.personalization")} id="prefs-editable">
          <SelectRow id="prefs-venue" label={t("settings.venue")} value={draft.venue_type} options={opts(tax.venues, "slug")} onChange={set("venue_type")} />
          <SelectRow id="prefs-country" label={t("settings.country")} value={draft.target_country} options={opts(tax.countries, "id")} onChange={set("target_country")} />
          <SelectRow id="prefs-goal" label={t("settings.goal")} value={draft.goal} options={opts(tax.goals, "id")} onChange={set("goal")} />
          <SelectRow id="prefs-employment" label={t("settings.employment")} value={draft.employment_status}
            options={EMPLOYMENT.map((k) => ({ value: k, label: t(`onboarding.employment.${k}`) }))} onChange={set("employment_status")} />
        </Section>
      ) : (
        <div className="h-[280px] rounded-2xl bg-[#EEF3EF] animate-pulse" />
      )}
      <p className="text-[13px] text-[#6B736E] px-1">{t("settings.venueNote")}</p>
      <button type="button" data-testid="prefs-save-btn" disabled={!dirty || saving} onClick={save} className={`w-full ${btnDark}`}>
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {t("settings.save")}
      </button>
    </SecondaryPage>
  );
}
