# Multilingual final QA: meta ui_translations (assessment/job-interview/listening/speaking) + frontend locale parity
import os, re, json, glob
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]
LOC_DIR = "/app/frontend/src/locales"


# Meta endpoints: every ui key translated for all 10 languages
@pytest.mark.parametrize("ep", ["assessment/meta", "job-interview/meta", "listening/meta", "speaking/meta"])
def test_meta_ui_complete(ep):
    r = requests.get(f"{BASE_URL}/api/{ep}", timeout=20)
    assert r.status_code == 200
    ui = r.json()["ui"]
    missing = [(k, l) for k, v in ui.items() if isinstance(v, dict) for l in LANGS if not str(v.get(l, "")).strip()]
    assert missing == []


# Spanish/German/Dutch copy fixes
def test_assessment_copy():
    ui = requests.get(f"{BASE_URL}/api/assessment/meta", timeout=20).json()["ui"]
    assert ui["start"]["es"] == "Empezar evaluación"
    assert ui["subtitle"]["es"].endswith("situaciones cotidianas de hostelería.")
    assert ui["retake"]["es"] == "Repetir evaluación"
    assert ui["start"]["de"] == "Test starten"
    assert ui["start"]["nl"] == "Start de test"


def test_job_interview_and_section_titles_es():
    ji = requests.get(f"{BASE_URL}/api/job-interview/meta", timeout=20).json()["ui"]
    assert "entrevistas de hostelería" in ji["subtitle"]["es"]
    assert requests.get(f"{BASE_URL}/api/listening/meta", timeout=20).json()["ui"]["section_title"]["es"] == "Comprensión oral"
    assert requests.get(f"{BASE_URL}/api/speaking/meta", timeout=20).json()["ui"]["section_title"]["es"] == "Expresión oral"


# Frontend locale parity: same keys, no empty values, same placeholders, all t('key') exist
def _locales():
    return {os.path.basename(f)[:-5]: json.load(open(f)) for f in glob.glob(f"{LOC_DIR}/*.json")}


def test_locale_parity():
    L = _locales()
    assert sorted(L) == sorted(LANGS)
    base = set(L["es"])
    for lg, d in L.items():
        assert set(d) == base, lg
        assert not [k for k, v in d.items() if not str(v).strip()], lg
        for k in base:
            assert set(re.findall(r"\{\w+\}", str(d[k]))) == set(re.findall(r"\{\w+\}", L["es"][k])), (lg, k)


def test_static_t_keys_exist():
    base = set(_locales()["es"])
    missing = []
    for f in glob.glob("/app/frontend/src/**/*.js", recursive=True):
        for m in re.finditer(r"""\bt\(\s*["']([a-zA-Z0-9_.\-]+)["']""", open(f).read()):
            if m.group(1) not in base:
                missing.append((m.group(1), f))
    assert missing == []
