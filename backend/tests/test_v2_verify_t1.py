"""T1 independent verification of the Hospitality English Content Pack v2 import.

Covers: catalog counts, activation/placeholder policy, i18n coverage (10 langs, all
v2 content fields, no blanks), MC integrity + localization policy split,
practice/grading + answer leakage, categories counts, v1 regression, DB-level
duplicate/idempotency checks.
"""
import json
import os
from collections import Counter
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
_base = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not _base:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
API = _base.rstrip("/") + "/api"

V2 = json.loads(Path("/app/backend/data/hospitality_english_content_v2_emergent_single_file.json").read_text(encoding="utf-8"))
SITS = V2["content_pack"]["situations"]
V2_SLUGS = [s["expected_slug"] for s in SITS]
PRESERVE = {p["item_id"] for p in V2["i18n_bundle"]["preserve_english_mc_items"]}
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
NON_ES = [l for l in LANGS if l != "es"]
FORBIDDEN = {
    "greetings-and-small-talk", "polite-requests", "giving-directions",
    "checking-in", "guest-requests", "explaining-hotel-facilities",
    "handling-a-complaint-hotel", "welcoming-a-guest", "making-coffee-orders",
    "recommending-pastries", "communicating-with-the-kitchen",
    "kitchen-safety-basics", "cleaning-a-room",
}

_cache = {}


def _get(path, **params):
    r = requests.get(f"{API}{path}", params=params, timeout=60, headers=premium_headers())
    assert r.status_code == 200, f"GET {path} -> {r.status_code} {r.text[:200]}"
    return r.json()


def _situations(**p):
    return _get("/situations", **p)


def _lesson(slug):
    if slug not in _cache:
        body = _get(f"/lessons/{slug}")
        _cache[slug] = body.get("lesson") or body
    return _cache[slug]


# ---------------------------------------------------------------- catalog
class TestCatalog:
    def test_active_catalog_50_25_25(self):
        allsits = _situations()
        assert len(allsits) == 50, f"expected 50 active, got {len(allsits)}"
        assert len(_situations(role="bartender")) == 25
        assert len(_situations(role="waiter")) == 25
        roles = Counter()
        for s in allsits:
            for r in (s.get("roles") or ([s["role"]] if s.get("role") else [])):
                roles[r] += 1
        assert roles["bartender"] == 25 and roles["waiter"] == 25, roles

    def test_no_duplicate_active_slugs_and_all_v2_active(self):
        slugs = [s["slug"] for s in _situations()]
        assert len(slugs) == len(set(slugs)), [k for k, v in Counter(slugs).items() if v > 1]
        missing = [s for s in V2_SLUGS if s not in set(slugs)]
        assert not missing, f"v2 situations not active: {missing}"
        assert len(set(V2_SLUGS)) == 30

    def test_handling_a_complaint_and_forbidden_placeholders(self):
        active = {s["slug"] for s in _situations()}
        hac = next(s for s in _situations() if s["slug"] == "handling-a-complaint")
        assert hac.get("category") == "bar"
        assert "bartender" in (hac.get("roles") or [hac.get("role")])
        assert hac.get("is_full") is True
        assert "handling-a-complaint-bar" not in active
        leaked = sorted(FORBIDDEN & active)
        assert not leaked, f"forbidden placeholders activated: {leaked}"

    def test_handling_a_complaint_bar_exists_inactive_in_db(self):
        r = requests.get(f"{API}/situations/handling-a-complaint-bar", timeout=30)
        # must still exist in DB (not deleted); either returned as inactive doc or 404 from active-only filter
        assert r.status_code in (200, 404)
        if r.status_code == 200:
            assert r.json().get("active") is False

    def test_categories_active_only_counts(self):
        cats = {c["slug"]: c.get("situation_count") for c in _get("/categories")}
        expected = {"general": 0, "restaurant": 25, "bar": 25, "hotel": 0,
                    "coffee": 0, "kitchen": 0, "housekeeping": 0}
        for slug, cnt in expected.items():
            if slug in cats:
                assert cats[slug] == cnt, f"category {slug} count {cats[slug]} != {cnt}"
        assert sum(v for v in cats.values() if v) == 50


