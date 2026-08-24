"""T1 helper: (A) guest with a single word_ordering mistake, (B) guest with profile and no mistakes."""
import os, json, requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"
SLUG = "guest-asks-for-cocktail-recommendation"
PROFILE = {"role": "bartender", "venue_type": "cocktail-bar",
           "target_country": "united_kingdom", "goal": "first_hospitality_job"}


def new_guest():
    gid = requests.post(f"{API}/guests", json={}).json()["id"]
    requests.put(f"{API}/guests/{gid}/profile", json=PROFILE).raise_for_status()
    return gid


a = new_guest()
aid = requests.post(f"{API}/situation-attempts/start", json={"guest_id": a, "situation_slug": SLUG}).json()["attempt_id"]
lesson = requests.get(f"{API}/lessons/{SLUG}").json()["lesson"]
wo = [(s, q) for s, k in (("exercise", "exercises"), ("quiz", "quiz")) for q in lesson[k] if q["type"] == "word_ordering"][:1]
for section, q in wo:
    requests.put(f"{API}/situation-attempts/{aid}/response",
                 json={"question_id": q["id"], "section": section, "submitted_answer": "totally wrong"})
b = new_guest()
print(json.dumps({
    "guest_word_ordering": a,
    "wo_answer": wo[0][1]["answer"],
    "guest_empty": b,
    "summary_a": requests.get(f"{API}/guests/{a}/review-summary").json(),
}))
