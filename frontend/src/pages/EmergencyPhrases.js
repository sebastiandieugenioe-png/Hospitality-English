import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Search, Bookmark, BookmarkCheck, ChevronDown, LifeBuoy } from "lucide-react";
import Navbar from "@/components/Navbar";
import { useApp } from "@/context/AppContext";
import { getText } from "@/lib/i18n";
import { getEmergency } from "@/lib/api";

// Map the profile venue slug to the pack's human venue labels (tie-break only).
const VENUE_LABEL = {
  pub: "pub",
  cafe: "cafe",
  "casual-restaurant": "casual restaurant",
  "fine-dining": "fine dining",
  "cocktail-bar": "cocktail bar",
  "hotel-restaurant": "hotel 4–5 star",
};

export default function EmergencyPhrases() {
  const { language, profile, savedPhraseIds, t } = useApp();
  const [pack, setPack] = useState(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    getEmergency().then(setPack).catch(() => {});
  }, []);

  const tx = (key) => (pack ? getText(pack.ui[key], language) : "");
  const catName = (key) => {
    const c = pack?.categories.find((x) => x.key === key);
    return c ? getText(c.translations, language) : key;
  };

  const role = profile?.role;
  const venueLabel = VENUE_LABEL[profile?.venue_type];

  const q = query.trim().toLowerCase();
  const searchActive = q.length > 0 || category !== "all";

  const matches = (p) => {
    if (category !== "all" && p.category !== category) return false;
    if (!q) return true;
    const m = (getText(p.meaning, language) || "").toLowerCase();
    return p.phrase_en.toLowerCase().includes(q) || m.includes(q);
  };

  const phrases = useMemo(() => pack?.phrases || [], [pack]);

  const results = useMemo(() => phrases.filter(matches), [phrases, q, category, language]); // eslint-disable-line

  const forYou = useMemo(() => {
    const sortFn = (a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      const av = venueLabel && a.venue_types?.includes(venueLabel) ? 0 : 1;
      const bv = venueLabel && b.venue_types?.includes(venueLabel) ? 0 : 1;
      return av - bv;
    };
    const list = role ? phrases.filter((p) => (p.roles || []).includes(role)) : [...phrases];
    return list.sort(sortFn);
  }, [phrases, role, venueLabel]);

  const savedPhrases = useMemo(
    () => phrases.filter((p) => savedPhraseIds.includes(p.id)),
    [phrases, savedPhraseIds]
  );

  const allSorted = useMemo(() => {
    const order = {};
    (pack?.categories || []).forEach((c) => (order[c.key] = c.order));
    return [...phrases].sort((a, b) => (order[a.category] - order[b.category]) || (a.priority - b.priority));
  }, [phrases, pack]);

  if (!pack) {
    return (
      <div className="min-h-screen bg-brand-sand">
        <Navbar />
        <main className="max-w-3xl mx-auto px-5 sm:px-8 py-10">
          <p className="text-brand-charcoal/50">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-sand">
      <Navbar />
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 sm:py-12">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <span className="grid place-items-center w-14 h-14 rounded-2xl bg-brand-terracotta/15 text-brand-terracotta-hover">
            <LifeBuoy className="w-7 h-7" />
          </span>
          <h1 data-testid="emergency-title" className="mt-5 text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
            {tx("title")}
          </h1>
          <p className="mt-2 text-base text-brand-charcoal/70 leading-relaxed">{tx("subtitle")}</p>
        </motion.div>

        {/* Search */}
        <div className="mt-6 relative">
          <Search className="w-5 h-5 text-brand-charcoal/40 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            data-testid="emergency-search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tx("search_placeholder")}
            className="w-full rounded-xl border border-black/10 bg-white pl-12 pr-4 py-3.5 text-brand-espresso focus:outline-none focus:ring-2 focus:ring-brand-forest"
          />
        </div>

        {/* Category filters */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Chip testId="emergency-filter-all" active={category === "all"} onClick={() => setCategory("all")}>
            {tx("all_categories")}
          </Chip>
          {pack.categories.map((c) => (
            <Chip
              key={c.key}
              testId={`emergency-filter-${c.key}`}
              active={category === c.key}
              onClick={() => setCategory(c.key)}
            >
              {catName(c.key)}
            </Chip>
          ))}
        </div>

        {searchActive ? (
          <section className="mt-8" data-testid="emergency-results">
            {results.length === 0 ? (
              <p className="text-brand-charcoal/50">{t("practice.emptyCategory")}</p>
            ) : (
              <div className="space-y-3">
                {results.map((p) => (
                  <PhraseCard key={p.id} p={p} language={language} catName={catName} tx={tx} />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {savedPhrases.length > 0 && (
              <Section title={tx("saved")} testId="emergency-section-saved">
                {savedPhrases.map((p) => (
                  <PhraseCard key={p.id} p={p} language={language} catName={catName} tx={tx} />
                ))}
              </Section>
            )}

            <Section title={tx("for_you")} testId="emergency-section-foryou">
              {forYou.map((p) => (
                <PhraseCard key={p.id} p={p} language={language} catName={catName} tx={tx} />
              ))}
            </Section>

            <Section title={tx("all_categories")} testId="emergency-section-all">
              {allSorted.map((p) => (
                <PhraseCard key={p.id} p={p} language={language} catName={catName} tx={tx} />
              ))}
            </Section>
          </>
        )}
      </main>
    </div>
  );
}

function Section({ title, testId, children }) {
  return (
    <section className="mt-9" data-testid={testId}>
      <h2 className="text-sm uppercase tracking-[0.15em] font-semibold text-brand-charcoal/50 mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Chip({ children, active, onClick, testId }) {
  return (
    <button
      data-testid={testId}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium border transition-all ${
        active
          ? "bg-brand-forest text-white border-brand-forest"
          : "bg-white text-brand-charcoal border-black/10 hover:border-brand-forest/40"
      }`}
    >
      {children}
    </button>
  );
}

function PhraseCard({ p, language, catName, tx }) {
  const { savedPhraseIds, saveEmergencyPhrase, removeEmergencyPhrase } = useApp();
  const [open, setOpen] = useState(false);
  const isSaved = savedPhraseIds.includes(p.id);

  const toggleSave = (e) => {
    e.stopPropagation();
    if (isSaved) removeEmergencyPhrase(p.id);
    else saveEmergencyPhrase(p.id);
  };

  return (
    <div data-testid={`emergency-phrase-${p.id}`} className="rounded-2xl bg-white border border-black/5 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-5 py-4 flex items-start justify-between gap-4"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/40 mb-1">{catName(p.category)}</p>
          <p data-testid={`emergency-phrase-en-${p.id}`} className="text-lg text-brand-espresso font-medium">
            {p.phrase_en}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span
            role="button"
            tabIndex={0}
            data-testid={`emergency-save-btn-${p.id}`}
            onClick={toggleSave}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && toggleSave(e)}
            aria-label={isSaved ? tx("remove_saved") : tx("save")}
            className={`grid place-items-center w-9 h-9 rounded-lg transition-colors ${
              isSaved ? "bg-brand-success-muted text-brand-forest" : "text-brand-charcoal/40 hover:text-brand-forest"
            }`}
          >
            {isSaved ? <BookmarkCheck className="w-5 h-5" /> : <Bookmark className="w-5 h-5" />}
          </span>
          <ChevronDown className={`w-5 h-5 text-brand-charcoal/30 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      {open && (
        <div data-testid={`emergency-phrase-detail-${p.id}`} className="px-5 pb-5 pt-1 border-t border-black/5">
          <div className="mt-3">
            <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/40">{tx("meaning")}</p>
            <p data-testid={`emergency-phrase-meaning-${p.id}`} className="mt-1 text-brand-charcoal">
              {getText(p.meaning, language)}
            </p>
          </div>
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-[0.15em] text-brand-charcoal/40">{tx("when_to_use")}</p>
            <p data-testid={`emergency-phrase-usenote-${p.id}`} className="mt-1 text-sm text-brand-charcoal/70">
              {getText(p.use_note, language)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
