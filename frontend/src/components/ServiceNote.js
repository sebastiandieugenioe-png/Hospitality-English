import { AlertTriangle, Sparkles, MessageSquareQuote } from "lucide-react";

// Maps a service_rating to a discreet ES label + tone.
const RATING = {
  inappropriate: { label: "Inapropiado en servicio", warn: true },
  too_direct: { label: "Correcto, pero demasiado directo", warn: true },
  acceptable: { label: "Aceptable", warn: false },
  professional: { label: "Profesional", warn: false },
  excellent: { label: "Excelente", warn: false },
};

// Renders a small contextual "Service English" block, only when metadata exists.
export function ServiceNote({ item }) {
  const hasContent =
    item.service_rating ||
    item.service_note_es ||
    item.common_mistake_es ||
    (item.natural_alternatives && item.natural_alternatives.length);
  if (!hasContent) return null;

  const rating = RATING[item.service_rating] || null;
  const warn = rating?.warn;

  return (
    <div
      data-testid="service-note"
      className={`mt-3 rounded-lg border-l-2 pl-3 py-2 pr-3 text-sm ${
        warn
          ? "border-brand-terracotta bg-brand-terracotta/[0.06]"
          : "border-brand-forest bg-brand-success-muted/60"
      }`}
    >
      {rating && (
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
          {rating.label}
        </p>
      )}
      {item.service_note_es && (
        <p className="mt-1 text-brand-charcoal/75 leading-relaxed">{item.service_note_es}</p>
      )}
      {item.common_mistake_es && (
        <p className="mt-1 text-brand-charcoal/60 leading-relaxed">{item.common_mistake_es}</p>
      )}
      {item.natural_alternatives?.length > 0 && (
        <div className="mt-2">
          <p className="text-xs uppercase tracking-[0.12em] text-brand-charcoal/45 mb-1">
            Alternativa más profesional
          </p>
          {item.natural_alternatives.map((alt, i) => (
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
