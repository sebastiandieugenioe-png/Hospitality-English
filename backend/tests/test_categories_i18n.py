"""Targeted tests for the categories i18n micro-pack import (read-only overlay)."""
import os
import json
from pathlib import Path

import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"

PACK = json.load(open(Path("/app/backend/data/mvp_categories_i18n_micro_pack_v1.json"), encoding="utf-8"))
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]

# Frozen pre-import invariants (must never change).
EXPECTED = {
    "general": {"icon": "sparkles", "order": 1, "name_en": "General Hospitality"},
    "restaurant": {"icon": "utensils", "order": 2, "name_en": "Restaurant"},
    "bar": {"icon": "wine", "order": 3, "name_en": "Bar"},
    "hotel": {"icon": "bed-double", "order": 4, "name_en": "Hotel / Reception"},
    "coffee": {"icon": "coffee", "order": 5, "name_en": "Coffee Shop"},
    "kitchen": {"icon": "chef-hat", "order": 6, "name_en": "Kitchen"},
    "housekeeping": {"icon": "brush", "order": 7, "name_en": "Housekeeping"},
}


def _resolve(obj, base, lang):
    """Mirror of getLocalizedField / _loc_field (grouped + suffix, es fallback)."""
    tr = obj.get("translations") or {}
    if isinstance(tr.get(lang), dict) and tr[lang].get(base) is not None:
        return tr[lang][base]
    if obj.get(f"{base}_{lang}") is not None:
        return obj[f"{base}_{lang}"]
    if isinstance(tr.get("es"), dict) and tr["es"].get(base) is not None:
        return tr["es"][base]
    if obj.get(f"{base}_es") is not None:
        return obj[f"{base}_es"]
    return None


def _categories():
    return {c["slug"]: c for c in requests.get(f"{API}/categories").json()}


class TestCategoriesIntact:
    def test_seven_exist_with_frozen_fields(self):
        cats = _categories()
        assert set(cats) == set(EXPECTED)
        for slug, exp in EXPECTED.items():
            c = cats[slug]
            assert c["icon"] == exp["icon"], f"{slug} icon changed"
            assert c["order"] == exp["order"], f"{slug} order changed"
            assert c["name_en"] == exp["name_en"], f"{slug} name_en changed"
            # Spanish preserved exactly (both legacy field and translation).
            assert c.get("name_es")
            assert _resolve(c, "name", "es") == c["name_es"]

    def test_category_slug_matches_detail_endpoint_id_stable(self):
        # /categories/{slug} resolves and keeps the same slug.
        for slug in EXPECTED:
            c = requests.get(f"{API}/categories/{slug}").json()
            assert c["slug"] == slug


class TestCategoryResolution:
    def test_resolves_in_fr_de_uk_en(self):
        cats = _categories()
        for slug in EXPECTED:
            c = cats[slug]
            for lang in ("fr", "de", "uk", "en"):
                name = _resolve(c, "name", lang)
                desc = _resolve(c, "description", lang)
                assert name == PACK_LOOKUP[slug]["translations"][lang]["name"], f"{slug}/{lang} name"
                assert desc == PACK_LOOKUP[slug]["translations"][lang]["description"], f"{slug}/{lang} desc"

    def test_all_ten_languages_present(self):
        cats = _categories()
        for slug in EXPECTED:
            for lang in LANGS:
                assert _resolve(cats[slug], "name", lang)
                assert _resolve(cats[slug], "description", lang)

    def test_pt_code_is_pt(self):
        cats = _categories()
        assert "pt" in cats["bar"]["translations"]
        assert "pt-PT" not in cats["bar"]["translations"]
        codes = [l["code"] for l in requests.get(f"{API}/languages").json()]
        assert "pt" in codes and "pt-PT" not in codes

    def test_fallback_to_es_for_missing_language(self):
        cats = _categories()
        # unknown interface language falls back to Spanish, never null
        assert _resolve(cats["bar"], "name", "zz") == cats["bar"]["translations"]["es"]["name"]
        assert _resolve(cats["restaurant"], "description", "zz") == cats["restaurant"]["translations"]["es"]["description"]


class TestSituationsUntouched:
    def test_twenty_situations(self):
        assert len(requests.get(f"{API}/situations").json()) == 50
        assert len(requests.get(f"{API}/situations", params={"role": "bartender"}).json()) == 25
        assert len(requests.get(f"{API}/situations", params={"role": "waiter"}).json()) == 25


PACK_LOOKUP = {c["slug"]: c for c in PACK["categories"]}
