"""Backend tests for Emergency Phrases feature + assessment disclaimer patch."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.strip().split("=", 1)[1].rstrip("/")
                break

API = f"{BASE_URL}/api"
EXPECTED_LANGS = {"es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"}
CEFR_TOKENS = ["CEFR", "A1", "A2", "B1", "B2", "C1", "C2"]


@pytest.fixture(scope="module")
def pack():
    r = requests.get(f"{API}/emergency", timeout=20)
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def guest_bartender():
    r = requests.post(f"{API}/guests", json={}, timeout=20)
    assert r.status_code == 200
    gid = r.json()["id"]
    r2 = requests.put(
        f"{API}/guests/{gid}/profile",
        json={"role": "bartender", "venue_type": "pub", "target_country": "ireland",
              "goal": "work_abroad", "employment_status": "looking_for_job"},
        timeout=20,
    )
    assert r2.status_code == 200, r2.text
    return gid


@pytest.fixture(scope="module")
def guest_waiter():
    r = requests.post(f"{API}/guests", json={}, timeout=20)
    assert r.status_code == 200
    gid = r.json()["id"]
    r2 = requests.put(
        f"{API}/guests/{gid}/profile",
        json={"role": "waiter", "venue_type": "pub", "target_country": "ireland",
              "goal": "work_abroad", "employment_status": "looking_for_job"},
        timeout=20,
    )
    assert r2.status_code == 200, r2.text
    return gid


# --- Emergency pack structure ---
class TestEmergencyPack:
    def test_counts(self, pack):
        assert pack["content_count"] == 32
        assert pack["categories_count"] == 8
        assert len(pack["categories"]) == 8
        assert len(pack["phrases"]) == 32

    def test_four_phrases_per_category(self, pack):
        from collections import Counter
        c = Counter(p["category"] for p in pack["phrases"])
        cat_keys = {c["key"] for c in pack["categories"]}
        assert set(c.keys()) == cat_keys
        for k, n in c.items():
            assert n == 4, f"category {k} has {n} phrases"

    def test_phrase_en_is_string_and_10lang_maps(self, pack):
        for p in pack["phrases"]:
            assert isinstance(p["phrase_en"], str) and p["phrase_en"]
            assert set(p["meaning"].keys()) >= EXPECTED_LANGS
            assert set(p["use_note"].keys()) >= EXPECTED_LANGS

    def test_phrase_ids_unique(self, pack):
        ids = [p["id"] for p in pack["phrases"]]
        assert len(ids) == len(set(ids)) == 32

    def test_categories_sorted_by_order(self, pack):
        orders = [c["order"] for c in pack["categories"]]
        assert orders == sorted(orders)


# --- Guest default saved_emergency_phrase_ids ---
class TestGuestSavedField:
    def test_new_guest_has_empty_saved(self):
        r = requests.post(f"{API}/guests", json={}, timeout=20)
        gid = r.json()["id"]
        g = requests.get(f"{API}/guests/{gid}").json()
        assert g["saved_emergency_phrase_ids"] == []

    def test_legacy_guest_default(self):
        # Simulate legacy by creating guest and GETing - server setdefaults []
        r = requests.post(f"{API}/guests", json={}, timeout=20)
        gid = r.json()["id"]
        g = requests.get(f"{API}/guests/{gid}").json()
        assert "saved_emergency_phrase_ids" in g
        assert isinstance(g["saved_emergency_phrase_ids"], list)


# --- Save / Remove ---
class TestSaveRemove:
    def test_save_unknown_phrase_422(self, guest_bartender):
        r = requests.post(f"{API}/guests/{guest_bartender}/saved-phrases",
                          json={"phrase_id": "ep_does_not_exist"}, timeout=20)
        assert r.status_code == 422

    def test_save_nonexistent_guest_404(self, pack):
        pid = pack["phrases"][0]["id"]
        r = requests.post(f"{API}/guests/no-such-guest/saved-phrases",
                          json={"phrase_id": pid}, timeout=20)
        assert r.status_code == 404

    def test_save_persists_and_remove(self, guest_bartender, pack):
        pid = pack["phrases"][0]["id"]
        r = requests.post(f"{API}/guests/{guest_bartender}/saved-phrases",
                          json={"phrase_id": pid}, timeout=20)
        assert r.status_code == 200
        assert pid in r.json()["saved_emergency_phrase_ids"]
        # idempotent (addToSet)
        r2 = requests.post(f"{API}/guests/{guest_bartender}/saved-phrases",
                           json={"phrase_id": pid}, timeout=20)
        assert r2.json()["saved_emergency_phrase_ids"].count(pid) == 1
        # verify via GET /guests/{id}
        g = requests.get(f"{API}/guests/{guest_bartender}").json()
        assert pid in g["saved_emergency_phrase_ids"]
        # list endpoint
        lst = requests.get(f"{API}/guests/{guest_bartender}/saved-phrases").json()
        assert pid in lst["saved_emergency_phrase_ids"]
        # Remove
        rd = requests.delete(f"{API}/guests/{guest_bartender}/saved-phrases/{pid}", timeout=20)
        assert rd.status_code == 200
        assert pid not in rd.json()["saved_emergency_phrase_ids"]

    def test_role_change_preserves_saved(self, pack):
        r = requests.post(f"{API}/guests", json={}, timeout=20)
        gid = r.json()["id"]
        requests.put(f"{API}/guests/{gid}/profile", json={
            "role": "bartender", "venue_type": "pub", "target_country": "ireland",
            "goal": "work_abroad", "employment_status": "looking_for_job"}, timeout=20)
        pid = pack["phrases"][2]["id"]
        requests.post(f"{API}/guests/{gid}/saved-phrases", json={"phrase_id": pid}, timeout=20)
        # Change role
        requests.put(f"{API}/guests/{gid}/profile", json={
            "role": "waiter", "venue_type": "pub", "target_country": "ireland",
            "goal": "work_abroad", "employment_status": "looking_for_job"}, timeout=20)
        g = requests.get(f"{API}/guests/{gid}").json()
        assert pid in g["saved_emergency_phrase_ids"]

    def test_language_change_preserves_saved(self, pack):
        r = requests.post(f"{API}/guests", json={}, timeout=20)
        gid = r.json()["id"]
        pid = pack["phrases"][3]["id"]
        requests.post(f"{API}/guests/{gid}/saved-phrases", json={"phrase_id": pid}, timeout=20)
        requests.put(f"{API}/guests/{gid}/language", json={"interface_language": "it"}, timeout=20)
        g = requests.get(f"{API}/guests/{gid}").json()
        assert pid in g["saved_emergency_phrase_ids"]


# --- Assessment disclaimer patch ---
class TestAssessmentDisclaimer:
    def test_note_no_cefr_in_all_langs(self):
        r = requests.get(f"{API}/assessment/meta", timeout=20)
        assert r.status_code == 200
        ui = r.json()["ui"]
        note = ui.get("note", {})
        # note is a language map
        assert isinstance(note, dict)
        missing = EXPECTED_LANGS - set(note.keys())
        assert not missing, f"note missing langs: {missing}"
        for lang, text in note.items():
            for tok in CEFR_TOKENS:
                assert tok not in text, f"{lang} note contains {tok}: {text!r}"


# --- Catalog still intact ---
class TestCatalog:
    def test_fifty_situations(self):
        r = requests.get(f"{API}/situations", timeout=20)
        assert r.status_code == 200
        sits = r.json()
        actives = [s for s in sits if s.get("active", True)]
        assert len(actives) == 50
        bart = [s for s in actives if "bartender" in (s.get("roles") or [])]
        wait = [s for s in actives if "waiter" in (s.get("roles") or [])]
        assert len(bart) == 25
        assert len(wait) == 25


# --- Idempotency ---
class TestIdempotency:
    def test_emergency_pack_stable(self):
        r1 = requests.get(f"{API}/emergency", timeout=20).json()
        r2 = requests.get(f"{API}/emergency", timeout=20).json()
        assert r1["content_count"] == r2["content_count"] == 32
        assert len(r1["phrases"]) == len(r2["phrases"]) == 32
