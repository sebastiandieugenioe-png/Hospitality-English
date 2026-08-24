import { AlertTriangle, Sparkles, MessageSquareQuote } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getLocalizedField, getText } from "@/lib/i18n";

const WARN_RATINGS = new Set(["inappropriate", "too_direct"]);

// Renders a small contextual "Service English" block, only when metadata exists.
export function ServiceNote({ item }) {
  const { t, language } = useApp();
  const note = getLocalizedField(item, "service_note", language);
  const mistake = getLocalizedField(item, "common_mistake", language);
  const alternatives = getText(item.natural_alternatives_translations, language) || item.natural_alternatives;

  const hasContent = item.service_rating || note || mistake || (alternatives && alternatives.length);
  if (!hasContent) return null;

  const warn = WARN_RATINGS.has(item.service_rating);
  const ratingLabel = item.service_rating ? t(`serviceRating.${item.service_rating}`) : null;

  return (
    <div
      data-testid="service-note"
      className={`mt-3 rounded-lg border-l-2 pl-3 py-2 pr-3 text-sm ${
        warn
          ? "border-brand-terracotta bg-brand-terracotta/[0.06]"
          : "border-brand-forest bg-brand-success-muted/60"
      }`}
    >
      {ratingLabel && (
        <p
          className={`flex items-center gap-1.5 font-medium ${
            warn ? "text-brand-terracotta-hover" : "text-brand-forest"
          }`}
        >
          {warn ? (
            <AlertTriangle className="w-4 h-4 shrink-0" strokeWidth={2} />
          ) : (
            <Sparkles className="w-4 h-4 shrink-0" strokeWidth={2} />
          )}
          {ratingLabel}
        </p>
      )}
      {note && <p className="mt-1 text-brand-charcoal/75 leading-relaxed">{note}</p>}
      {mistake && <p className="mt-1 text-brand-charcoal/60 leading-relaxed">{mistake}</p>}
      {alternatives?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs uppercase tracking-[0.12em] text-brand-charcoal/45 mb-1">
            {t("serviceRating.alternative")}
          </p>
          {alternatives.map((alt, i) => (
            <p key={i} className="flex items-start gap-1.5 text-brand-espresso">
              <MessageSquareQuote className="w-4 h-4 mt-0.5 shrink-0 text-brand-forest" />
              <span>{alt}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default ServiceNote;
