"""Independent verification of the categories i18n overlay (micro-pack v1).

Covers: category set/slugs, preserved icon/order/name_en, translations for all
10 langs, FR/DE/UK/EN name+description resolution, 'pt' (not 'pt-PT') code,
ES fallback + ES preservation, and that situations were not touched.
"""
import json
import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE_URL = base_url.rstrip("/")

LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
EXPECTED = {
    "general": ("sparkles", 1),
    "restaurant": ("utensils", 2),
    "bar": ("wine", 3),
    "hotel": ("bed-double", 4),
    "coffee": ("coffee", 5),
    "kitchen": ("chef-hat", 6),
    "housekeeping": ("brush", 7),
}
EXPECTED_NAME_EN = {"bar": "Bar", "hotel": "Hotel / Reception", "coffee": "Coffee Shop"}

PACK = json.loads(
    Path("/app/backend/data/mvp_categories_i18n_micro_pack_v1.json").read_text(encoding="utf-8")
)
PACK_BY_SLUG = {c["slug"]: c for c in PACK["categories"]}


def _resolve(obj, base, lang):
    """Mirror of frontend getLocalizedField."""
    tr = obj.get("translations") or {}
    if tr.get(lang) and tr[lang].get(base) is not None:
        return tr[lang][base]
    if obj.get(f"{base}_{lang}") is not None:
        return obj[f"{base}_{lang}"]
    if tr.get("es") and tr["es"].get(base) is not None:
        return tr["es"][base]
    if obj.get(f"{base}_es") is not None:
        return obj[f"{base}_es"]
    return None


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def categories(client):
    r = client.get(f"{BASE_URL}/api/categories", timeout=30)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert isinstance(data, list)
    return data


# --- categories collection / taxonomy integrity ---
class TestCategoryIntegrity:
    def test_exactly_seven_expected_slugs(self, categories):
        assert len(categories) == 7, [c.get("slug") for c in categories]
        assert {c["slug"] for c in categories} == set(EXPECTED)

    def test_no_mongo_id_leaked(self, categories):
        for c in categories:
            assert "_id" not in c

    def test_icon_and_order_preserved(self, categories):
        for c in categories:
            icon, order = EXPECTED[c["slug"]]
            assert c.get("icon") == icon, (c["slug"], c.get("icon"))
            assert c.get("order") == order, (c["slug"], c.get("order"))

    def test_sorted_by_order(self, categories):
        assert [c["order"] for c in categories] == sorted(c["order"] for c in categories)

    def test_name_en_preserved(self, categories):
        by_slug = {c["slug"]: c for c in categories}
        for slug, expected in EXPECTED_NAME_EN.items():
            assert by_slug[slug].get("name_en") == expected
        for c in categories:
            assert c.get("name_en"), c["slug"]

    def test_single_category_endpoint_matches_list(self, client, categories):
        r = client.get(f"{BASE_URL}/api/categories/bar", timeout=30)
        assert r.status_code == 200
        doc = r.json()
        assert doc["slug"] == "bar"
        assert doc["icon"] == "wine" and doc["order"] == 3
        assert doc["translations"]["fr"]["name"] == PACK_BY_SLUG["bar"]["translations"]["fr"]["name"]

    def test_unknown_slug_returns_404(self, client):
        r = client.get(f"{BASE_URL}/api/categories/TEST_does_not_exist", timeout=30)
        assert r.status_code == 404, r.status_code


# --- translations overlay ---
class TestCategoryTranslations:
    def test_all_ten_languages_present_non_empty(self, categories):
        for c in categories:
            tr = c.get("translations") or {}
            assert set(LANGS).issubset(set(tr)), (c["slug"], sorted(tr))
            for lang in LANGS:
                assert tr[lang].get("name"), (c["slug"], lang, "name")
                assert tr[lang].get("description"), (c["slug"], lang, "description")

    @pytest.mark.parametrize("lang", ["fr", "de", "uk", "en"])
    def test_resolver_matches_pack(self, categories, lang):
        for c in categories:
            expected = PACK_BY_SLUG[c["slug"]]["translations"][lang]
            assert _resolve(c, "name", lang) == expected["name"], (c["slug"], lang)
            assert _resolve(c, "description", lang) == expected["description"], (c["slug"], lang)

    def test_portuguese_code_is_pt_not_pt_pt(self, categories):
        for c in categories:
            tr = c["translations"]
            assert "pt" in tr
            assert "pt-PT" not in tr
            assert tr["pt"]["name"] == PACK_BY_SLUG[c["slug"]]["translations"]["pt"]["name"]

    def test_languages_endpoint_uses_pt(self, client):
        r = client.get(f"{BASE_URL}/api/languages", timeout=30)
        assert r.status_code == 200
        body = r.json()
        codes = [l.get("code") for l in (body if isinstance(body, list) else body.get("languages", []))]
        assert "pt" in codes
        assert "pt-PT" not in codes

    def test_spanish_values_preserved(self, categories):
        for c in categories:
            assert c["translations"]["es"]["name"] == c.get("name_es"), c["slug"]
            if c.get("description_es") is not None:
                assert c["translations"]["es"]["description"] == c["description_es"], c["slug"]

    def test_fallback_to_spanish_for_unsupported_language(self, categories):
        for c in categories:
            val = _resolve(c, "name", "zz")
            assert val is not None
            assert val == c["translations"]["es"]["name"]
            desc = _resolve(c, "description", "zz")
            assert desc == c["translations"]["es"]["description"]


# --- nothing else changed ---
class TestNoCollateralChange:
    def test_twenty_active_situations(self, client):
        r = client.get(f"{BASE_URL}/api/situations", timeout=30)
        assert r.status_code == 200, r.text[:300]
        sits = r.json()
        sits = sits if isinstance(sits, list) else sits.get("situations", [])
        active = [s for s in sits if s.get("active", True)]
        assert len(active) == 20, len(active)
        roles = {}
        for s in active:
            for role in s.get("roles") or ["unknown"]:
                roles[role] = roles.get(role, 0) + 1
        assert roles.get("bartender") == 10, roles
        assert roles.get("waiter") == 10, roles

    def test_situations_still_localized(self, client):
        r = client.get(f"{BASE_URL}/api/situations", timeout=30)
        sits = r.json()
        sits = sits if isinstance(sits, list) else sits.get("situations", [])
        s = sits[0]
        assert _resolve(s, "title", "fr"), s.get("slug")


# --- guest interface_language plumbing used by the frontend test ---
class TestGuestInterfaceLanguage:
    def test_create_guest_with_fr_and_read_back(self, client):
        r = client.post(f"{BASE_URL}/api/guests", json={"interface_language": "fr"}, timeout=30)
        assert r.status_code in (200, 201), r.text[:300]
        g = r.json()
        assert g.get("interface_language") == "fr"
        gid = g.get("id")
        assert isinstance(gid, str) and gid
        r2 = client.get(f"{BASE_URL}/api/guests/{gid}", timeout=30)
        if r2.status_code == 200:
            assert r2.json().get("interface_language") == "fr"
