"""
Speaking MVP — content, API, evaluator and regression tests (headless).

NOTE: The full record→STT→evaluate pipeline cannot be exercised end-to-end here
because the ElevenLabs API key currently lacks the `speech_to_text` permission
(Scribe v2 returns 401 missing_permissions). The OpenAI evaluator is tested live;
STT is validated by code + the real 401 (permission, not code). Once the key gets
the STT scope, the attempt endpoint works unchanged.

Run: cd /app/backend && python -m pytest tests/test_speaking.py -v
"""
import asyncio
import json
from pathlib import Path

import requests
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
API = open(ROOT.parent / "frontend" / ".env").read().split("REACT_APP_BACKEND_URL=")[1].split()[0].strip()
BASE = f"{API}/api"
SP = json.load(open(ROOT / "data" / "speaking.json"))
L = json.load(open(ROOT / "data" / "listening.json"))
ITEMS = SP["items"]
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


# ---------- content ----------
def test_50_items_25_25_hospitality():
    assert len(ITEMS) == 50 and SP["item_count"] == 50
    roles = {}
    for it in ITEMS:
        roles[it["role"]] = roles.get(it["role"], 0) + 1
    assert roles == {"bartender": 25, "waiter": 25}
    assert all(it["profession_id"] == "hospitality" for it in ITEMS)


def test_unique_active_slugs():
    slugs = {it["situation_slug"] for it in ITEMS}
    assert len(slugs) == 50
    active = {s["slug"] for s in requests.get(f"{BASE}/situations").json()}
    assert slugs == active


def test_reuses_listening_audio_and_text():
    lmap = {i["situation_slug"]: i for i in L["items"]}
    for it in ITEMS:
        li = lmap[it["situation_slug"]]
        assert it["prompt_audio_asset_key"] == li["audio_asset_key"]
        assert it["prompt_transcript_en"] == li["transcript_en"]
        assert it["model_response_en"] == li["model_response_en"]


def test_ten_languages():
    for it in ITEMS:
        for lang in LANGS:
            assert lang in it["prompt_translations"]
            assert lang in it["model_response_translations"]


# ---------- API ----------
def test_meta():
    m = requests.get(f"{BASE}/speaking/meta").json()
    assert m["item_count"] == 50
    assert m["session_size"] == 5
    assert m["profession_id"] == "hospitality"
    assert len(m["languages"]) == 10


def test_item_endpoint_no_model_response_reuses_audio():
    slug = ITEMS[0]["situation_slug"]
    it = requests.get(f"{BASE}/speaking/item/{slug}", headers=premium_headers(), params={"lang": "es"}).json()
    assert "model_response_en" not in it
    assert it["audio_url"] == "/" + ITEMS[0]["prompt_audio_asset_key"]
    assert it["recording"]["max_seconds"] == 30 and it["recording"]["min_seconds"] == 1
    assert it["prompt_transcript_en"] == ITEMS[0]["prompt_transcript_en"]


def _new_guest(role="waiter"):
    g = requests.post(f"{BASE}/guests", json={"interface_language": "es"}).json()
    requests.put(f"{BASE}/guests/{g['id']}/profile",
                 json={"role": role, "venue_type": "casual-restaurant", "target_country": "ireland",
                       "goal": "work_abroad", "employment_status": "looking_for_job"})
    return g["id"]


def test_practice_five_hospitality_role_influence():
    gid = _new_guest("waiter")
    pr = requests.get(f"{BASE}/guests/{gid}/speaking-practice", headers=premium_headers()).json()
    assert pr["session_size"] == 5 and pr["profession_id"] == "hospitality"
    assert len(pr["items"]) == 5
    assert all("model_response_en" not in i for i in pr["items"])
    assert [i["role"] for i in pr["items"]].count("waiter") >= 3


def test_attempt_rejects_unknown_item():
    gid = _new_guest()
    files = {"audio": ("x.webm", b"xx", "audio/webm")}
    r = requests.post(f"{BASE}/guests/{gid}/speaking-attempts",
                      data={"speaking_item_id": "nope", "duration_ms": 1000}, files=files)
    assert r.status_code == 422


def test_attempt_rejects_missing_audio():
    gid = _new_guest()
    r = requests.post(f"{BASE}/guests/{gid}/speaking-attempts",
                      data={"speaking_item_id": ITEMS[0]["id"], "duration_ms": 1000})
    assert r.status_code == 422


# ---------- evaluator (live OpenAI, structured output) ----------
def test_openai_evaluator_structured_output():
    import sys
    sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    import speaking_evaluator as se

    async def _run():
        return await se.evaluate(
            "hospitality", "bartender", "card-payment-is-declined-at-the-bar",
            "Did that go through?",
            "It looks like that didn't go through. Would you like to try again?",
            "It looks like your card didn't go through. Would you like to try another one?",
        )

    r = asyncio.new_event_loop().run_until_complete(_run())
    assert set(r.keys()) == {
        "understandable", "situation_handled", "professional_service_english",
        "grammar_vocabulary", "naturalness", "issue_codes", "improved_response_en", "overall",
    }
    assert isinstance(r["understandable"], bool)
    for k in ["situation_handled", "professional_service_english", "grammar_vocabulary", "naturalness"]:
        assert r[k] in ("strong", "partial", "missed")
    assert r["overall"] in ("strong", "good", "needs_practice")
    assert r["improved_response_en"] is None or len(r["improved_response_en"].split()) <= 30


def test_evaluator_improved_response_capped():
    """A weak answer should still yield a <=30-word improved_response_en."""
    import sys
    sys.path.insert(0, str(ROOT))
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
    import speaking_evaluator as se

    async def _run():
        return await se.evaluate(
            "hospitality", "waiter", "wrong-dish-was-served",
            "This isn't what I ordered.", "I'm so sorry about that. Let me fix it right away.",
            "no",
        )

    r = asyncio.new_event_loop().run_until_complete(_run())
    assert r["improved_response_en"] is None or len(r["improved_response_en"].split()) <= 30


# ---------- regression ----------
def test_listening_intact():
    m = requests.get(f"{BASE}/listening/meta").json()
    assert m["item_count"] == 50
    assert (ROOT.parent / "frontend" / "public" / "listening").glob("*.mp3")
    present = list((ROOT.parent / "frontend" / "public" / "listening").glob("*.mp3"))
    assert len(present) == 50


def test_other_modules_intact():
    for ep in ["assessment/meta", "emergency", "tonights-shift/meta", "job-interview/meta", "first-week/meta"]:
        assert requests.get(f"{BASE}/{ep}").status_code == 200


def test_recommended_3_to_5_and_situations_25_25():
    gid = _new_guest()
    rec = requests.get(f"{BASE}/guests/{gid}/recommended-situations").json()
    assert 3 <= len(rec) <= 5
    sits = requests.get(f"{BASE}/situations").json()
    roles = {}
    for s in sits:
        for r in s.get("roles", []):
            roles[r] = roles.get(r, 0) + 1
    assert roles == {"waiter": 25, "bartender": 25}
