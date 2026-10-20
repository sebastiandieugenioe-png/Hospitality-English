"""Quantify i18n coverage of MC options per language (report-only diagnostic)."""
import os, collections, requests
from dotenv import dotenv_values
import os as _os, sys as _sys
_sys.path.insert(0, _os.path.dirname(__file__))
from premium_helpers import premium_headers, link_premium  # noqa: E402

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or dotenv_values("/app/frontend/.env")["REACT_APP_BACKEND_URL"]).rstrip("/")
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]

sits = requests.get(f"{BASE}/api/situations").json()
stats = collections.defaultdict(lambda: [0, 0, 0])  # lang -> [total_opts, translated_opts, questions_with_mixed]
for s in sits:
    body = requests.get(f"{BASE}/api/lessons/{s['slug']}", headers=premium_headers()).json()
    if not body.get("available"):
        continue
    lesson = body["lesson"]
    for q in (lesson.get("exercises") or []) + (lesson.get("quiz") or []):
        if q.get("type") != "multiple_choice":
            continue
        canonical = q.get("options") or []
        for lang in LANGS:
            if lang == "es":
                continue
            loc = ((q.get("translations") or {}).get(lang) or {}).get("options") or canonical
            same = [i for i, (a, b) in enumerate(zip(loc, canonical)) if a == b]
            st = stats[lang]
            st[0] += len(canonical)
            st[1] += len(canonical) - len(same)
            if same and len(same) != len(canonical):
                st[2] += 1

print(f"{'lang':6}{'options':>9}{'translated':>12}{'mixed-language questions':>26}")
for lang in LANGS:
    if lang == "es":
        continue
    t, tr, mixed = stats[lang]
    print(f"{lang:6}{t:>9}{tr:>12}{mixed:>26}")
