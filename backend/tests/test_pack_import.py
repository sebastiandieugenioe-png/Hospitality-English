"""Targeted integrity tests for the MVP Content Pack v1 import.

Validates the 13 imported situations without rewriting content, plus regression
guards for the 7 existing situations, i18n ES + IT fallback, and Practice being
able to resolve the new question ids.
"""
import os
import re
import json
from pathlib import Path

import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

PACK = json.load(open(Path(__file__).parent.parent / "data" / "mvp_content_pack_v1.json", encoding="utf-8"))
PACK_SLUGS = [s["slug"] for s in PACK["situations"]]

EXISTING_SEVEN = [
    "taking-an-order",
    "guest-asks-for-cocktail-recommendation",
    "guest-wants-something-less-sweet",
    "guest-says-cocktail-is-too-sweet",
    "guest-asks-for-food-recommendation",
    "guest-mentions-a-nut-allergy",
    "food-is-taking-longer-than-expected",
]

VALID_DIMS = {"english", "comprehension", "service"}
VENUE_TARGET_TO_ID = {
    "cocktail bar": "cocktail-bar", "pub": "pub", "hotel 4-5 star": "hotel-restaurant",
    "casual restaurant": "casual-restaurant", "fine dining": "fine-dining",
}


def _situations(**params):
    return requests.get(f"{API}/situations", params=params).json()


def _norm_tokens(s):
    return sorted(re.sub(r"[^\w\s]", "", s.lower()).split())


class TestCatalogCounts:
    def test_totals(self):
        assert len(_situations()) == 20
        assert len(_situations(role="bartender")) == 10
        assert len(_situations(role="waiter")) == 10

    def test_thirteen_new_exist_and_unique(self):
        assert len(PACK_SLUGS) == 13 == len(set(PACK_SLUGS))
        active = {s["slug"] for s in _situations()}
        for slug in PACK_SLUGS:
            assert slug in active, f"missing {slug}"

    def test_existing_seven_still_active(self):
        active = {s["slug"] for s in _situations()}
        for slug in EXISTING_SEVEN:
            assert slug in active, f"regressed {slug}"


class TestSituationIntegrity:
    def test_taxonomy_valid(self):
        skills = {s["id"] for s in requests.get(f"{API}/skills").json()}
        roles = {p["slug"] for p in requests.get(f"{API}/professional-profiles").json()}
        venues = {v["slug"] for v in requests.get(f"{API}/venue-types").json()}
        for slug in PACK_SLUGS:
            s = requests.get(f"{API}/situations/{slug}").json()
            assert s["primary_skill"] in skills
            for sk in s["skills"]:
                assert sk in skills, f"{slug}: bad skill {sk}"
            for r in s["roles"]:
                assert r in roles
            assert s["venue_types"], f"{slug}: venues not resolved"
            for v in s["venue_types"]:
                assert v in venues, f"{slug}: bad venue {v}"

    def test_venue_target_mapping(self):
        for src in PACK["situations"]:
            s = requests.get(f"{API}/situations/{src['slug']}").json()
            expected = [VENUE_TARGET_TO_ID[t] for t in src["venue_type_targets"]]
            assert s["venue_types"] == expected, f"{src['slug']}: {s['venue_types']} != {expected}"


class TestLessonIntegrity:
    def test_lessons_accessible_and_shaped(self):
        all_ids = []
        for slug in PACK_SLUGS:
            d = requests.get(f"{API}/lessons/{slug}").json()
            assert d["available"] is True, f"{slug} lesson unavailable"
            les = d["lesson"]
            assert les["content_version"] >= 1
            assert len(les["exercises"]) == 3, f"{slug}: exercises != 3"
            assert len(les["quiz"]) == 5, f"{slug}: quiz != 5"
            for q in les["exercises"] + les["quiz"]:
                all_ids.append(q["id"])
                assert q["assessment_dimension"] in VALID_DIMS
                if q["type"] == "word_ordering":
                    assert _norm_tokens(" ".join(q["words"])) == _norm_tokens(q["answer"])
                if q["type"] == "fill_gap":
                    assert q.get("sentence"), f"{q['id']}: missing sentence"
            for p in les["phrases"]:
                all_ids.append(p["id"])
                assert p["english_content"]
                assert isinstance(p["translations"]["es"], str)
        assert len(all_ids) == len(set(all_ids)), "duplicate stable ids in pack"

    def test_stable_ids_globally_unique(self):
        """New pack ids must not collide with the existing seven lessons' ids."""
        seen = set()
        dupes = []
        for slug in EXISTING_SEVEN + PACK_SLUGS:
            d = requests.get(f"{API}/lessons/{slug}").json()
            if not d.get("available"):
                continue
            les = d["lesson"]
            for q in les["exercises"] + les["quiz"] + les["phrases"]:
                if q["id"] in seen:
                    dupes.append(q["id"])
                seen.add(q["id"])
        assert not dupes, f"duplicate stable ids across catalog: {dupes}"


class TestFlashcardsExcludeInappropriate:
    def test_inappropriate_not_flashcardable(self):
        # Any phrase rated inappropriate stays in the lesson but must be filterable out
        # of flashcards. We assert the flag is preserved so Lesson.js can exclude it.
        found_inappropriate = False
        for slug in PACK_SLUGS:
            les = requests.get(f"{API}/lessons/{slug}").json()["lesson"]
            for p in les["phrases"]:
                if p.get("service_rating") == "inappropriate":
                    found_inappropriate = True
            flashcardable = [p for p in les["phrases"] if p.get("service_rating") != "inappropriate"]
            assert len(flashcardable) >= 1
        assert found_inappropriate, "expected at least one inappropriate phrase in the pack"


class TestI18nResolution:
    def test_es_and_it_fallback_via_practice(self):
        """IT guest: Practice resolves a new-lesson question id and falls back to ES
        (pack has no Italian), while the English target answer stays English."""
        slug = "guest-has-had-too-much-to-drink"
        les = requests.get(f"{API}/lessons/{slug}").json()["lesson"]
        q = les["exercises"][0]
        assert q["type"] == "multiple_choice"
        wrong = 0 if q["answer_index"] != 0 else 1

        gid = requests.post(f"{API}/guests", json={}).json()["id"]
        requests.put(f"{API}/guests/{gid}/language", json={"interface_language": "it"})
        aid = requests.post(f"{API}/situation-attempts/start",
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        r = requests.put(f"{API}/situation-attempts/{aid}/response",
                         json={"question_id": q["id"], "section": "exercise", "submitted_answer": wrong})
        assert r.status_code == 200 and r.json()["correct"] is False

        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        mine = [it for it in items if it["source_id"] == q["id"]]
        assert len(mine) == 1, "Practice did not resolve the new question id"
        content = mine[0]["content"]
        # IT falls back to ES prompt (Spanish), not empty.
        assert content["prompt"], "prompt not resolved for IT guest"
        # English target options preserved unchanged.
        assert content["options"] == q["options"]
        assert mine[0]["situation_title"]

        # Grading + explanation resolve (ES fallback) and answer stays English.
        ra = requests.post(f"{API}/review-items/{mine[0]['id']}/answer",
                           json={"submitted_answer": wrong}).json()
        assert ra["correct"] is False
        assert ra["explanation"]
        assert ra["correct_answer"] == q["options"][q["answer_index"]]
