import { Check } from "lucide-react";
import { SecondaryPage, Section } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

export default function Language() {
  const { t, language, setLanguage } = useApp();
  return (
    <SecondaryPage title={t("more.language")} testid="language-page">
      <Section title={t("settings.appLanguage")} id="language-list-title">
        {SUPPORTED_LANGUAGES.map((l) => {
          const active = l.code === language;
          return (
            <li key={l.code}>
              <button
                type="button"
                role="radio"
                aria-checked={active}
                data-testid={`language-option-${l.code}`}
                onClick={() => setLanguage(l.code)}
                className="w-full min-h-[56px] flex items-center gap-3 px-4 text-left hover:bg-[#F7F5F0] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#173D31]"
              >
                <span lang={l.code} className={`flex-1 text-[16px] ${active ? "text-[#173D31] font-semibold" : "text-[#222824]"}`}>{l.native_name}</span>
                {active && <Check className="w-5 h-5 text-[#173D31]" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </Section>
    </SecondaryPage>
  );
}