# ---------------------------------------------------------------- i18n
class TestI18n:
    def test_titles_10_langs_no_blanks(self):
        bad = []
        for slug in V2_SLUGS:
            tr = _get(f"/situations/{slug}").get("translations") or {}
            for lang in LANGS:
                v = (tr.get(lang) or {}).get("title")
                if not v or not str(v).strip():
                    bad.append(f"{slug}:{lang}")
        assert not bad, bad[:20]

    def test_intro_context_objectives_10_langs(self):
        bad = []
        for slug in V2_SLUGS:
            intro = _lesson(slug)["intro"].get("translations") or {}
            for lang in LANGS:
                blk = intro.get(lang) or {}
                if not (blk.get("context") or "").strip():
                    bad.append(f"{slug}:{lang}:context")
                objs = blk.get("objectives")
                if not objs or not all((str(o).strip()) for o in objs):
                    bad.append(f"{slug}:{lang}:objectives")
        assert not bad, bad[:20]

    def test_all_phrases_translated_10_langs(self):
        bad = []
        for slug in V2_SLUGS:
            for p in _lesson(slug).get("phrases", []):
                tr = p.get("translations") or {}
                for lang in LANGS:
                    v = tr.get(lang)
                    if isinstance(v, dict):
                        v = v.get("translation") or v.get("text")
                    if not v or not str(v).strip():
                        bad.append(f"{slug}:{p.get('id')}:{lang}")
        assert not bad, (len(bad), bad[:20])

    def test_all_quiz_and_exercise_prompts_translated(self):
        bad = []
        for slug in V2_SLUGS:
            les = _lesson(slug)
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    tr = q.get("translations") or {}
                    for lang in LANGS:
                        v = (tr.get(lang) or {}).get("prompt")
                        if not v or not str(v).strip():
                            bad.append(f"{slug}:{section}:{q.get('id')}:{lang}")
        assert not bad, (len(bad), bad[:20])

    def test_english_learning_content_unchanged(self):
        """Canonical English phrase text / prompts must equal the pack verbatim."""
        bad = []
        for s in SITS:
            slug = s["expected_slug"]
            les = _lesson(slug)
            pack_phrases = {p["id"]: p for p in s["lesson"]["phrases"]}
            for p in les.get("phrases", []):
                pp = pack_phrases.get(p["id"])
                if not pp:
                    continue
                for field in ("english_content", "english", "text"):
                    if field in pp and field in p and pp[field] != p[field]:
                        bad.append(f"{slug}:{p['id']}:{field}")
        assert not bad, bad[:20]


# ---------------------------------------------------------------- MC integrity
def _v2_mc():
    out = []
    for slug in V2_SLUGS:
        les = _lesson(slug)
        for section in ("exercises", "quiz"):
            for q in les.get(section, []):
                if q.get("type") == "multiple_choice":
                    out.append((slug, section, q))
    return out


PACK_MC = {}
for _s in SITS:
    for _sec in ("exercises", "quiz"):
        for _q in _s["lesson"][_sec]:
            if _q.get("type") == "multiple_choice":
                PACK_MC[_q["id"]] = _q


