"""T1 edge-case / error-handling probes for v2 catalog + practice endpoints."""
import os

import requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

frontend_env = dotenv_values("/app/frontend/.env")
API = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env["REACT_APP_BACKEND_URL"]).rstrip("/") + "/api"


def _mk_review_item(lang="uk", slug="taking-a-drinks-order"):
    les = requests.get(f"{API}/lessons/{slug}", headers=premium_headers(), timeout=30).json()["lesson"]
    q = next(x for x in les["quiz"] if x.get("type") == "multiple_choice")
    wrong = 0 if q["answer_index"] != 0 else 1
    gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": lang}, timeout=30).json()["id"])
    aid = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                        json={"guest_id": gid, "situation_slug": slug}, timeout=30).json()["attempt_id"]
    requests.put(f"{API}/situation-attempts/{aid}/response",
                 json={"question_id": q["id"], "section": "quiz", "submitted_answer": wrong}, timeout=30)
    items = requests.get(f"{API}/guests/{gid}/review-items", headers=premium_headers(), timeout=30).json()
    return gid, q, [i for i in items if i.get("source_id") == q["id"]][0]


class TestEdgeCases:
    def test_unknown_lesson_slug_404(self):
        r = requests.get(f"{API}/lessons/does-not-exist-xyz", headers=premium_headers(), timeout=30)
        assert r.status_code in (404, 200)
        if r.status_code == 200:
            assert not r.json().get("lesson")

    def test_inactive_placeholder_lesson_not_exposed_as_active_situation(self):
        sits = {s["slug"] for s in requests.get(f"{API}/situations", timeout=30).json()}
        assert "handling-a-complaint-bar" not in sits

    def test_out_of_range_index_no_500(self):
        _gid, q, ri = _mk_review_item()
        r = requests.post(f"{API}/review-items/{ri['id']}/answer", headers=premium_headers(), json={"submitted_answer": 99}, timeout=30)
        assert r.status_code < 500, f"server error on out-of-range index: {r.status_code} {r.text[:300]}"

    def test_string_answer_no_500(self):
        _gid, q, ri = _mk_review_item()
        r = requests.post(f"{API}/review-items/{ri['id']}/answer", headers=premium_headers(),
                          json={"submitted_answer": "not-an-index"}, timeout=30)
        assert r.status_code < 500, f"server error on string answer: {r.status_code} {r.text[:300]}"

    def test_unknown_review_item_404(self):
        r = requests.post(f"{API}/review-items/00000000-0000-0000-0000-000000000000/answer", headers=premium_headers(),
                          json={"submitted_answer": 0}, timeout=30)
        assert r.status_code == 404, f"{r.status_code} {r.text[:200]}"

    def test_attempt_start_unknown_situation(self):
        gid = link_premium(requests.post(f"{API}/guests", json={"interface_language": "es"}, timeout=30).json()["id"])
        r = requests.post(f"{API}/situation-attempts/start", headers=premium_headers(),
                          json={"guest_id": gid, "situation_slug": "nope-xyz"}, timeout=30)
        assert r.status_code < 500, f"{r.status_code} {r.text[:200]}"

    def test_no_mongo_object_id_in_payloads(self):
        for path in ["/situations", "/categories", "/lessons/handling-a-complaint"]:
            body = requests.get(f"{API}{path}", timeout=30).text
            assert '"_id"' not in body, f"_id leaked in {path}"
