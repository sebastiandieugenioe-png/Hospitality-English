import { useLocation } from "react-router-dom";
import { FileText } from "lucide-react";
import { SecondaryPage } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";

// Structural placeholder only: legal content is intentionally NOT written yet.
export default function Legal() {
  const { t } = useApp();
  const kind = useLocation().pathname === "/terms" ? "terms" : "privacy";
  return (
    <SecondaryPage title={t(`legal.${kind}`)} testid={`legal-${kind}-page`}>
      <div data-testid="legal-pending" className="rounded-2xl bg-white border border-[#DEE2DE] p-6 flex gap-4">
        <FileText className="w-5 h-5 text-[#6B736E] shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[15px] text-[#6B736E]">{t("legal.pending")}</p>
      </div>
    </SecondaryPage>
  );
}
