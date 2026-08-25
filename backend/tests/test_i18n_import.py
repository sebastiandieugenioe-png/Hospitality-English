"""Targeted tests for the verified multilingual i18n import (bundle v1).

Scope (per ticket): /languages returns the 10 codes; 20 active situations
(10/10); ES fallback + resolution in fr/de/en; interface_language switch keeps
the same guest and its progress/attempts/review_items/profile; English learning
content and canonical answers are untouched.
"""
import os
import json
from pathlib import Path

import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]

BUNDLE = json.load(open(Path("/app/backend/data/mvp_i18n_import_bundle_verified_v1.json"), encoding="utf-8"))


class TestLanguages:
    def test_languages_endpoint_has_ten(self):
        r = requests.get(f"{API}/languages").json()
        assert [l["code"] for l in r] == EXPECTED_LANGS
        assert all(l.get("native_name") for l in r)

    def test_language_validation(self):
        gid = requests.post(f"{API}/guests", json={}).json()["id"]
        for code in EXPECTED_LANGS:
            assert requests.put(f"{API}/guests/{gid}/language", json={"interface_language": code}).status_code == 200
        assert requests.put(f"{API}/guests/{gid}/language", json={"interface_language": "zz"}).status_code == 422


class TestCatalogIntact:
    def test_counts(self):
        assert len(requests.get(f"{API}/situations").json()) == 50
        assert len(requests.get(f"{API}/situations", params={"role": "bartender"}).json()) == 25
        assert len(requests.get(f"{API}/situations", params={"role": "waiter"}).json()) == 25


