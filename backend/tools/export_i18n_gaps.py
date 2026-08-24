"""Read-only export of remaining i18n gaps (skills, MC option coverage, category
situation_count). Does NOT modify code or DB. Produces mvp_i18n_gaps_export_v1.json.

Option coverage is derived from the VERIFIED bundle (the source of truth for what
has actually been translated); canonical options + answer_index come from the live
lesson docs. Original option indices are preserved (no sparse compaction).
"""
import asyncio
import json
from datetime import datetime, timezone
from pathlib import Path

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND = Path(__file__).parent.parent
BUNDLE = json.load(open(BACKEND / "data" / "mvp_i18n_import_bundle_verified_v1.json", encoding="utf-8"))
OUT = BACKEND / "data" / "mvp_i18n_gaps_export_v1.json"
env = dotenv_values(str(BACKEND / ".env"))

# Languages to audit for MC option coverage (es is the base/fallback -> excluded).
AUDIT_LANGS = ["it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


def _clean(doc):
    if isinstance(doc, dict):
        return {k: _clean(v) for k, v in doc.items() if k != "_id"}
    if isinstance(doc, list):
        return [_clean(x) for x in doc]
    return doc


def _build_option_index():
    """(question_id) -> {lang: {index: text}} from the verified bundle."""
    idx = {}
    for e in BUNDLE["entries"]:
        tr = e["translations"]
        for r in e["references"]:
            key = r.get("key") or ""
            if ".option." in key and r.get("item_id") is not None and r.get("index") is not None:
                qid = r["item_id"]
                idx.setdefault(qid, {})
                for lang in AUDIT_LANGS:
                    idx[qid].setdefault(lang, {})[r["index"]] = tr[lang]
    return idx


async def main():
    client = AsyncIOMotorClient(env["MONGO_URL"])
    db = client[env["DB_NAME"]]

    # ---- 1. skills (as stored) ----
    skills = [_clean(s) async for s in db.skills.find({}).sort("order", 1)]

    # ---- 2. MC option gaps ----
    opt_idx = _build_option_index()
    active = [s async for s in db.situations.find({"active": True})]
    active_slugs = sorted(s["slug"] for s in active)

    incomplete, total_mc, complete_mc = [], 0, 0
    missing_per_lang = {l: 0 for l in AUDIT_LANGS}

    for slug in active_slugs:
        lesson = await db.lessons.find_one({"situation_slug": slug})
        if not lesson:
            continue
        for section in ("exercises", "quiz"):
            for q in lesson.get(section, []):
                if q.get("type") != "multiple_choice":
                    continue
                total_mc += 1
                canonical = q.get("options") or []
                canon_ix = list(range(len(canonical)))
                have = opt_idx.get(q["id"], {})
                existing, missing = {}, {}
                for lang in AUDIT_LANGS:
                    got = have.get(lang, {})
                    existing[lang] = {i: got[i] for i in sorted(got)}
                    miss = [i for i in canon_ix if i not in got]
                    if miss:
                        missing[lang] = miss
                        missing_per_lang[lang] += len(miss)
                if missing:
                    incomplete.append({
                        "question_id": q["id"],
                        "situation_slug": slug,
                        "section": "exercise" if section == "exercises" else "quiz",
                        "type": q["type"],
                        "assessment_dimension": q.get("assessment_dimension"),
                        "prompt_en": (q.get("translations", {}).get("en", {}) or {}).get("prompt")
                        or (q.get("translations", {}).get("es", {}) or {}).get("prompt"),
                        "canonical_options_en": {i: canonical[i] for i in canon_ix},
                        "answer_index": q.get("answer_index"),
                        "existing_option_translations": existing,
                        "missing_option_indices": missing,
                    })
                else:
                    complete_mc += 1

    # ---- 4. category situation_count ----
    cats = []
    for c in await db.categories.find({}, {"_id": 0}).sort("order", 1).to_list(100):
        current = await db.situations.count_documents({"category": c["slug"]})
        active_only = await db.situations.count_documents({"category": c["slug"], "active": True})
        cats.append({"slug": c["slug"], "name_en": c.get("name_en"),
                     "situation_count_current": current, "situation_count_active_only": active_only})

    export = {
        "meta": {
            "export_name": "mvp_i18n_gaps_export_v1",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "audit_languages": AUDIT_LANGS,
            "note": "Read-only. Option coverage derived from verified bundle; canonical options + answer_index from live lesson docs. Original indices preserved.",
        },
        "skills": skills,
        "mc_option_gaps": {
            "summary": {
                "total_active_mc_questions": total_mc,
                "fully_localized": complete_mc,
                "incomplete": len(incomplete),
                "missing_option_strings_per_language": missing_per_lang,
                "total_missing_option_strings": sum(missing_per_lang.values()),
            },
            "incomplete_questions": incomplete,
        },
        "category_situation_count": {
            "computed_at": "server.py GET /api/categories line ~366: count_documents({'category': slug}) with NO active filter (counts inactive too)",
            "categories": cats,
        },
    }

    OUT.write_text(json.dumps(export, ensure_ascii=False, indent=2), encoding="utf-8")
    print("WROTE", OUT)
    print("skills:", len(skills))
    print("MC total/complete/incomplete:", total_mc, complete_mc, len(incomplete))
    print("missing per lang:", missing_per_lang)
    print("categories:", [(c["slug"], c["situation_count_current"], c["situation_count_active_only"]) for c in cats])
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
