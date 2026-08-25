"""Idempotent multilingual overlay from the VERIFIED i18n import bundle.

Runs at startup AFTER seed_pack. It injects the interface-language translations
(es, it, fr, pt, de, pl, ro, uk, nl, en) onto the already-seeded content and
taxonomy documents, using the exact field shapes the existing resolvers already
support (_loc_field / getLocalizedField / getText / _loc_options).

Strictly interface-only. It NEVER modifies English learning content:
  - phrase english_content, dialogue english (spoken line), exercise sentence/words,
    canonical options, answer, answer_index, assessment_dimension, ids, slugs.
It only ADDS translations.* / *_<lang> fields. Spanish stays the fallback.

Idempotent: each doc is loaded, the overlay is applied in memory and the doc is
replaced, so re-running produces the same result (no duplication, no drift).
"""
import json
from pathlib import Path

BUNDLE_PATH = Path(__file__).parent / "data" / "mvp_i18n_import_bundle_verified_v1.json"
CATEGORIES_PACK_PATH = Path(__file__).parent / "data" / "mvp_categories_i18n_micro_pack_v1.json"
FINAL_GAPS_PACK_PATH = Path(__file__).parent / "data" / "mvp_final_i18n_gaps_micro_pack_v1.json"
V2_FILE_PATH = Path(__file__).parent / "data" / "hospitality_english_content_v2_emergent_single_file.json"

LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]

# The v2 bundle uses a slightly different key vocabulary; normalize it to the one
# this overlay already consumes (no second system).
_V2_KEY_NORMALIZE = {
    "lesson.intro.context": "intro.context",
    "lesson.intro.guest_opening": "intro.guest_opening",
    "lesson.intro.summary": "intro.summary",
    "exercise.prompt": "exercises.prompt",
    "exercise.explanation": "exercises.explanation",
}


def _normalize_key(key):
    if key in _V2_KEY_NORMALIZE:
        return _V2_KEY_NORMALIZE[key]
    if key and key.startswith("lesson.intro.objective."):
        return "intro.objectives." + key.rsplit(".", 1)[1]
    if key and key.startswith("exercise.option."):
        return "exercises.option." + key.rsplit(".", 1)[1]
    return key


def _load_bundle():
    with open(BUNDLE_PATH, encoding="utf-8") as f:
        return json.load(f)


def _load_v2_bundle():
    with open(V2_FILE_PATH, encoding="utf-8") as f:
        return json.load(f)["i18n_bundle"]


async def apply_skills_i18n(db):
    """Complete skill translations (fr, pt, de, pl, ro, uk, nl, en) from the final
    gaps micro-pack. Matches by stable id only; preserves base name, roles, order,
    active and the existing es/it translations. Adds grouped translations.<lang>.{name,
    description} (getLocalizedField resolves, ES fallback). Idempotent."""
    with open(FINAL_GAPS_PACK_PATH, encoding="utf-8") as f:
        pack = json.load(f)
    for sk in pack["skills"]:
        doc = await db.skills.find_one({"id": sk["id"]})
        if not doc:
            continue
        doc.setdefault("translations", {})
        for lang, vals in sk["translations"].items():
            doc["translations"].setdefault(lang, {})
            doc["translations"][lang]["name"] = vals["name"]
            doc["translations"][lang]["description"] = vals["description"]
        doc_id = doc["_id"]
        doc.pop("_id", None)
        await db.skills.replace_one({"_id": doc_id}, doc)