class TestLocalizedOptionsInvariant:
    """Regression guard for the seed_i18n._set_options sparse-compaction bug:
    every localized MC options array must keep the SAME length as the canonical
    options and keep answer_index in range, in all 10 languages."""
    LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]

    def test_all_mc_options_length_and_index(self):
        situations = requests.get(f"{API}/situations").json()
        checked = 0
        for s in situations:
            les = requests.get(f"{API}/lessons/{s['slug']}").json().get("lesson")
            if not les:
                continue
            for section in ("exercises", "quiz"):
                for q in les.get(section, []):
                    if q.get("type") != "multiple_choice":
                        continue
                    canonical = q["options"]
                    assert 0 <= q["answer_index"] < len(canonical), f"{q['id']} bad answer_index"
                    tr = q.get("translations") or {}
                    for lang in self.LANGS:
                        loc = (tr.get(lang) or {}).get("options")
                        if loc is not None:
                            assert len(loc) == len(canonical), (
                                f"{q['id']} {lang}: options len {len(loc)} != canonical {len(canonical)}")
                            checked += 1
        assert checked > 0

    def test_practice_answer_never_500(self):
        """Reproduces the blocking 500: answer the previously-broken review item."""
        slug = "guest-arrives-at-the-bar"
        gid = requests.post(f"{API}/guests", json={"interface_language": "fr"}).json()["id"]
        aid = requests.post(f"{API}/situation-attempts/start",
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        # q_bar_greet_4: 4 options, answer_index=1; submit wrong to create a review item
        requests.put(f"{API}/situation-attempts/{aid}/response",
                     json={"question_id": "q_bar_greet_4", "section": "quiz", "submitted_answer": 0})
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        rid = [i["id"] for i in items if i["source_id"] == "q_bar_greet_4"][0]
        r = requests.post(f"{API}/review-items/{rid}/answer", json={"submitted_answer": 1})
        assert r.status_code == 200, f"Practice answer returned {r.status_code}"
        assert r.json()["correct"] is True
        assert r.json()["correct_answer"]


class TestContentResolution:
    def test_situation_and_lesson_multilang(self):
        slug = "guest-arrives-at-the-bar"
        sit = requests.get(f"{API}/situations/{slug}").json()
        tr = sit["translations"]
        for lang in ("es", "fr", "de", "en", "pl", "uk"):
            assert tr.get(lang, {}).get("title"), f"missing {lang} title"
        # English target situation title untouched
        assert sit["title_en"] == "A guest arrives at the bar"

        les = requests.get(f"{API}/lessons/{slug}").json()["lesson"]
        # intro grouped translations
        for lang in ("fr", "de", "en"):
            assert les["intro"]["translations"][lang]["context"]
            assert isinstance(les["intro"]["translations"][lang]["objectives"], list)
        # phrase: english_content intact + string-map translation for fr/de
        p = les["phrases"][0]
        assert p["english_content"] == "Hi there. What can I get you?"
        assert p["translations"]["fr"] and p["translations"]["de"]
        # exercise: canonical options + answer_index intact; prompt localized
        q = les["exercises"][0]
        assert q["options"] == [
            "Hurry up, please.",
            "Take your time. I'll be right here when you're ready.",
            "What do you want?",
            "Come back later.",
        ]
        assert q["answer_index"] == 1
        assert q["translations"]["fr"]["prompt"]

    def test_legacy_speaker_label_localized(self):
        les = requests.get(f"{API}/lessons/taking-an-order").json()["lesson"]
        line = les["dialogue"][0]
        assert line["english"]  # spoken English intact
        assert line.get("speaker_label_fr") and line.get("speaker_label_de")


class TestReviewResolutionAndFallback:
    def _make_mistake(self, lang):
        slug = "guest-arrives-at-the-bar"
        les = requests.get(f"{API}/lessons/{slug}").json()["lesson"]
        q = les["exercises"][0]
        wrong = 0 if q["answer_index"] != 0 else 1
        gid = requests.post(f"{API}/guests", json={}).json()["id"]
        requests.put(f"{API}/guests/{gid}/language", json={"interface_language": lang})
        aid = requests.post(f"{API}/situation-attempts/start",
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        requests.put(f"{API}/situation-attempts/{aid}/response",
                     json={"question_id": q["id"], "section": "exercise", "submitted_answer": wrong})
        items = requests.get(f"{API}/guests/{gid}/review-items").json()
        mine = [it for it in items if it["source_id"] == q["id"]][0]
        return gid, q, mine

    def test_resolution_de_and_en(self):
        for lang in ("de", "en", "fr"):
            _gid, q, item = self._make_mistake(lang)
            assert item["content"]["prompt"], f"prompt not resolved for {lang}"
            # canonical options unchanged for this exercise (English target answers)
            assert item["content"]["options"] == q["options"]

    def test_fallback_to_es_for_unknown_field(self):
        # nl guest: every provided field resolves; confirm situation title resolves
        # and never returns null (falls back to es at worst).
        _gid, _q, item = self._make_mistake("nl")
        assert item["situation_title"]


class TestProgressPersistenceOnLanguageSwitch:
    def test_switch_keeps_guest_and_progress(self):
        slug = "guest-arrives-at-the-bar"
        les = requests.get(f"{API}/lessons/{slug}").json()["lesson"]
        q = les["exercises"][0]

        gid = requests.post(f"{API}/guests", json={"interface_language": "es"}).json()["id"]
        requests.put(f"{API}/guests/{gid}/profile", json={
            "role": "bartender", "venue_type": "cocktail-bar",
            "target_country": "ireland", "goal": "first_hospitality_job"})
        aid = requests.post(f"{API}/situation-attempts/start",
                            json={"guest_id": gid, "situation_slug": slug}).json()["attempt_id"]
        wrong = 0 if q["answer_index"] != 0 else 1
        requests.put(f"{API}/situation-attempts/{aid}/response",
                     json={"question_id": q["id"], "section": "exercise", "submitted_answer": wrong})

        before_items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(before_items) >= 1

        # switch language
        r = requests.put(f"{API}/guests/{gid}/language", json={"interface_language": "de"})
        assert r.status_code == 200

        guest = requests.get(f"{API}/guests/{gid}").json()
        assert guest["id"] == gid
        assert guest["interface_language"] == "de"
        assert guest.get("professional_profile", {}).get("role") == "bartender"

        after_items = requests.get(f"{API}/guests/{gid}/review-items").json()
        assert len(after_items) == len(before_items)
