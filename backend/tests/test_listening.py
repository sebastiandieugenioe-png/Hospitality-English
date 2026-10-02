"""
Listening MVP — content, API, audio, persistence and regression tests.
Covers the VALIDAR checklist at content/API/filesystem level (headless; no browser).
Run: cd /app/backend && python -m pytest tests/test_listening.py -v
"""
import json
import os
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
API = open(ROOT.parent / "frontend" / ".env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
BASE = f"{API}/api"
PACK = json.load(open(ROOT / "data" / "listening.json"))
ITEMS = PACK["items"]
AUDIO_DIR = ROOT.parent / "frontend" / "public" / "listening"
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


# ---------- content ----------
def test_50_items():
    assert len(ITEMS) == 50
    assert PACK["item_count"] == 50


def test_role_distribution_25_25():
    roles = {}
    for it in ITEMS:
        roles[it["role"]] = roles.get(it["role"], 0) + 1
    assert roles == {"bartender": 25, "waiter": 25}


def test_all_profession_hospitality():
    assert all(it["profession_id"] == "hospitality" for it in ITEMS)
    assert PACK["profession_id"] == "hospitality"


def test_50_unique_active_slugs():
    slugs = {it["situation_slug"] for it in ITEMS}
    assert len(slugs) == 50


def test_three_options_and_answer_index():
    for it in ITEMS:
        opts = it["option_situation_slugs"]
        assert len(opts) == 3
        assert 0 <= it["answer_index"] < 3
        assert opts[it["answer_index"]] == it["situation_slug"]


def test_ten_languages_complete():
    for it in ITEMS:
        for lang in LANGS:
            assert lang in it["transcript_translations"]
            assert lang in it["model_response_translations"]


def test_api_serves_english_target_verbatim():
    """The English target (transcript_en / model_response_en) is served verbatim
    by the reveal, never rewritten/translated."""
    gid = _new_guest()
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    item = pr["items"][0]
    src = next(i for i in ITEMS if i["id"] == item["id"])
    r = requests.post(f"{BASE}/guests/{gid}/listening-attempts",
                      json={"listening_item_id": item["id"], "selected_index": 0}).json()
    assert r["reveal"]["transcript_en"] == src["transcript_en"]
    assert r["reveal"]["model_response_en"] == src["model_response_en"]


def test_each_item_maps_to_active_situation():
    slugs = [it["situation_slug"] for it in ITEMS]
    data = requests.get(f"{BASE}/situations").json()
    active = {s["slug"] for s in data}
    assert set(slugs).issubset(active)
    assert len(active) == 50  # 50 active situations stay intact


# ---------- audio ----------
def test_50_mp3_generated_nonempty():
    present = [it for it in ITEMS if (AUDIO_DIR / Path(it["audio_asset_key"]).name).exists()]
    assert len(present) == 50
    for it in ITEMS:
        p = AUDIO_DIR / Path(it["audio_asset_key"]).name
        assert p.stat().st_size > 0


def test_mp3_http_accessible_samples():
    for it in ITEMS[:5] + ITEMS[-5:]:
        url = f"{API}{'/' + it['audio_asset_key']}"
        r = requests.get(url, timeout=20)
        assert r.status_code == 200
        assert "audio" in r.headers.get("content-type", "")
        assert len(r.content) > 0


def test_idempotent_generation():
    import subprocess
    before = {p.name: p.stat().st_mtime for p in AUDIO_DIR.glob("*.mp3")}
    out = subprocess.run(
        ["python3", "generate_listening_audio.py"], cwd=str(ROOT), capture_output=True, text=True
    )
    assert "skipped=50" in out.stdout
    assert "generated=0" in out.stdout
    after = {p.name: p.stat().st_mtime for p in AUDIO_DIR.glob("*.mp3")}
    assert before == after  # nothing regenerated


# ---------- API: answer-free item ----------
def test_item_endpoint_answer_free():
    slug = ITEMS[0]["situation_slug"]
    it = requests.get(f"{BASE}/listening/item/{slug}", params={"lang": "es"}).json()
    assert "answer_index" not in it
    assert "transcript_en" not in it
    assert "model_response_en" not in it
    assert len(it["options"]) == 3
    assert it["audio_url"] == "/" + ITEMS[0]["audio_asset_key"]
    assert it["prompt"]  # localized


def test_item_endpoint_localized():
    slug = ITEMS[0]["situation_slug"]
    es = requests.get(f"{BASE}/listening/item/{slug}", params={"lang": "es"}).json()
    fr = requests.get(f"{BASE}/listening/item/{slug}", params={"lang": "fr"}).json()
    assert es["prompt"] != fr["prompt"]


# ---------- API: guest flow ----------
def _new_guest(role="waiter", country="ireland"):
    g = requests.post(f"{BASE}/guests", json={"interface_language": "es"}).json()
    requests.put(
        f"{BASE}/guests/{g['id']}/profile",
        json={"role": role, "venue_type": "casual-restaurant", "target_country": country,
              "goal": "work_abroad", "employment_status": "looking_for_job"},
    )
    return g["id"]


def test_practice_returns_five_hospitality():
    gid = _new_guest()
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    assert pr["session_size"] == 5
    assert pr["profession_id"] == "hospitality"
    assert len(pr["items"]) == 5
    # answer-free
    assert all("answer_index" not in i and "transcript_en" not in i for i in pr["items"])


def test_role_influences_practice():
    gid = _new_guest(role="waiter")
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    # Top of a waiter's ranked session should be dominated by waiter-role items.
    roles = [i["role"] for i in pr["items"]]
    assert roles.count("waiter") >= 3


def test_attempt_scoring_and_persistence():
    gid = _new_guest()
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    item = pr["items"][0]
    # wrong-first then correct; reveal only after answering
    r = requests.post(f"{BASE}/guests/{gid}/listening-attempts",
                      json={"listening_item_id": item["id"], "selected_index": (0)}).json()
    assert "reveal" in r and r["reveal"]["transcript_en"]
    assert r["correct"] == (0 == r["correct_index"])
    r2 = requests.post(f"{BASE}/guests/{gid}/listening-attempts",
                       json={"listening_item_id": item["id"], "selected_index": r["correct_index"]}).json()
    assert r2["correct"] is True
    s = requests.get(f"{BASE}/guests/{gid}/listening-summary").json()
    assert s["attempted"] == 2 and s["correct"] >= 1


def test_attempt_persists_profession_id():
    gid = _new_guest()
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    item = pr["items"][0]
    requests.post(f"{BASE}/guests/{gid}/listening-attempts",
                  json={"listening_item_id": item["id"], "selected_index": 1})
    # Verify via the guest's summary (count) and re-fetch item is still answer-free.
    s = requests.get(f"{BASE}/guests/{gid}/listening-summary").json()
    assert s["attempted"] == 1
    # DB-level check
    import asyncio
    from motor.motor_asyncio import AsyncIOMotorClient
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")

    async def _check():
        db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
        docs = await db.listening_attempts.find({"guest_id": gid}, {"_id": 0}).to_list(10)
        assert docs and all(d["profession_id"] == "hospitality" for d in docs)
        assert all({"situation_slug", "selected_index", "correct", "attempted_at", "interface_language"} <= set(d) for d in docs)

    asyncio.get_event_loop().run_until_complete(_check())


def test_language_change_preserves_attempts():
    gid = _new_guest()
    pr = requests.get(f"{BASE}/guests/{gid}/listening-practice").json()
    item = pr["items"][0]
    requests.post(f"{BASE}/guests/{gid}/listening-attempts",
                  json={"listening_item_id": item["id"], "selected_index": 0})
    before = requests.get(f"{BASE}/guests/{gid}/listening-summary").json()["attempted"]
    requests.put(f"{BASE}/guests/{gid}/language", json={"interface_language": "fr"})
    after = requests.get(f"{BASE}/guests/{gid}/listening-summary").json()["attempted"]
    assert before == after == 1


# ---------- regression ----------
def test_existing_modules_intact():
    assert requests.get(f"{BASE}/assessment/meta").status_code == 200
    assert requests.get(f"{BASE}/emergency").status_code == 200
    assert requests.get(f"{BASE}/tonights-shift/meta").status_code == 200
    assert requests.get(f"{BASE}/job-interview/meta").status_code == 200
    assert requests.get(f"{BASE}/first-week/meta").status_code == 200


def test_recommended_still_3_to_5():
    gid = _new_guest()
    rec = requests.get(f"{BASE}/guests/{gid}/recommended-situations").json()
    assert 3 <= len(rec) <= 5
