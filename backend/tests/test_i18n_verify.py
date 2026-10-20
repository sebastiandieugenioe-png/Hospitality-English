"""Independent verification of the multilingual i18n overlay (T1 agent).

Covers: /api/languages registry, situation counts per role, multi-language
content resolution on lessons, legacy dialogue speaker labels, language switch
preserving guest + progress, language validation, and review-item resolution
for non-ES interface languages.
"""
import os

import pytest
import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
base_url = os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")
if not base_url:
    raise RuntimeError("REACT_APP_BACKEND_URL missing")
BASE = base_url.rstrip("/") + "/api"

EXPECTED_LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
SLUG = "guest-arrives-at-the-bar"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def lesson(client):
    r = client.get(f"{BASE}/lessons/{SLUG}", headers=premium_headers(), timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ---------- languages registry ----------
def test_languages_registry(client):
    r = client.get(f"{BASE}/languages", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert [l["code"] for l in data] == EXPECTED_LANGS
    for l in data:
        assert l.get("native_name"), l


# ---------- situations counts ----------
def test_situation_counts(client):
    r = client.get(f"{BASE}/situations", timeout=30)
    assert r.status_code == 200
    all_sits = r.json()
    assert all(s.get("active") for s in all_sits)
    assert len(all_sits) == 50, f"expected 50 active situations, got {len(all_sits)}"
    for role in ("bartender", "waiter"):
        rr = client.get(f"{BASE}/situations", params={"role": role}, timeout=30)
        assert rr.status_code == 200
        assert len(rr.json()) == 25, f"{role}: {len(rr.json())}"


# ---------- multilingual content resolution ----------
def test_situation_translations(lesson):
    tr = lesson["situation"].get("translations") or {}
    for lang in ("fr", "de", "en", "pl", "uk"):
        assert lang in tr, f"missing situation translations.{lang}"
        assert tr[lang].get("title"), f"missing title for {lang}"


def test_lesson_intro_translations(lesson):
    intro = lesson["lesson"]["intro"]
    tr = intro.get("translations") or {}
    for lang in ("fr", "de", "en"):
        assert lang in tr, f"missing intro translations.{lang}"
        assert tr[lang].get("context"), f"missing context {lang}"
        objs = tr[lang].get("objectives")
        assert isinstance(objs, list) and objs, f"objectives not a non-empty list for {lang}: {objs}"


def test_phrase_english_untouched_with_translations(lesson):
    phrase = lesson["lesson"]["phrases"][0]
    assert phrase["english_content"] == "Hi there. What can I get you?"
    tr = phrase.get("translations") or {}
    for lang in ("fr", "de"):
        assert isinstance(tr.get(lang), str) and tr[lang].strip(), f"{lang}: {tr.get(lang)!r}"


def test_exercise_canonical_english_and_prompt_translation(lesson):
    ex = lesson["lesson"]["exercises"][0]
    assert ex["answer_index"] == 1, ex.get("answer_index")
    opts = ex["options"]
    assert all(isinstance(o, str) for o in opts)
    tr = ex.get("translations") or {}
    assert tr.get("fr", {}).get("prompt"), "missing exercise translations.fr.prompt"
    # Localized option blocks (added in the MC options phase) must mirror the canonical set.
    for lang, block in tr.items():
        if "options" in block:
            loc = block["options"]
            assert len(loc) == len(opts) and all(isinstance(o, str) and o.strip() for o in loc), lang


def test_legacy_dialogue_speaker_labels(client):
    r = client.get(f"{BASE}/lessons/taking-an-order", headers=premium_headers(), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    dialogue = body["lesson"]["dialogue"]
    line = dialogue[0]
    assert line.get("english"), "dialogue[0].english missing"
    assert line.get("speaker_label_fr"), "speaker_label_fr missing"
    assert line.get("speaker_label_de"), "speaker_label_de missing"


# ---------- language switch preserves guest & progress ----------
def _taxonomy_profile(client, role="bartender"):
    venue = client.get(f"{BASE}/venue-types", timeout=30).json()[0]["slug"]
    country = client.get(f"{BASE}/target-countries", timeout=30).json()[0]["id"]
    goal = client.get(f"{BASE}/learning-goals", timeout=30).json()[0]["id"]
    return {
        "role": role,
        "venue_type": venue,
        "target_country": country,
        "goal": goal,
        "english_level": "a1",
    }


def test_language_switch_preserves_guest_and_progress(client):
    g = client.post(f"{BASE}/guests", json={"interface_language": "es"}, timeout=30)
    assert g.status_code == 200, g.text
    gid = g.json()["id"]

    prof = client.put(f"{BASE}/guests/{gid}/profile", json=_taxonomy_profile(client), timeout=30)
    assert prof.status_code == 200, prof.text
    assert prof.json()["professional_profile"]["role"] == "bartender"

    st = client.post(f"{BASE}/situation-attempts/start", headers=premium_headers(), json={"guest_id": gid, "situation_slug": SLUG}, timeout=30)
    assert st.status_code == 200, st.text
    attempt_id = st.json()["attempt_id"]

    lesson = client.get(f"{BASE}/lessons/{SLUG}", headers=premium_headers(), timeout=30).json()
    ex = lesson["lesson"]["exercises"][0]
    wrong = ex["options"][(ex["answer_index"] + 1) % len(ex["options"])]
    resp = client.put(
        f"{BASE}/situation-attempts/{attempt_id}/response",
        json={"question_id": ex["id"], "section": "exercise", "submitted_answer": wrong},
        timeout=30,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["correct"] is False

    before = client.get(f"{BASE}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
    assert len(before) >= 1, "wrong answer did not create review item"

    sw = client.put(f"{BASE}/guests/{gid}/language", json={"interface_language": "de"}, timeout=30)
    assert sw.status_code == 200, sw.text
    body = sw.json()
    assert body["id"] == gid
    assert body["interface_language"] == "de"
    assert body["professional_profile"]["role"] == "bartender"

    after = client.get(f"{BASE}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
    assert len(after) == len(before)

    # review content resolves for de / en / fr, English answers untouched
    canonical_options = ex["options"]
    for lang in ("de", "en", "fr"):
        assert client.put(f"{BASE}/guests/{gid}/language", json={"interface_language": lang}, timeout=30).status_code == 200
        items = client.get(f"{BASE}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
        target = [i for i in items if i["source_id"] == ex["id"]]
        assert target, f"review item for {ex['id']} missing in {lang}"
        content = target[0]["content"]
        assert content.get("prompt"), f"empty prompt for {lang}: {content}"
        assert content.get("options") == canonical_options, f"{lang} options mutated: {content.get('options')}"
        assert "answer" not in content or content.get("answer") in canonical_options
        assert target[0].get("situation_title"), f"missing situation_title for {lang}"

    # no mongo _id leaks
    assert "_id" not in body


def test_language_endpoint_accepts_all_codes_and_rejects_bad(client):
    g = client.post(f"{BASE}/guests", json={}, timeout=30)
    gid = g.json()["id"]
    for code in EXPECTED_LANGS:
        r = client.put(f"{BASE}/guests/{gid}/language", json={"interface_language": code}, timeout=30)
        assert r.status_code == 200, f"{code}: {r.status_code} {r.text}"
        assert r.json()["interface_language"] == code
    bad = client.put(f"{BASE}/guests/{gid}/language", json={"interface_language": "zz"}, timeout=30)
    assert bad.status_code == 422, f"expected 422 for zz, got {bad.status_code}"
