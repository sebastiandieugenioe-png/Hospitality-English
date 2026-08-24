"""Independent verification (iteration 7) of the FINAL i18n gaps micro-pack overlay.

Covers: skills 10-language resolution + no-ES-fallback + base fields intact,
MC canonical/localized invariants, no regression of previously-bundled option
translations, policy checks, grading (correct AND wrong) via Practice,
category counts (active only) + visibility, catalog size, duplicate detection.
"""
import json
import os
from collections import Counter
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

PACK = json.load(open("/app/backend/data/mvp_final_i18n_gaps_micro_pack_v1.json", encoding="utf-8"))
BUNDLE = json.load(open("/app/backend/data/mvp_i18n_import_bundle_verified_v1.json", encoding="utf-8"))
PACK_MC = {e["question_id"]: e for e in PACK["mc_option_gaps"]}
ALL_LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
AUDIT = ["it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


def _resolve(obj, base, lang):
    tr = obj.get("translations") or {}
    if isinstance(tr.get(lang), dict) and tr[lang].get(base) is not None:
        return tr[lang][base]
    if obj.get(f"{base}_{lang}") is not None:
        return obj[f"{base}_{lang}"]
    if isinstance(tr.get("es"), dict) and tr["es"].get(base) is not None:
        return tr["es"][base]
    return None


@pytest.fixture(scope="module")
def situations():
    r = requests.get(f"{API}/situations", timeout=30)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def lessons(situations):
    out = {}
    for s in situations:
        r = requests.get(f"{API}/lessons/{s['slug']}", timeout=30)
        assert r.status_code == 200, s["slug"]
        les = r.json().get("lesson")
        if les:
            out[s["slug"]] = les
    return out


@pytest.fixture(scope="module")
def mc_questions(lessons):
    qs = []
    for slug, les in lessons.items():
        for section in ("exercises", "quiz"):
            for q in les.get(section, []):
                if q.get("type") == "multiple_choice":
                    q = dict(q)
                    q["_slug"] = slug
                    q["_section"] = section
                    qs.append(q)
    return qs


# ---------------- SKILLS ----------------
class TestSkills:
    def test_no_mongo_id_and_base_fields(self):
        skills = requests.get(f"{API}/skills", timeout=30).json()
        assert len(skills) == 14
        assert len({s["id"] for s in skills}) == 14, "duplicate skill ids"
        for s in skills:
            assert "_id" not in s
            assert s.get("name")
            assert s.get("active") is True
            assert isinstance(s.get("order"), int)
            assert s.get("roles")

    def test_resolves_all_10_langs_exact_pack_text_no_es_fallback(self):
        skills = requests.get(f"{API}/skills", timeout=30).json()
        pack_by_id = {s["id"]: s for s in PACK["skills"]}
        assert len(pack_by_id) == 14
        for s in skills:
            p = pack_by_id[s["id"]]
            for lang in ALL_LANGS:
                assert _resolve(s, "name", lang), f"{s['id']}/{lang} name unresolved"
                assert _resolve(s, "description", lang), f"{s['id']}/{lang} desc unresolved"
            for lang in ("fr", "pt", "de", "pl", "ro", "uk", "nl", "en"):
                nm = (s.get("translations", {}).get(lang) or {}).get("name")
                ds = (s.get("translations", {}).get(lang) or {}).get("description")
                assert nm == p["translations"][lang]["name"], f"{s['id']}/{lang} name mismatch"
                assert ds == p["translations"][lang]["description"], f"{s['id']}/{lang} desc mismatch"
                es_name = (s.get("translations", {}).get("es") or {}).get("name")
                if es_name and lang != "es":
                    # not a Spanish fallback (unless pack legitimately equals ES)
                    assert nm == p["translations"][lang]["name"]

    def test_es_it_present(self):
        for s in requests.get(f"{API}/skills", timeout=30).json():
            for lang in ("es", "it"):
                assert _resolve(s, "name", lang), f"{s['id']} {lang} name missing"
                assert _resolve(s, "description", lang), f"{s['id']} {lang} desc missing"


# ---------------- MC OPTIONS ----------------
class TestMCInvariants:
    def test_94_active_mc_questions(self, mc_questions):
        assert len(mc_questions) == 94

    def test_canonical_and_localized_lengths(self, mc_questions):
        for q in mc_questions:
            canonical = q["options"]
            assert len(canonical) == 4, f"{q['id']} canonical len {len(canonical)}"
            assert isinstance(q["answer_index"], int) and 0 <= q["answer_index"] < 4
            assert q.get("assessment_dimension"), f"{q['id']} missing assessment_dimension"
            tr = q.get("translations") or {}
            for lang in AUDIT:
                loc = (tr.get(lang) or {}).get("options")
                assert loc is not None, f"{q['id']}/{lang} options missing"
                assert len(loc) == 4, f"{q['id']}/{lang} len={len(loc)}"
                assert all(isinstance(v, str) and v.strip() for v in loc), f"{q['id']}/{lang} empty value"

    def test_canonical_snapshot_matches_pack(self, mc_questions):
        by_id = {q["id"]: q for q in mc_questions}
        checked = 0
        for qid, e in PACK_MC.items():
            q = by_id.get(qid)
            assert q, f"pack question {qid} not found in active catalog"
            snap = e["canonical_snapshot"]
            assert q["answer_index"] == snap["answer_index"], qid
            assert {str(i): v for i, v in enumerate(q["options"])} == snap["options"], qid
            checked += 1
        assert checked == 68

    def test_all_223_gap_indices_exact_values(self, mc_questions):
        by_id = {q["id"]: q for q in mc_questions}
        covered = 0
        for qid, e in PACK_MC.items():
            q = by_id[qid]
            for mo in e["missing_options"]:
                idx = mo["index"]
                for lang in AUDIT:
                    got = q["translations"][lang]["options"][idx]
                    assert got == mo["translations"][lang], f"{qid}[{idx}]/{lang}: {got!r}"
                covered += 1
        assert covered == 223

    def test_preserve_english_policy_verbatim(self, mc_questions):
        by_id = {q["id"]: q for q in mc_questions}
        n = 0
        for qid, e in PACK_MC.items():
            q = by_id[qid]
            for mo in e["missing_options"]:
                if mo["policy"] != "preserve_english_target_verbatim":
                    continue
                idx = mo["index"]
                canon = q["options"][idx]
                for lang in AUDIT:
                    assert q["translations"][lang]["options"][idx] == canon, f"{qid}[{idx}]/{lang} not verbatim"
                n += 1
        assert n > 0
        # explicit spec example
        q = by_id["ex_bar_greet_1"]
        for lang in ("fr", "uk"):
            assert q["translations"][lang]["options"] == q["options"]

    def test_localized_interface_answer_policy(self, mc_questions):
        by_id = {q["id"]: q for q in mc_questions}
        e = PACK_MC["q_bar_greet_1"]
        loc = [m for m in e["missing_options"] if m["policy"] == "localized_interface_answer"]
        assert loc
        q = by_id["q_bar_greet_1"]
        for mo in loc:
            for lang in ("fr", "de"):
                val = q["translations"][lang]["options"][mo["index"]]
                assert val == mo["translations"][lang]
                assert val != q["options"][mo["index"]], "localized answer left in English"

    def test_no_regression_of_previously_bundled_option_translations(self, mc_questions):
        """Every option translation shipped in the verified bundle must still be
        present in the DB at the same question/index (overlay must not overwrite
        previously translated indices with canonical English)."""
        by_id = {q["id"]: q for q in mc_questions}
        gap_idx = {(qid, mo["index"]) for qid, e in PACK_MC.items() for mo in e["missing_options"]}
        mismatches = []
        checked = 0
        for entry in BUNDLE["entries"]:
            for ref in entry.get("references", []):
                if ref.get("kind") != "option":
                    continue
                qid, idx = ref.get("item_id"), ref.get("index")
                if qid not in by_id or idx is None:
                    continue
                if (qid, idx) in gap_idx:
                    continue  # owned by the micro-pack
                q = by_id[qid]
                for lang in AUDIT:
                    expected = entry["translations"].get(lang)
                    if expected is None:
                        continue
                    got = q["translations"][lang]["options"][idx]
                    checked += 1
                    if got != expected:
                        mismatches.append((qid, idx, lang, expected, got))
        assert checked > 0
        assert not mismatches, f"{len(mismatches)} bundled option translations lost, e.g. {mismatches[:5]}"


# ---------------- GRADING ----------------
class TestGrading:
    SLUG = "guest-arrives-at-the-bar"

    def _guest(self, lang="fr"):
        r = requests.post(f"{API}/guests", json={"interface_language": lang}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        return r.json()["id"]

    def _review_item(self, gid, qid):
        items = requests.get(f"{API}/guests/{gid}/review-items", timeout=30).json()
        m = [i for i in items if i.get("source_id") == qid]
        assert m, f"no review item created for {qid}"
        return m[0]["id"]

    def _attempt_wrong(self, gid, qid, wrong_index):
        aid = requests.post(f"{API}/situation-attempts/start",
                            json={"guest_id": gid, "situation_slug": self.SLUG}, timeout=30).json()["attempt_id"]
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": qid, "section": "quiz", "submitted_answer": wrong_index}, timeout=30)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("correct") is False, body
        return aid

    def test_practice_wrong_then_correct_grading(self, mc_questions):
        by_id = {q["id"]: q for q in mc_questions}
        q = by_id["q_bar_greet_4"]
        assert q["answer_index"] == 1, q["answer_index"]
        gid = self._guest("fr")
        self._attempt_wrong(gid, "q_bar_greet_4", 0)
        rid = self._review_item(gid, "q_bar_greet_4")

        r_wrong = requests.post(f"{API}/review-items/{rid}/answer", json={"submitted_answer": 0}, timeout=30)
        assert r_wrong.status_code == 200, r_wrong.text[:300]
        assert r_wrong.json()["correct"] is False, r_wrong.json()

        rid2 = self._review_item(gid, "q_bar_greet_4")
        r_ok = requests.post(f"{API}/review-items/{rid2}/answer", json={"submitted_answer": 1}, timeout=30)
        assert r_ok.status_code == 200, r_ok.text[:300]
        assert r_ok.json()["correct"] is True, r_ok.json()

    def test_lesson_quiz_grades_by_answer_index_all_mc(self, mc_questions):
        """Sample every quiz MC in two situations: correct index grades True."""
        gid = self._guest("de")
        failures = []
        for slug in ("guest-arrives-at-the-bar", "taking-an-order"):
            aid = requests.post(f"{API}/situation-attempts/start",
                                json={"guest_id": gid, "situation_slug": slug}, timeout=30).json()["attempt_id"]
            les = requests.get(f"{API}/lessons/{slug}", timeout=30).json()["lesson"]
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    if q.get("type") != "multiple_choice":
                        continue
                    r = requests.put(f"{API}/situation-attempts/{aid}/response",
                                     json={"question_id": q["id"],
                                           "section": "exercise" if section == "exercises" else "quiz",
                                           "submitted_answer": q["answer_index"]}, timeout=30)
                    if r.status_code != 200 or r.json().get("correct") is not True:
                        failures.append((slug, q["id"], r.status_code, r.text[:120]))
        assert not failures, failures


# ---------------- CATEGORIES / CATALOG ----------------
class TestCategoriesCatalog:
    def test_counts_and_visibility(self):
        r = requests.get(f"{API}/categories", timeout=30)
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 7, [c["slug"] for c in cats]
        assert {c["slug"]: c["situation_count"] for c in cats} == {
            "general": 0, "restaurant": 10, "bar": 10,
            "hotel": 0, "coffee": 0, "kitchen": 0, "housekeeping": 0}
        for c in cats:
            assert "_id" not in c
            for lang in ALL_LANGS:
                assert _resolve(c, "name", lang), f"category {c['slug']} name {lang}"

    def test_20_active_situations_no_duplicates(self, situations):
        assert len(situations) == 20
        slugs = Counter(s["slug"] for s in situations)
        assert not [k for k, v in slugs.items() if v > 1], slugs
        roles = Counter()
        for s in situations:
            for role in (s.get("roles") or [s.get("role")]):
                roles[role] += 1
        assert requests.get(f"{API}/situations", params={"role": "bartender"}, timeout=30).json().__len__() == 10
        assert requests.get(f"{API}/situations", params={"role": "waiter"}, timeout=30).json().__len__() == 10
        for s in situations:
            assert s.get("active") is True

    def test_no_duplicate_lessons_or_learning_items(self, lessons, situations):
        assert len(lessons) == 20
        ids = Counter()
        for les in lessons.values():
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    ids[q["id"]] += 1
        dupes = {k: v for k, v in ids.items() if v > 1}
        assert not dupes, dupes