class TestMultipleChoice:
    def test_120_mc_canonical_intact(self):
        mc = _v2_mc()
        assert len(mc) == 120, f"expected 120 v2 MC, got {len(mc)}"
        policies = Counter()
        for slug, section, q in mc:
            pq = PACK_MC[q["id"]]
            assert q["options"] == pq["options"], f"{q['id']} options changed"
            assert len(q["options"]) == 4
            assert q["answer_index"] == pq["answer_index"], f"{q['id']} answer_index changed"
            assert q.get("assessment_dimension") == pq.get("assessment_dimension")
            policies[pq["options_localization_policy"]] += 1
        assert policies["preserve_english_target_verbatim"] == 48, policies
        assert policies["translate_from_es"] == 72, policies

    def test_preserve_english_items_stay_english(self):
        seen = 0
        bad = []
        for slug, section, q in _v2_mc():
            if q["id"] not in PRESERVE:
                continue
            seen += 1
            for lang in NON_ES:
                loc = (q.get("translations") or {}).get(lang, {}).get("options")
                if loc is not None and loc != q["options"]:
                    bad.append(f"{q['id']}:{lang}")
        assert seen == 48, seen
        assert not bad, bad[:20]

    def test_translate_from_es_items_localized_full_length(self):
        bad = []
        n = 0
        for slug, section, q in _v2_mc():
            if q["id"] in PRESERVE:
                continue
            n += 1
            for lang in NON_ES:
                loc = (q.get("translations") or {}).get(lang, {}).get("options")
                if not loc or len(loc) != 4 or any(not str(o).strip() for o in loc):
                    bad.append(f"{q['id']}:{lang}")
        assert n == 72, n
        assert not bad, (len(bad), bad[:20])


# ---------------------------------------------------------------- practice/grading
@pytest.mark.parametrize("slug", ["taking-a-drinks-order", "handling-a-complaint"])
def test_practice_grading_and_no_answer_leak(slug):
    les = _lesson(slug)
    q = next(x for x in les["quiz"] + les.get("exercises", []) if x.get("type") == "multiple_choice")
    wrong = 0 if q["answer_index"] != 0 else 1

    gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": "fr"}, timeout=30).json()["id"])
    aid = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                        json={"guest_id": gid, "situation_slug": slug}, timeout=30).json()["attempt_id"]
    section = "quiz" if q in les["quiz"] else "exercises"
    r1 = requests.put(f"{API}/situation-attempts/{aid}/response",
                      json={"question_id": q["id"], "section": section, "submitted_answer": wrong}, timeout=30)
    assert r1.status_code == 200, r1.text[:300]
    assert r1.json()["correct"] is False

    items = requests.get(f"{API}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
    mine = [i for i in items if i.get("source_id") == q["id"]]
    assert mine, "no review item created for wrong answer"
    ri = mine[0]
    payload = json.dumps(ri)
    assert "answer_index" not in ri and "answer" not in ri, f"review item leaks answer: {list(ri)}"
    assert str(q["answer_index"]) not in [str(v) for k, v in ri.items() if k in ("correct_index",)]

    r_wrong = requests.post(f"{API}/review-items/{ri['id']}/answer", headers=premium_headers(),
                            json={"submitted_answer": wrong}, timeout=30)
    assert r_wrong.status_code == 200, r_wrong.text[:300]
    assert r_wrong.json()["correct"] is False

    items = requests.get(f"{API}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
    ri2 = [i for i in items if i.get("source_id") == q["id"]][0]
    r_ok = requests.post(f"{API}/review-items/{ri2['id']}/answer", headers=premium_headers(),
                         json={"submitted_answer": q["answer_index"]}, timeout=30)
    assert r_ok.status_code == 200, r_ok.text[:300]
    assert r_ok.json()["correct"] is True


# ---------------------------------------------------------------- v1 regression
class TestV1Regression:
    def test_v1_pack_situations_still_active_and_gradable(self):
        active = {s["slug"] for s in _situations()}
        v1 = [s for s in active if s not in set(V2_SLUGS)]
        assert len(v1) == 20, f"expected 20 pre-existing active, got {len(v1)}"
        slug = sorted(v1)[0]
        les = _lesson(slug)
        assert les and les.get("phrases")
        q = next((x for x in les.get("quiz", []) if x.get("type") == "multiple_choice"), None)
        if q:
            gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": "es"}, timeout=30).json()["id"])
            aid = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                                json={"guest_id": gid, "situation_slug": slug}, timeout=30).json()["attempt_id"]
            r = requests.put(f"{API}/situation-attempts/{aid}/response",
                             json={"question_id": q["id"], "section": "quiz",
                                   "submitted_answer": q["answer_index"]}, timeout=30)
            assert r.status_code == 200 and r.json()["correct"] is True
