"""T1 helper: create a guest with completed profile and several mistakes (all dimensions)."""
import os, json, requests
from dotenv import dotenv_values

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
API = f"{BASE}/api"
SLUG = "guest-asks-for-cocktail-recommendation"

gid = requests.post(f"{API}/guests", json={}).json()["id"]
p = requests.put(f"{API}/guests/{gid}/profile", json={
    "role": "bartender", "venue_type": "cocktail-bar",
    "target_country": "united_kingdom", "goal": "first_hospitality_job",
})
assert p.status_code == 200, p.text
aid = requests.post(f"{API}/situation-attempts/start", json={"guest_id": gid, "situation_slug": SLUG}).json()["attempt_id"]
lesson = requests.get(f"{API}/lessons/{SLUG}").json()["lesson"]


def wrong(q):
    if q["type"] == "multiple_choice":
        return (q["answer_index"] + 1) % len(q["options"])
    if q["type"] == "fill_gap":
        return "zzz"
    return "wrong order here"


for section, key in (("exercise", "exercises"), ("quiz", "quiz")):
    for q in lesson[key]:
        requests.put(f"{API}/situation-attempts/{aid}/response",
                     json={"question_id": q["id"], "section": section, "submitted_answer": wrong(q)})
requests.post(f"{API}/situation-attempts/{aid}/complete")
summary = requests.get(f"{API}/guests/{gid}/review-summary").json()
types = [i["content"]["type"] for i in requests.get(f"{API}/guests/{gid}/review-items").json()]
print(json.dumps({"guest_id": gid, "summary": summary, "types": types}))
