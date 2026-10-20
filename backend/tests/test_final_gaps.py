"""Targeted tests for the final i18n gaps micro-pack import (skills + MC options + count)."""
import os
import json
from pathlib import Path

import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

PACK = json.load(open(Path("/app/backend/data/mvp_final_i18n_gaps_micro_pack_v1.json"), encoding="utf-8"))
ALL_LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
AUDIT = ["it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
PACK_MC = {e["question_id"]: e for e in PACK["mc_option_gaps"]}


def _resolve(obj, base, lang):
    tr = obj.get("translations") or {}
    if isinstance(tr.get(lang), dict) and tr[lang].get(base) is not None:
        return tr[lang][base]
    if obj.get(f"{base}_{lang}") is not None:
        return obj[f"{base}_{lang}"]
    if isinstance(tr.get("es"), dict) and tr["es"].get(base) is not None:
        return tr["es"][base]
    return None


class TestSkills:
    def test_14_skills_resolve_all_10_languages(self):
        skills = requests.get(f"{API}/skills").json()
        assert len(skills) == 14
        pack_by_id = {s["id"]: s for s in PACK["skills"]}
        for s in skills:
            for lang in ALL_LANGS:
                assert _resolve(s, "name", lang), f"{s['id']} name missing {lang}"
                assert _resolve(s, "description", lang), f"{s['id']} desc missing {lang}"
            # non-ES interface langs must not fall back to ES (use exact pack text)
            for lang in ("fr", "pt", "de", "pl", "ro", "uk", "nl", "en"):
                assert _resolve(s, "name", lang) == pack_by_id[s["id"]]["translations"][lang]["name"]


class TestMCOptions:
    def _all_active_mc(self):
        out = []
        for sit in requests.get(f"{API}/situations").json():
            les = requests.get(f"{API}/lessons/{sit['slug']}", headers=premium_headers()).json().get("lesson")
            if not les:
                continue
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    if q.get("type") == "multiple_choice":
                        out.append(q)
        return out

    def test_94_mc_four_options_all_langs_fulllength_answer_index_intact(self):
        mc = self._all_active_mc()
        assert len(mc) == 214
        for q in mc:
            canonical = q["options"]
            assert len(canonical) == 4
            assert 0 <= q["answer_index"] < 4
            tr = q.get("translations") or {}
            for lang in AUDIT:
                loc = (tr.get(lang) or {}).get("options")
                if loc is not None:
                    assert len(loc) == len(canonical), f"{q['id']} {lang} not full-length"
            if q["id"] in PACK_MC:
                assert q["answer_index"] == PACK_MC[q["id"]]["canonical_snapshot"]["answer_index"]
                # canonical options unchanged vs snapshot
                snap = PACK_MC[q["id"]]["canonical_snapshot"]["options"]
                assert {str(i): v for i, v in enumerate(canonical)} == snap

    def test_223_gaps_covered_for_9_languages(self):
        covered = 0
        for sit in requests.get(f"{API}/situations").json():
            les = requests.get(f"{API}/lessons/{sit['slug']}", headers=premium_headers()).json().get("lesson")
            if not les:
                continue
            qmap = {q["id"]: q for section in ("exercises", "quiz") for q in les.get(section, [])}
            for qid, e in PACK_MC.items():
                if qid not in qmap:
                    continue
                q = qmap[qid]
                for mo in e["missing_options"]:
                    idx = mo["index"]
                    for lang in AUDIT:
                        assert q["translations"][lang]["options"][idx] == mo["translations"][lang]
                    covered += 1
        assert covered == 223

    def test_policies(self):
        les = requests.get(f"{API}/lessons/guest-arrives-at-the-bar", headers=premium_headers()).json()["lesson"]
        q = next(x for x in les["exercises"] if x["id"] == "ex_bar_greet_1")
        # preserve_english_target_verbatim -> English verbatim in FR and UK
        for lang in ("fr", "uk"):
            assert q["translations"][lang]["options"] == q["options"]
        q2 = next(x for x in les["quiz"] if x["id"] == "q_bar_greet_1")
        e = PACK_MC["q_bar_greet_1"]
        loc = next(m for m in e["missing_options"] if m["policy"] == "localized_interface_answer")
        for lang in ("fr", "de"):
            assert q2["translations"][lang]["options"][loc["index"]] == loc["translations"][lang]

    def test_practice_200_and_grading(self):
        slug = "guest-arrives-at-the-bar"
        gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": "fr"}).json()["id"])
        aid = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        requests.put(f"{API}/situation-attempts/{aid}/response",
                     json={"question_id": "q_bar_greet_4", "section": "quiz", "submitted_answer": 0})
        rid = [i["id"] for i in requests.get(f"{API}/guests/{gid}/review-items", headers=premium_headers()).json()
               if i["source_id"] == "q_bar_greet_4"][0]
        r = requests.post(f"{API}/review-items/{rid}/answer", headers=premium_headers(), json={"submitted_answer": 1})
        assert r.status_code == 200 and r.json()["correct"] is True


class TestCategoryCountAndCatalog:
    def test_counts_active_only(self):
        cats = {c["slug"]: c["situation_count"] for c in requests.get(f"{API}/categories").json()}
        assert cats == {"general": 0, "restaurant": 25, "bar": 25,
                        "hotel": 0, "coffee": 0, "kitchen": 0, "housekeeping": 0}

    def test_20_situations(self):
        assert len(requests.get(f"{API}/situations").json()) == 50
        assert len(requests.get(f"{API}/situations", params={"role": "bartender"}).json()) == 25
        assert len(requests.get(f"{API}/situations", params={"role": "waiter"}).json()) == 25