async def apply_mc_option_gaps(db):
    """Fill the remaining MC option translation gaps from the final gaps micro-pack.
    Matches by question_id + index only; NEVER compacts sparse arrays and NEVER
    rebuilds from present translations alone. For each language the options array
    keeps the canonical length/order; only the specified missing indices are set
    (preserve_english_target_verbatim entries keep the English text verbatim, which
    is intentional English learning content). answer_index/options are never touched.
    Idempotent."""
    with open(FINAL_GAPS_PACK_PATH, encoding="utf-8") as f:
        pack = json.load(f)
    langs = ["it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
    by_slug = {}
    for e in pack["mc_option_gaps"]:
        by_slug.setdefault(e["situation_slug"], []).append(e)

    for slug, entries in by_slug.items():
        lesson = await db.lessons.find_one({"situation_slug": slug})
        if not lesson:
            continue
        for e in entries:
            section = "exercises" if e["section"] in ("exercise", "exercises") else "quiz"
            q = next((x for x in lesson.get(section, []) if x.get("id") == e["question_id"]), None)
            if not q:
                continue
            canonical = q.get("options") or []
            q.setdefault("translations", {})
            for lang in langs:
                q["translations"].setdefault(lang, {})
                opts = q["translations"][lang].get("options")
                if not opts or len(opts) != len(canonical):
                    # start from canonical (English) so length/order stay exact and
                    # any already-bundled translations for this lang are preserved.
                    opts = list(canonical)
                for mo in e["missing_options"]:
                    idx = mo["index"]
                    if 0 <= idx < len(opts):
                        opts[idx] = mo["translations"][lang]
                q["translations"][lang]["options"] = opts
        lesson_id = lesson["_id"]
        lesson.pop("_id", None)
        await db.lessons.replace_one({"_id": lesson_id}, lesson)


async def apply_categories_i18n(db):
    """Localize the categories collection from the verified micro-pack.
    Matches by stable slug only; preserves _id, slug, icon, order and the current
    name_en / name_es / description_es fields. Adds grouped translations.<lang>.{name,
    description} (the shape getLocalizedField already resolves, ES fallback). Idempotent."""
    with open(CATEGORIES_PACK_PATH, encoding="utf-8") as f:
        pack = json.load(f)
    for cat in pack["categories"]:
        doc = await db.categories.find_one({"slug": cat["slug"]})
        if not doc:
            continue
        doc.setdefault("translations", {})
        for lang, vals in cat["translations"].items():
            doc["translations"].setdefault(lang, {})
            doc["translations"][lang]["name"] = vals["name"]
            doc["translations"][lang]["description"] = vals["description"]
        doc_id = doc["_id"]
        doc.pop("_id", None)
        await db.categories.replace_one({"_id": doc_id}, doc)


def _build_lookup(bundle):
    """(situation_slug, key, item_id, index) -> translations dict (per language).

    Also returns a speaker-label map {es_label: translations} built from the
    verified dialogue.speaker_label entries, so the pack dialogues (whose generic
    role labels are identical Spanish strings) reuse the SAME bundle translations
    instead of staying Spanish. This reuses verified data, it does not invent it.
    """
    content, taxonomy, speaker_labels = {}, {}, {}
    for e in bundle["entries"]:
        tr = e["translations"]
        for r in e["references"]:
            src = r.get("source")
            if src in ("mvp_content_pack_v1", "legacy_export", "mvp_content_pack_v2_30"):
                key = _normalize_key(r.get("key"))
                item_id = r.get("item_id")
                idx = r.get("index")
                # For item_id-scoped scalar fields (prompt/explanation/phrase text &
                # metadata) the numeric index is redundant; drop it so the existing
                # item_id-keyed lookups match. Option arrays keep their index.
                if item_id is not None and ".option." not in (key or ""):
                    idx = None
                content[(r.get("situation_slug"), key, item_id, idx)] = tr
                if key == "dialogue.speaker_label":
                    speaker_labels[tr["es"]] = tr
            elif src == "taxonomies":
                taxonomy[(r.get("taxonomy"), r.get("id"), r.get("key"))] = tr
    return content, taxonomy, speaker_labels


def _set_grouped(obj, field, tr):
    obj.setdefault("translations", {})
    for lang in LANGS:
        obj["translations"].setdefault(lang, {})
        obj["translations"][lang][field] = tr[lang]


def _set_string_map(obj, tr):
    obj.setdefault("translations", {})
    for lang in LANGS:
        obj["translations"][lang] = tr[lang]


def _set_suffix(obj, field, tr):
    for lang in LANGS:
        obj[f"{field}_{lang}"] = tr[lang]


def _set_objectives(intro, slug, lookup):
    by_lang = {lang: {} for lang in LANGS}
    for (s, key, _iid, idx), tr in lookup.items():
        if s == slug and key and key.startswith("intro.objectives."):
            for lang in LANGS:
                by_lang[lang][idx] = tr[lang]
    intro.setdefault("translations", {})
    for lang, m in by_lang.items():
        if m:
            intro["translations"].setdefault(lang, {})
            intro["translations"][lang]["objectives"] = [m[i] for i in sorted(m)]


def _set_options(q, slug, section, qid, lookup):
    by_lang = {lang: {} for lang in LANGS}
    prefix = f"{section}.option."
    for (s, key, iid, idx), tr in lookup.items():
        if s == slug and iid == qid and key and key.startswith(prefix):
            for lang in LANGS:
                by_lang[lang][idx] = tr[lang]
    for lang, m in by_lang.items():
        if m:
            q.setdefault("translations", {})
            q["translations"].setdefault(lang, {})
            # Position-preserving: start from the canonical options and override only
            # the indices the bundle provides. The bundle intentionally omits English
            # target options, which correctly stay English. Never truncate or shift.
            merged = list(q.get("options") or [])
            for i, txt in m.items():
                if 0 <= i < len(merged):
                    merged[i] = txt
            q["translations"][lang]["options"] = merged


def _apply_phrase(p, slug, lookup):
    pid = p.get("id")
    tr = lookup.get((slug, "phrase.text", pid, None))
    if tr:
        _set_string_map(p, tr)
    for meta in ("service_note", "common_mistake", "context"):
        trm = lookup.get((slug, f"phrase.{meta}", pid, None))
        if trm:
            _set_suffix(p, meta, trm)


async def apply_i18n_bundle(db):
    bundle = _load_bundle()
    v2 = _load_v2_bundle()
    combined = {"entries": bundle["entries"] + v2["entries"]}
    content, taxonomy, speaker_labels = _build_lookup(combined)

    slugs = sorted({k[0] for k in content if k[0]})

    for slug in slugs:
        # ----- situation -----
        sit = await db.situations.find_one({"slug": slug})
        if sit:
            for field in ("title", "description"):
                tr = content.get((slug, f"situation.{field}", None, None))
                if tr:
                    _set_grouped(sit, field, tr)
            sit.pop("_id", None)
            await db.situations.replace_one({"slug": slug}, sit)

        # ----- lesson -----
        lesson = await db.lessons.find_one({"situation_slug": slug})
        if not lesson:
            continue

        intro = lesson.get("intro") or {}
        for field in ("context", "guest_opening", "summary"):
            tr = content.get((slug, f"intro.{field}", None, None))
            if tr:
                _set_grouped(intro, field, tr)
        _set_objectives(intro, slug, content)
        lesson["intro"] = intro

        for n, line in enumerate(lesson.get("dialogue", [])):
            tr = content.get((slug, "dialogue.text", None, n))
            if tr:
                _set_string_map(line, tr)
            trl = content.get((slug, "dialogue.speaker_label", None, n))
            if not trl:
                # Pack dialogues have no per-line label ref; reuse the verified
                # translations for the identical Spanish role label.
                trl = speaker_labels.get(line.get("speaker_label_es"))
            if trl:
                _set_suffix(line, "speaker_label", trl)

        for p in lesson.get("phrases", []):
            _apply_phrase(p, slug, content)

        for section in ("exercises", "quiz"):
            for q in lesson.get(section, []):
                qid = q.get("id")
                for field in ("prompt", "explanation"):
                    tr = content.get((slug, f"{section}.{field}", qid, None))
                    if tr:
                        _set_grouped(q, field, tr)
                _set_options(q, slug, section, qid, content)

        lesson.pop("_id", None)
        await db.lessons.replace_one({"situation_slug": slug}, lesson)

        # ----- learning_items mirror phrase text + metadata -----
        for p in lesson.get("phrases", []):
            pid = p.get("id")
            fields = {}
            if "translations" in p:
                fields["translations"] = p["translations"]
            for meta in ("service_note", "common_mistake", "context"):
                for lang in LANGS:
                    k = f"{meta}_{lang}"
                    if k in p:
                        fields[k] = p[k]
            if fields:
                await db.learning_items.update_one({"id": pid}, {"$set": fields})

    # ----- taxonomies -----
    tax_ids = {(t, i) for (t, i, _k) in taxonomy}
    for (tax, rid) in tax_ids:
        doc = await db[tax].find_one({"$or": [{"slug": rid}, {"id": rid}]})
        if not doc:
            continue
        for field in ("name", "description"):
            tr = taxonomy.get((tax, rid, field))
            if tr:
                _set_grouped(doc, field, tr)
        doc_id = doc["_id"]
        doc.pop("_id", None)
        await db[tax].replace_one({"_id": doc_id}, doc)

    # ----- categories (verified micro-pack) -----
    await apply_categories_i18n(db)

    # ----- final i18n gaps micro-pack: skills + remaining MC option translations -----
    await apply_skills_i18n(db)
    await apply_mc_option_gaps(db)
