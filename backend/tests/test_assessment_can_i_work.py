"""
Backend tests for the 'Can I Work in English?' assessment (PREVIEW feature).
Covers role-specific question count, scoring correctness (all correct / all wrong / partial),
baseline immutability + current updates, weak_areas / weak_skills, assessment summary endpoint,
recommendations boost, meta localization & preserve-English option policy, catalog invariants,
guest-without-assessment compatibility, and reload idempotency.
"""
import json
import os
from pathlib import Path

import pytest
import requests

def _load_backend_url():
    env_file = Path(__file__).resolve().parent.parent.parent / "frontend" / ".env"
    for line in env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            return line.split("=", 1)[1].strip()
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", _load_backend_url()).rstrip("/")
API = f"{BASE_URL}/api"

PACK_PATH = Path(__file__).resolve().parent.parent / "data" / "can_i_work_assessment.json"
with open(PACK_PATH, encoding="utf-8") as f:
    PACK = json.load(f)

AREA_WEIGHT = {a["key"]: a["weight"] for a in PACK["areas"]}
AREA_ORDER = [a["key"] for a in PACK["areas"]]
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


# ---------- helpers ----------
def _new_guest(role="bartender", lang="es"):
    r = requests.post(f"{API}/guests", json={"interface_language": lang}, timeout=20)
    assert r.status_code == 200, r.text
    gid = r.json()["id"]
    profile = {
        "role": role,
        "venue_type": "pub",
        "target_country": "ireland",
        "goal": "work_abroad",
        "employment_status": "looking_for_job",
    }
    r = requests.put(f"{API}/guests/{gid}/profile", json=profile, timeout=20)
    assert r.status_code == 200, r.text
    return gid


def _correct_answer(q):
    """Return the server-expected submitted_answer for a canonical pack question."""
    t = q["type"]
    if t == "multiple_choice":
        return q["answer_index"]
    if t == "fill_gap":
        return q["answer"]
    if t == "word_ordering":
        return q["answer"]  # server also accepts list; string is simplest
    return None


def _wrong_answer(q):
    t = q["type"]
    if t == "multiple_choice":
        return (q["answer_index"] + 1) % 4
    return "zzz_definitely_wrong"


def _run_attempt(gid, role, strategy="all_correct", first_n_wrong=0):
    r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    attempt_id = data["attempt_id"]
    pack_qs = PACK["questions"][role]
    for i, q in enumerate(pack_qs):
        if strategy == "all_correct":
            ans = _correct_answer(q)
        elif strategy == "all_wrong":
            ans = _wrong_answer(q)
        elif strategy == "first_n_wrong":
            ans = _wrong_answer(q) if i < first_n_wrong else _correct_answer(q)
        else:
            raise ValueError(strategy)
        rr = requests.put(
            f"{API}/assessment-attempts/{attempt_id}/response",
            json={"question_id": q["id"], "submitted_answer": ans},
            timeout=20,
        )
        assert rr.status_code == 200, rr.text
    rc = requests.post(f"{API}/assessment-attempts/{attempt_id}/complete", timeout=20)
    assert rc.status_code == 200, rc.text
    return attempt_id, rc.json(), data


