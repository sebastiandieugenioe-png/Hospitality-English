"""Targeted tests for Hospitality English Content Pack v2 import (30 situations)."""
import os
import json
from pathlib import Path
from collections import Counter

import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

V2 = json.load(open(Path("/app/backend/data/hospitality_english_content_v2_emergent_single_file.json"), encoding="utf-8"))
SITS = V2["content_pack"]["situations"]
V2_SLUGS = [s["expected_slug"] for s in SITS]
ALL_LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
AUDIT = ["it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
PRESERVE = {p["item_id"] for p in V2["i18n_bundle"]["preserve_english_mc_items"]}


def _situations(**p):
    return requests.get(f"{API}/situations", params=p).json()


def _lesson(slug):
    return requests.get(f"{API}/lessons/{slug}", headers=premium_headers()).json().get("lesson")


class TestCatalog:
    def test_50_25_25(self):
        assert len(_situations()) == 50
        assert len(_situations(role="bartender")) == 25
        assert len(_situations(role="waiter")) == 25

    def test_all_30_v2_active_no_dupes(self):
        active = _situations()
        slugs = [s["slug"] for s in active]
        assert len(slugs) == len(set(slugs)), "duplicate active slugs"
        active_set = set(slugs)
        for slug in V2_SLUGS:
            assert slug in active_set, f"v2 situation not active: {slug}"

    def test_handling_complaint_new_slug_and_placeholder_untouched(self):
        active = {s["slug"] for s in _situations()}
        assert "handling-a-complaint" in active
        # legacy placeholder must remain inactive (not in active list)
        assert "handling-a-complaint-bar" not in active


class TestI18nCoverage:
    def test_v2_situations_resolve_10_languages(self):
        for slug in V2_SLUGS:
            sit = requests.get(f"{API}/situations/{slug}").json()
            tr = sit.get("translations") or {}
            for lang in ALL_LANGS:
                assert (tr.get(lang) or {}).get("title"), f"{slug} title missing {lang}"
            les = _lesson(slug)
            assert les
            intro = les["intro"]["translations"]
            for lang in ALL_LANGS:
                assert (intro.get(lang) or {}).get("context"), f"{slug} intro.context missing {lang}"
                assert (intro.get(lang) or {}).get("objectives"), f"{slug} objectives missing {lang}"
            # a phrase and a quiz prompt resolve in all languages (no blanks)
            p = les["phrases"][0]
            for lang in ALL_LANGS:
                assert p["translations"].get(lang), f"{slug} phrase missing {lang}"
            q = les["quiz"][0]
            for lang in ALL_LANGS:
                assert (q["translations"].get(lang) or {}).get("prompt"), f"{slug} quiz prompt missing {lang}"


class TestMultipleChoice:
    def _v2_mc(self):
        out = []
        for slug in V2_SLUGS:
            les = _lesson(slug)
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    if q.get("type") == "multiple_choice":
                        out.append((slug, q))
        return out

    def test_120_mc_four_options_answer_index_intact(self):
        mc = self._v2_mc()
        assert len(mc) == 120
        # canonical snapshots from the pack
        pack_q = {}
        for s in SITS:
            for section in ("exercises", "quiz"):
                for q in s["lesson"][section]:
                    if q.get("type") == "multiple_choice":
                        pack_q[q["id"]] = q
        policies = Counter()
        for _slug, q in mc:
            pq = pack_q[q["id"]]
            assert q["options"] == pq["options"], f"{q['id']} option order/text changed"
            assert len(q["options"]) == 4
            assert q["answer_index"] == pq["answer_index"]
            assert q["assessment_dimension"] == pq["assessment_dimension"]
            policies[pq["options_localization_policy"]] += 1
        assert policies["preserve_english_target_verbatim"] == 48
        assert policies["translate_from_es"] == 72

    def test_preserve_english_options_stay_english_all_locales(self):
        count = 0
        for slug, q in self._v2_mc():
            if q["id"] not in PRESERVE:
                continue
            count += 4
            for lang in AUDIT:
                loc = (q.get("translations") or {}).get(lang, {}).get("options")
                # either no localized array (falls back to canonical) or identical to canonical
                if loc is not None:
                    assert loc == q["options"], f"{q['id']} {lang} preserve-English altered"
        assert count == 192  # 48 questions x 4 options

    def test_translate_mc_localized_full_length(self):
        pack_q = {q["id"]: s for s in SITS for section in ("exercises", "quiz")
                  for q in s["lesson"][section] if q.get("type") == "multiple_choice"}
        for slug, q in self._v2_mc():
            if q["id"] in PRESERVE:
                continue
            for lang in AUDIT:
                loc = (q.get("translations") or {}).get(lang, {}).get("options")
                assert loc and len(loc) == 4, f"{q['id']} {lang} translate options not full-length"


class TestPracticeGrading:
    def test_practice_200_and_grading_v2_mc(self):
        slug = "taking-a-drinks-order"
        les = _lesson(slug)
        q = next(x for x in les["quiz"] if x["type"] == "multiple_choice")
        wrong = 0 if q["answer_index"] != 0 else 1
        gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": "fr"}).json()["id"])
        aid = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        r1 = requests.put(f"{API}/situation-attempts/{aid}/response",
                          json={"question_id": q["id"], "section": "quiz", "submitted_answer": wrong})
        assert r1.status_code == 200 and r1.json()["correct"] is False
        rid = [i["id"] for i in requests.get(f"{API}/guests/{gid}/review-items", headers=premium_headers()).json()
               if i["source_id"] == q["id"]][0]
        r2 = requests.post(f"{API}/review-items/{rid}/answer", headers=premium_headers(), json={"submitted_answer": q["answer_index"]})
        assert r2.status_code == 200 and r2.json()["correct"] is True
