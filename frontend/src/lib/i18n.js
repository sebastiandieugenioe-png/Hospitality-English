import es from "@/locales/es.json";
import it from "@/locales/it.json";

// Central language registry. Add a new language (+ locale file) here to enable it
// everywhere; components never hardcode the list.
export const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Spanish", native_name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italian", native_name: "Italiano", flag: "🇮🇹" },
];
export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = "es";

const LOCALES = { es, it };

export function detectBrowserLanguage() {
  const code = (navigator.language || "es").toLowerCase().split("-")[0];
  return SUPPORTED_CODES.includes(code) ? code : DEFAULT_LANGUAGE;
}

// Builds a t(key, vars) function for the given language, falling back to Spanish
// then to the key itself. Silent and robust.
export function makeT(lang) {
  const dict = LOCALES[lang] || LOCALES[DEFAULT_LANGUAGE];
  const base = LOCALES[DEFAULT_LANGUAGE];
  return (key, vars) => {
    let s = dict[key] ?? base[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
    return s;
  };
}

// Resolve a localized field on a content object. Supports both shapes:
//   grouped:  obj.translations.<lang>.<base>
//   suffix:   obj.<base>_<lang>
// Falls back silently to Spanish, then null. Never returns undefined.
export function getLocalizedField(obj, base, lang) {
  if (!obj) return null;
  const tr = obj.translations || {};
  if (tr[lang] && tr[lang][base] != null) return tr[lang][base];
  if (obj[`${base}_${lang}`] != null) return obj[`${base}_${lang}`];
  if (tr.es && tr.es[base] != null) return tr.es[base];
  if (obj[`${base}_es`] != null) return obj[`${base}_es`];
  return null;
}

// Resolve a { es: "…", it: "…" } string map (phrases, dialogue lines).
export function getText(map, lang) {
  if (!map) return null;
  return map[lang] ?? map.es ?? null;
}

// Localized multiple-choice options. Returns canonical options untouched when no
// translation exists (English target answers must never be translated).
export function getLocalizedOptions(q, lang) {
  const tr = q.translations || {};
  if (tr[lang] && tr[lang].options) return tr[lang].options;
  if (q[`options_${lang}`]) return q[`options_${lang}`];
  return q.options;
}