# ---------- Meta + preserve-English ----------
class TestMeta:
    def test_meta_structure_and_translations(self):
        r = requests.get(f"{API}/assessment/meta", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["questions_per_role"] == 15
        assert len(d["areas"]) == 6
        assert len(d["result_bands"]) == 4
        for area in d["areas"]:
            for L in LANGS:
                assert L in area["translations"], f"area {area['key']} missing {L}"
        for b in d["result_bands"]:
            for L in LANGS:
                assert L in b["translations"]
        # ui block has keys for languages
        for L in LANGS:
            # ui is nested as ui[key][lang]; verify all top-level ui keys have each language
            for key, mp in d["ui"].items():
                assert L in mp, f"ui.{key} missing lang {L}"


# ---------- Start: counts and preserve-English ----------
class TestStartAndQuestions:
    def test_bartender_gets_15(self):
        gid = _new_guest("bartender")
        r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "bartender"
        assert d["total"] == 15
        assert len(d["questions"]) == 15

    def test_waiter_gets_15(self):
        gid = _new_guest("waiter")
        r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert d["role"] == "waiter"
        assert d["total"] == 15
        assert len(d["questions"]) == 15

    def test_requires_role(self):
        r = requests.post(f"{API}/guests", json={"interface_language": "es"}, timeout=20)
        gid = r.json()["id"]
        r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
        assert r.status_code == 400

    def test_preserve_english_options_byte_identical(self):
        # Collect canonical preserve_english MC questions for bartender
        canonical = {
            q["id"]: q["options"]
            for q in PACK["questions"]["bartender"]
            if q["type"] == "multiple_choice"
            and q.get("options_localization_policy") == "preserve_english_target_verbatim"
        }
        assert canonical, "need at least one preserve-English MC"
        for lang in ("es", "de", "uk"):
            gid = _new_guest("bartender", lang=lang)
            r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
            assert r.status_code == 200
            served = {q["id"]: q.get("options") for q in r.json()["questions"]}
            for qid, en_opts in canonical.items():
                assert served[qid] == en_opts, f"{lang}/{qid} options differ from canonical English"

    def test_translate_from_es_uses_localized_options(self):
        # Pick a translate_from_es MC question (b04) and check DE options match pack localized_options
        target = next(
            q for q in PACK["questions"]["bartender"]
            if q["type"] == "multiple_choice"
            and q.get("options_localization_policy") == "translate_from_es"
        )
        gid = _new_guest("bartender", lang="de")
        r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
        q_served = next(q for q in r.json()["questions"] if q["id"] == target["id"])
        assert q_served["options"] == target["localized_options"]["de"]

    def test_prompt_localized_per_language(self):
        gid = _new_guest("bartender", lang="fr")
        r = requests.post(f"{API}/assessment/start", json={"guest_id": gid}, timeout=20)
        first = r.json()["questions"][0]
        expected = PACK["questions"]["bartender"][0]["translations"]["fr"]["prompt"]
        assert first["prompt"] == expected


# ---------- Scoring ----------
class TestScoring:
    def test_all_correct_bartender(self):
        gid = _new_guest("bartender")
        _, result, _ = _run_attempt(gid, "bartender", "all_correct")
        assert result["overall_score"] == 100
        assert all(v == 100 for v in result["area_scores"].values())
        assert result["band_key"] == "strong_foundation"
        assert result["is_baseline"] is True
        assert result["incorrect_question_ids"] == []

    def test_all_correct_waiter(self):
        gid = _new_guest("waiter")
        _, result, _ = _run_attempt(gid, "waiter", "all_correct")
        assert result["overall_score"] == 100
        assert all(v == 100 for v in result["area_scores"].values())

    def test_all_wrong(self):
        gid = _new_guest("bartender")
        _, result, _ = _run_attempt(gid, "bartender", "all_wrong")
        assert result["overall_score"] == 0
        assert all(v == 0 for v in result["area_scores"].values())
        assert result["band_key"] == "build_foundations"
        assert len(result["incorrect_question_ids"]) == 15

    def test_partial_first_6_wrong_matches_formula(self):
        gid = _new_guest("bartender")
        n_wrong = 6
        _, result, _ = _run_attempt(gid, "bartender", "first_n_wrong", first_n_wrong=n_wrong)
        # Compute expected: first 6 bartender questions wrong, rest correct
        pack_qs = PACK["questions"]["bartender"]
        total_in = {k: 0 for k in AREA_ORDER}
        correct_in = {k: 0 for k in AREA_ORDER}
        for i, q in enumerate(pack_qs):
            total_in[q["area"]] += 1
            if i >= n_wrong:
                correct_in[q["area"]] += 1
        expected_area = {k: round(100 * correct_in[k] / total_in[k]) if total_in[k] else 0 for k in AREA_ORDER}
        expected_overall = round(sum(expected_area[k] * AREA_WEIGHT[k] for k in AREA_ORDER))
        assert result["area_scores"] == expected_area
        assert result["overall_score"] == expected_overall


# ---------- Baseline immutability + current updates ----------
class TestBaselineAndCurrent:
    def test_baseline_set_once_current_updates_on_retake(self):
        gid = _new_guest("bartender")
        # First attempt: all correct -> baseline=100 current=100
        _, r1, _ = _run_attempt(gid, "bartender", "all_correct")
        assert r1["is_baseline"] is True
        assert r1["baseline_score"] == 100
        assert r1["current_score"] == 100
        # Retake: all wrong -> baseline stays 100, current=0
        _, r2, _ = _run_attempt(gid, "bartender", "all_wrong")
        assert r2["is_baseline"] is False
        assert r2["baseline_score"] == 100
        assert r2["current_score"] == 0
        assert r2["overall_score"] == 0

    def test_assessment_summary_reflects_state(self):
        gid = _new_guest("waiter")
        _run_attempt(gid, "waiter", "first_n_wrong", first_n_wrong=5)
        s = requests.get(f"{API}/guests/{gid}/assessment-summary", timeout=20).json()
        assert s["has_assessment"] is True
        assert isinstance(s["baseline_score"], int)
        assert s["current_score"] == s["baseline_score"]
        assert isinstance(s["weak_areas"], list) and len(s["weak_areas"]) == 2
        assert 0 <= len(s["weak_skills"]) <= 3
        assert s["last_completed_at"]
        assert s["latest"]["overall_score"] == s["current_score"]


# ---------- Weak areas / weak skills ----------
class TestWeaknesses:
    def test_weak_areas_lowest_two(self):
        gid = _new_guest("bartender")
        _, result, _ = _run_attempt(gid, "bartender", "first_n_wrong", first_n_wrong=6)
        assert len(result["weak_areas"]) == 2
        # weak_areas must correspond to the two lowest area_scores (tied with any lower one)
        sorted_scores = sorted(result["area_scores"].values())
        top2_weak_scores = sorted([result["area_scores"][k] for k in result["weak_areas"]])
        assert top2_weak_scores == sorted_scores[:2]

    def test_weak_skills_at_most_3(self):
        gid = _new_guest("bartender")
        _, result, _ = _run_attempt(gid, "bartender", "all_wrong")
        assert len(result["weak_skills"]) <= 3


# ---------- Recommendations with weak_skills boost ----------
class TestRecommendations:
    def test_recommendations_3_to_5_and_boost(self):
        gid = _new_guest("bartender")
        _run_attempt(gid, "bartender", "all_wrong")
        r = requests.get(f"{API}/guests/{gid}/recommended-situations?limit=5", timeout=20)
        assert r.status_code == 200
        items = r.json()
        # Must be 3-5
        assert 3 <= len(items) <= 5
        # Some item should have 'weakness' in reasons (boosted by assessment weak_skills)
        joined = []
        for it in items:
            joined.extend(it.get("reasons") or [])
        assert any("weakness" in s for s in joined), f"no weakness reason in {joined}"

    def test_recommendations_without_assessment(self):
        gid = _new_guest("bartender")
        r = requests.get(f"{API}/guests/{gid}/recommended-situations?limit=5", timeout=20)
        assert r.status_code == 200
        assert 3 <= len(r.json()) <= 5


# ---------- No-assessment guest / summary ----------
class TestNoAssessmentCompat:
    def test_summary_without_assessment(self):
        gid = _new_guest("waiter")
        s = requests.get(f"{API}/guests/{gid}/assessment-summary", timeout=20).json()
        assert s["has_assessment"] is False
        assert s["baseline_score"] is None
        assert s["current_score"] is None
        assert s["weak_areas"] == []
        assert s["weak_skills"] == []
        assert s["latest"] is None


# ---------- Catalog invariants (50 situations, 25/25) ----------
class TestCatalogInvariants:
    def test_50_situations_25_each_role(self):
        r = requests.get(f"{API}/situations", timeout=20)
        assert r.status_code == 200
        sits = r.json()
        active = [s for s in sits if s.get("active", True)]
        assert len(active) == 50
        bartender = [s for s in active if "bartender" in (s.get("roles") or [])]
        waiter = [s for s in active if "waiter" in (s.get("roles") or [])]
        assert len(bartender) == 25
        assert len(waiter) == 25


# ---------- Idempotency on restart (static JSON) ----------
class TestIdempotency:
    def test_meta_stable_across_calls(self):
        a = requests.get(f"{API}/assessment/meta", timeout=20).json()
        b = requests.get(f"{API}/assessment/meta", timeout=20).json()
        assert a == b
        assert a["questions_per_role"] == 15
