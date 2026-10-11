import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Bug, CircleCheck, Loader2 } from "lucide-react";
import { SecondaryPage, Section, Row, btnDark, btnLight } from "@/components/SettingsLayout";
import { useApp } from "@/context/AppContext";
import { sendFeedback } from "@/lib/api";

const CATEGORIES = ["bug", "confusing", "suggestion", "other"];

export function Support() {
  const { t } = useApp();
  return (
    <SecondaryPage title={t("support.title")} testid="support-page">
      <p data-testid="support-intro" className="text-[15px] text-[#222824] px-1 leading-relaxed">{t("support.intro")}</p>
      <Section id="support-actions">
        <Row to="/support/feedback" icon={MessageSquare} label={t("support.sendFeedback")} sub={t("support.sendFeedbackSub")} testid="support-feedback" />
        <Row to="/support/feedback?category=bug" icon={Bug} label={t("support.reportProblem")} sub={t("support.reportProblemSub")} testid="support-report" />
      </Section>
    </SecondaryPage>
  );
}

export function Feedback() {
  const { t, guestId } = useApp();
  const navigate = useNavigate();
  const initial = new URLSearchParams(useLocation().search).get("category");
  const [category, setCategory] = useState(CATEGORIES.includes(initial) ? initial : null);
  const [message, setMessage] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error

  const submit = async (e) => {
    e.preventDefault();
    setState("sending");
    try {
      await sendFeedback({ guest_id: guestId || null, profession_id: "hospitality", category, message: message.trim(), route: "/support/feedback" });
      setState("sent");
    } catch {
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <SecondaryPage title={t("support.sendFeedback")} testid="feedback-page" back="/support">
        <div data-testid="feedback-sent" className="rounded-2xl bg-white border border-[#DEE2DE] p-6 text-center">
          <CircleCheck className="w-8 h-8 mx-auto text-[#34785B]" aria-hidden="true" />
          <p className="mt-3 text-[19px] font-serif font-semibold text-[#222824]">{t("support.thanks")}</p>
          <p className="mt-1 text-[15px] text-[#6B736E]">{t("support.thanksSub")}</p>
          <button type="button" data-testid="feedback-done-btn" onClick={() => navigate("/more")} className={`mt-5 w-full ${btnLight}`}>{t("review.done")}</button>
        </div>
      </SecondaryPage>
    );
  }

  return (
    <SecondaryPage title={t("support.sendFeedback")} testid="feedback-page" back="/support">
      <form onSubmit={submit} className="space-y-6">
        <fieldset>
          <legend className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-3 px-1">{t("support.category")}</legend>
          <div className="grid grid-cols-2 gap-2.5" role="radiogroup">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={category === c} data-testid={`feedback-category-${c}`} onClick={() => setCategory(c)}
                className={`min-h-[48px] rounded-[15px] border px-3 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31] ${
                  category === c ? "border-2 border-[#173D31] bg-[#EEF3EF] text-[#173D31]" : "border-[#DEE2DE] bg-white text-[#222824] hover:border-[#173D31]/40"
                }`}>
                {t(`support.cat.${c}`)}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor="feedback-message" className="block text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-3 px-1">{t("support.message")}</label>
          <textarea id="feedback-message" data-testid="feedback-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={4000} rows={6}
            placeholder={t("support.messagePlaceholder")}
            className="w-full rounded-[15px] border border-[#DEE2DE] bg-white px-4 py-3 text-[16px] text-[#222824] focus:outline-none focus:ring-2 focus:ring-[#173D31]" />
        </div>
        {state === "error" && <p data-testid="feedback-error" role="alert" className="text-[14px] text-[#A44F3B]">{t("support.sendError")}</p>}
        <button type="submit" data-testid="feedback-send-btn" disabled={!category || !message.trim() || state === "sending"} className={`w-full ${btnDark}`}>
          {state === "sending" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {t("support.send")}
        </button>
      </form>
    </SecondaryPage>
  );
}
