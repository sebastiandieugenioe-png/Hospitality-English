// Minimal /more shell: surfaces secondary tools + account + language that moved
// out of the root top nav. Uses existing routes/logic only (no redesign yet).
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ClipboardCheck, Moon, Briefcase, CalendarCheck, Siren,
  UserCircle, Globe, Check, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/context/AppContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

function Row({ to, onClick, icon: Icon, label, testid, trailing }) {
  const inner = (
    <div className="flex items-center gap-4 px-5 py-4">
      <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#EEF3EF] text-[#173D31] shrink-0">
        <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <span className="flex-1 text-[16px] text-[#222824]">{label}</span>
      {trailing || <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />}
    </div>
  );
  const cls = "block bg-white border border-[#DEE2DE] rounded-2xl hover:border-[#173D31]/30 transition-colors";
  return to ? (
    <Link to={to} data-testid={testid} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} data-testid={testid} className={`${cls} w-full text-left`}>{inner}</button>
  );
}

export default function More() {
  const { t, language, setLanguage } = useApp();
  const [langOpen, setLangOpen] = useState(false);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  const tools = [
    { to: "/assessment", icon: ClipboardCheck, label: t("more.assessment"), testid: "more-assessment" },
    { to: "/tonights-shift", icon: Moon, label: t("more.tonightsShift"), testid: "more-tonights-shift" },
    { to: "/job-interview", icon: Briefcase, label: t("more.jobInterview"), testid: "more-job-interview" },
    { to: "/first-week", icon: CalendarCheck, label: t("more.firstWeek"), testid: "more-first-week" },
    { to: "/emergency", icon: Siren, label: t("more.emergency"), testid: "more-emergency" },
  ];

  return (
    <AppShell title={t("more.title")}>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 py-8 space-y-8">
        <section>
          <h2 className="text-xs uppercase tracking-[0.15em] text-[#6B736E] font-semibold mb-3 px-1">
            {t("more.tools")}
          </h2>
          <div className="space-y-3">
            {tools.map((it) => <Row key={it.to} {...it} />)}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.15em] text-[#6B736E] font-semibold mb-3 px-1">
            {t("more.account")}
          </h2>
          <div className="space-y-3">
            <Row to="/account" icon={UserCircle} label={t("more.accountProfile")} testid="more-account" />
            <div data-testid="more-language-block">
              <Row
                onClick={() => setLangOpen((v) => !v)}
                icon={Globe}
                label={t("more.language")}
                testid="more-language"
                trailing={<span className="text-sm text-[#6B736E] shrink-0">{current.native_name}</span>}
              />
              {langOpen && (
                <div data-testid="more-language-menu" className="mt-2 bg-white border border-[#DEE2DE] rounded-2xl overflow-hidden">
                  {SUPPORTED_LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      data-testid={`more-language-option-${l.code}`}
                      onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                      className={`flex items-center gap-3 w-full text-left px-5 py-3 text-[15px] transition-colors hover:bg-[#EEF3EF] ${
                        l.code === language ? "text-[#173D31] font-medium" : "text-[#222824]"
                      }`}
                    >
                      <span aria-hidden="true">{l.flag}</span>
                      <span className="flex-1">{l.native_name}</span>
                      {l.code === language && <Check className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </AppShell>
  );
}
