"""Generate the 10 frontend UI locale files from the verified i18n bundle.

Source of truth: data/mvp_i18n_import_bundle_verified_v1.json
Writes: frontend/src/locales/{lang}.json for all supported languages.
UI keys come from ui_translations entries + the wired hardcoded_ui keys.
No new translations are invented; values are copied verbatim from the bundle.
"""
import json
from pathlib import Path

BACKEND = Path(__file__).parent.parent
BUNDLE = BACKEND / "data" / "mvp_i18n_import_bundle_verified_v1.json"
LOCALES_DIR = BACKEND.parent / "frontend" / "src" / "locales"

LANGS = ["es", "it", "fr", "pt", "de", "pl", "ro", "uk", "nl", "en"]


def main():
    d = json.load(open(BUNDLE, encoding="utf-8"))
    out = {lang: {} for lang in LANGS}

    for e in d["entries"]:
        for r in e["references"]:
            if r.get("source") == "ui_translations":
                for lang in LANGS:
                    out[lang][r["key"]] = e["translations"][lang]

    for h in d["hardcoded_ui"]:
        for occ in h["occurrences"]:
            key = occ["proposed_i18n_key"]
            for lang in LANGS:
                out[lang][key] = h["translations"][lang]

    for lang in LANGS:
        data = {k: out[lang][k] for k in sorted(out[lang])}
        (LOCALES_DIR / f"{lang}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"{lang}.json -> {len(data)} keys")


if __name__ == "__main__":
    main()
