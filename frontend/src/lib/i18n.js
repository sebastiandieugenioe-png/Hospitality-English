import es from "@/locales/es.json";
import it from "@/locales/it.json";
import fr from "@/locales/fr.json";
import pt from "@/locales/pt.json";
import de from "@/locales/de.json";
import pl from "@/locales/pl.json";
import ro from "@/locales/ro.json";
import uk from "@/locales/uk.json";
import nl from "@/locales/nl.json";
import en from "@/locales/en.json";

// Central language registry. Add a new language (+ locale file) here to enable it
// everywhere; components never hardcode the list.
export const SUPPORTED_LANGUAGES = [
  { code: "es", name: "Spanish", native_name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italian", native_name: "Italiano", flag: "🇮🇹" },
  { code: "fr", name: "French", native_name: "Français", flag: "🇫🇷" },
  { code: "pt", name: "Portuguese", native_name: "Português", flag: "🇵🇹" },
  { code: "de", name: "German", native_name: "Deutsch", flag: "🇩🇪" },
  { code: "pl", name: "Polish", native_name: "Polski", flag: "🇵🇱" },
  { code: "ro", name: "Romanian", native_name: "Română", flag: "🇷🇴" },
  { code: "uk", name: "Ukrainian", native_name: "Українська", flag: "🇺🇦" },
  { code: "nl", name: "Dutch", native_name: "Nederlands", flag: "🇳🇱" },
  { code: "en", name: "English", native_name: "English", flag: "🇬🇧" },
];
export const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);
export const DEFAULT_LANGUAGE = "es";

const LOCALES = { es, it, fr, pt, de, pl, ro, uk, nl, en };

// Generic locale resolution (reusable across EnglishToWork verticals).
// "pt-BR" -> "pt", "en_IE" -> "en"; returns "" for empty input.
export function normalizeLocale(raw) {
  return String(raw || "").trim().toLowerCase().split(/[-_]/)[0];
}

// First supported base language from a list of device locales, or null.
export function getSupportedLocale(list) {
  for (const raw of list || []) {
    const code = normalizeLocale(raw);
    if (SUPPORTED_CODES.includes(code)) return code;
  }
  return null;
}

function deviceLocales() {
  if (typeof navigator === "undefined") return [];
  return navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
}

// Priority: persisted choice (account/guest/local cache) -> device languages -> fallback.
export function resolveInterfaceLanguage({ persisted = [], device = deviceLocales() } = {}) {
  for (const p of persisted) if (SUPPORTED_CODES.includes(p)) return p;
  return getSupportedLocale(device) || DEFAULT_LANGUAGE;
}

// First use only: device language normalized to a supported one, else Spanish.
export function detectBrowserLanguage() {
  return getSupportedLocale(deviceLocales()) || DEFAULT_LANGUAGE;
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
