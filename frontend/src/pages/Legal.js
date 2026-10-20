import { Link, useLocation } from "react-router-dom";
import { SecondaryPage } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";
import { privacyPolicy } from "@/legal/privacyPolicy";
import { termsOfService } from "@/legal/termsOfService";
import { accountDeletion } from "@/legal/accountDeletion";

const DOCS = {
  "/privacy": { kind: "privacy", doc: privacyPolicy, titleKey: "legal.privacy" },
  "/terms": { kind: "terms", doc: termsOfService, titleKey: "legal.terms" },
  "/account-deletion": { kind: "account-deletion", doc: accountDeletion, titleKey: "legal.accountDeletion" },
};
const OWNER = "OWNER_ACTION_REQUIRED";

// Highlights owner placeholders and turns in-app paths into links.
function Rich({ text }) {
  return text.split(/(OWNER_ACTION_REQUIRED|\/privacy\b|\/account-deletion\b|\/account\b)/).map((part, i) => {
    if (part === OWNER) return <mark key={i} data-testid="legal-owner-placeholder" className="bg-[#FBE7C6] text-[#7A4A12] px-1 rounded">{part}</mark>;
    if (["/privacy", "/account-deletion", "/account"].includes(part)) return <Link key={i} to={part} className="underline text-[#173D31]">{part}</Link>;
    return part;
  });
}

function Section({ s }) {
  return (
    <section className="space-y-2">
      <h2 className="font-serif text-[19px] font-semibold text-[#222824]">{s.h}</h2>
      {(s.list ? [] : s.p || []).map((p, i) => <p key={i}><Rich text={p} /></p>)}
      {s.list && (
        <ul className="list-disc pl-5 space-y-1.5">
          {s.list.map((li, i) => <li key={i}><Rich text={li} /></li>)}
        </ul>
      )}
      {s.list && (s.p || []).map((p, i) => <p key={`p${i}`}><Rich text={p} /></p>)}
    </section>
  );
}

export default function Legal() {
  const { t } = useApp();
  const { kind, doc, titleKey } = DOCS[useLocation().pathname] || DOCS["/privacy"];
  return (
    <SecondaryPage title={t(titleKey)} testid={`legal-${kind}-page`}>
      <article data-testid="legal-document" lang="en" className="rounded-2xl bg-white border border-[#DEE2DE] p-5 sm:p-7 space-y-6 text-[15px] leading-relaxed text-[#3A403C] [overflow-wrap:anywhere]">
        <header className="space-y-2">
          <h1 className="font-serif text-[26px] font-semibold text-[#222824]">{doc.title}</h1>
          <p className="text-[13px] text-[#6B736E]"><Rich text={doc.updated} /></p>
          {t("legal.englishOnly") && <p data-testid="legal-english-note" lang="" className="text-[13px] text-[#6B736E]">{t("legal.englishOnly")}</p>}
        </header>
        {doc.intro.map((p, i) => <p key={i}><Rich text={p} /></p>)}
        {doc.sections.map((s) => <Section key={s.h} s={s} />)}
      </article>
    </SecondaryPage>
  );
}
