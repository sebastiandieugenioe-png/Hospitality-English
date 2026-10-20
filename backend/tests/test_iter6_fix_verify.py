"""Iteration 6 fix verification: localized MC options invariant (FIX #1),
Practice answer never-500, grading alignment, i18n structure, e2e attempt flow."""
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
BASE_URL = base_url.rstrip("/")

LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def make_guest(client, lang="es"):
    r = client.post(f"{BASE_URL}/api/guests", json={"interface_language": lang})
    assert r.status_code in (200, 201), r.text
    gid = r.json()["id"]
    p = client.put(f"{BASE_URL}/api/guests/{gid}/profile", json={
        "role": "bartender", "venue_type": "pub", "target_country": "ireland",
        "goal": "first_hospitality_job"})
    assert p.status_code == 200, p.text
    return gid


# ---------- i18n structural ----------
def test_languages_list(client):
    r = client.get(f"{BASE_URL}/api/languages")
    assert r.status_code == 200
    codes = [x["code"] if isinstance(x, dict) else x for x in r.json()]
    assert codes == LANGS, codes


def test_catalog_counts(client):
    sits = client.get(f"{BASE_URL}/api/situations").json()
    active = [s for s in sits if s.get("active")]
    assert len(active) == 20, len(active)
    bar = [s for s in active if "bartender" in (s.get("roles") or [])]
    wai = [s for s in active if "waiter" in (s.get("roles") or [])]
    assert len(bar) == 10 and len(wai) == 10, (len(bar), len(wai))
    cats = client.get(f"{BASE_URL}/api/categories").json()
    assert len(cats) == 7, len(cats)


# ---------- FIX #1: q_bar_greet_4 shows 4 options in every language ----------
def test_bar_greet_options_alignment(client):
    r = client.get(f"{BASE_URL}/api/lessons/guest-arrives-at-the-bar", headers=premium_headers())
    assert r.status_code == 200, r.text
    lesson = r.json()["lesson"]
    by_id = {q["id"]: q for q in (lesson.get("quiz") or []) + (lesson.get("exercises") or [])}
    q4 = by_id["q_bar_greet_4"]
    assert len(q4["options"]) == 4
    assert q4["answer_index"] == 1
    for lang in LANGS:
        opts = ((q4.get("translations") or {}).get(lang) or {}).get("options") or q4["options"]
        assert len(opts) == 4, f"{lang}: {opts}"
    q1 = by_id["q_bar_greet_1"]
    assert q1["answer_index"] == 0
    for lang in LANGS:
        opts = ((q1.get("translations") or {}).get(lang) or {}).get("options") or q1["options"]
        assert len(opts) == len(q1["options"]), f"{lang}: {opts}"


# ---------- FIX #1 invariant across ALL situations / questions / langs ----------
def test_all_mc_localized_options_length_invariant(client):
    sits = client.get(f"{BASE_URL}/api/situations").json()
    bad = []
    checked = 0
    for s in sits:
        r = client.get(f"{BASE_URL}/api/lessons/{s['slug']}", headers=premium_headers())
        assert r.status_code == 200, (s["slug"], r.status_code)
        body = r.json()
        if not body.get("available"):
            continue
        lesson = body["lesson"]
        for q in (lesson.get("exercises") or []) + (lesson.get("quiz") or []):
            if q.get("type") != "multiple_choice":
                continue
            canonical = q.get("options") or []
            ai = q.get("answer_index")
            if ai is None or not (0 <= ai < len(canonical)):
                bad.append((s["slug"], q["id"], "canonical answer_index out of range", ai, len(canonical)))
            for lang in LANGS:
                tr = (q.get("translations") or {}).get(lang) or {}
                loc = tr.get("options") or q.get(f"options_{lang}")
                if loc is not None and len(loc) != len(canonical):
                    bad.append((s["slug"], q["id"], lang, len(loc), len(canonical)))
                checked += 1
    assert checked > 0
    assert not bad, bad[:20]


# ---------- e2e attempt + practice, all langs for practice answer ----------
@pytest.mark.parametrize("lang", ["es", "uk", "fr", "en"])
def test_full_lesson_wrong_answers_then_practice(client, lang):
    guest = make_guest(client, lang)
    slug = "guest-arrives-at-the-bar"
    lesson = client.get(f"{BASE_URL}/api/lessons/{slug}", headers=premium_headers()).json()["lesson"]
    a = client.post(f"{BASE_URL}/api/situation-attempts/start", headers=premium_headers(),
                    json={"guest_id": guest, "situation_slug": slug})
    assert a.status_code == 200, a.text
    attempt_id = a.json()["attempt_id"]

    questions = [("exercise", q) for q in lesson.get("exercises") or []] + \
                [("quiz", q) for q in lesson.get("quiz") or []]
    assert questions

    wrong_count = 0
    for section, q in questions:
        if q["type"] == "multiple_choice":
            ai = q["answer_index"]
            submitted = 1 if ai == 0 else 0
        else:
            submitted = "definitely wrong answer"
        r = client.put(f"{BASE_URL}/api/situation-attempts/{attempt_id}/response", json={
            "question_id": q["id"], "section": section, "submitted_answer": submitted})
        assert r.status_code == 200, (q["id"], r.status_code, r.text[:300])
        assert r.json()["correct"] is False, (q["id"], r.json())
        wrong_count += 1

    c = client.post(f"{BASE_URL}/api/situation-attempts/{attempt_id}/complete")
    assert c.status_code == 200, c.text
    att = c.json()
    assert att["status"] == "completed"
    assert att["correct_questions"] == 0
    assert att["scores"]["overall"] == 0

    items = client.get(f"{BASE_URL}/api/guests/{guest}/review-items", headers=premium_headers()).json()
    assert len(items) == wrong_count, (len(items), wrong_count)
    for it in items:
        assert it["times_wrong"] == 1, it
        assert "answer" not in it["content"] and "answer_index" not in it["content"], it["content"]

    # answer every due item (never 500) and rate it
    due = client.get(f"{BASE_URL}/api/guests/{guest}/review-items", headers=premium_headers(), params={"due": "true"}).json()
    assert len(due) == wrong_count
    ratings = ["again", "hard", "good", "easy"]
    for i, it in enumerate(due):
        content = it["content"]
        if content["type"] == "multiple_choice":
            submitted = 0
        elif content["type"] == "word_ordering":
            submitted = content.get("words", [])
        else:
            submitted = "x"
        ans = client.post(f"{BASE_URL}/api/review-items/{it['id']}/answer", headers=premium_headers(),
                          json={"submitted_answer": submitted})
        assert ans.status_code == 200, (it["source_id"], ans.status_code, ans.text[:400])
        j = ans.json()
        assert "correct" in j
        assert j["correct_answer"] is not None, (it["source_id"], j)
        rr = client.post(f"{BASE_URL}/api/review-items/{it['id']}/rate", headers=premium_headers(),
                         json={"rating": ratings[i % 4]})
        assert rr.status_code == 200, (it["id"], rr.status_code, rr.text[:300])


# ---------- grading alignment: correct index grades correct, others wrong ----------
def test_grading_no_false_positive(client):
    guest = make_guest(client, "es")
    slug = "guest-arrives-at-the-bar"
    lesson = client.get(f"{BASE_URL}/api/lessons/{slug}", headers=premium_headers()).json()["lesson"]
    by_id = {q["id"]: ("quiz", q) for q in lesson.get("quiz") or []}
    by_id.update({q["id"]: ("exercise", q) for q in lesson.get("exercises") or []})
    attempt_id = client.post(f"{BASE_URL}/api/situation-attempts/start", headers=premium_headers(),
                             json={"guest_id": guest, "situation_slug": slug}).json()["attempt_id"]
    for qid in ("q_bar_greet_1", "q_bar_greet_4"):
        section, q = by_id[qid]
        ai = q["answer_index"]
        r = client.put(f"{BASE_URL}/api/situation-attempts/{attempt_id}/response", json={
            "question_id": qid, "section": section, "submitted_answer": ai})
        assert r.status_code == 200 and r.json()["correct"] is True, (qid, r.text[:300])
        other = (ai + 1) % len(q["options"])
        r2 = client.put(f"{BASE_URL}/api/situation-attempts/{attempt_id}/response", json={
            "question_id": qid, "section": section, "submitted_answer": other})
        assert r2.status_code == 200 and r2.json()["correct"] is False, (qid, r2.text[:300])


# ---------- language switch keeps guest data ----------
def test_language_switch_preserves_data(client):
    guest = make_guest(client, "es")
    slug = "guest-arrives-at-the-bar"
    attempt_id = client.post(f"{BASE_URL}/api/situation-attempts/start", headers=premium_headers(),
                             json={"guest_id": guest, "situation_slug": slug}).json()["attempt_id"]
    lesson = client.get(f"{BASE_URL}/api/lessons/{slug}", headers=premium_headers()).json()["lesson"]
    q = (lesson.get("quiz") or [])[0]
    client.put(f"{BASE_URL}/api/situation-attempts/{attempt_id}/response", json={
        "question_id": q["id"], "section": "quiz",
        "submitted_answer": (q["answer_index"] + 1) % len(q["options"])})
    before_items = client.get(f"{BASE_URL}/api/guests/{guest}/review-items", headers=premium_headers()).json()
    r = client.put(f"{BASE_URL}/api/guests/{guest}/language", json={"interface_language": "uk"})
    assert r.status_code == 200, r.text
    g = client.get(f"{BASE_URL}/api/guests/{guest}").json()
    assert g["id"] == guest
    assert g["interface_language"] == "uk"
    assert g["professional_profile"]["role"] == "bartender"
    after_items = client.get(f"{BASE_URL}/api/guests/{guest}/review-items", headers=premium_headers()).json()
    assert len(after_items) == len(before_items) == 1
    attempts = client.get(f"{BASE_URL}/api/guests/{guest}/attempts").json()
    assert len(attempts) == 1
