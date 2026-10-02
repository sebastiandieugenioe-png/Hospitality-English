"""
One-time, idempotent pre-generation of the 50 Listening MP3s.

- Iterates the 50 items in data/listening.json.
- transcript_en is the ONLY text source, sent verbatim (no rewrite, no cloning,
  no music, no background noise).
- Writes one MP3 per item to frontend/public/listening/<slug>.mp3.
- Idempotent: an existing non-empty asset is skipped unless --force is passed.
- Normal playback NEVER calls this; the app only serves the generated files.

Usage:
    python generate_listening_audio.py            # generate missing assets
    python generate_listening_audio.py --force    # regenerate everything
    python generate_listening_audio.py --verify    # verify only, no API calls
"""
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).parent
load_dotenv(ROOT / ".env")

import listening_data as listening  # noqa: E402

FORCE = "--force" in sys.argv
VERIFY_ONLY = "--verify" in sys.argv


def _out_path(item):
    # audio_asset_key = "listening/<slug>.mp3"
    return ROOT.parent / "frontend" / "public" / item["audio_asset_key"]


def verify():
    ok = True
    for item in listening.ITEMS:
        p = _out_path(item)
        if not p.exists() or p.stat().st_size == 0:
            print(f"MISSING/EMPTY: {item['audio_asset_key']}")
            ok = False
    total = sum(1 for it in listening.ITEMS if _out_path(it).exists() and _out_path(it).stat().st_size > 0)
    print(f"Assets present: {total}/{len(listening.ITEMS)}")
    return ok


def main():
    listening.AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    if VERIFY_ONLY:
        sys.exit(0 if verify() else 1)

    import tts_elevenlabs as tts  # imported lazily so --verify needs no SDK/key

    generated, skipped, failed = 0, 0, 0
    for i, item in enumerate(listening.ITEMS, 1):
        out = _out_path(item)
        out.parent.mkdir(parents=True, exist_ok=True)
        if not FORCE and out.exists() and out.stat().st_size > 0:
            skipped += 1
            continue
        try:
            voice_id = tts.voice_id_for_profile(listening.VOICE_PROFILES, item["voice_profile"])
            audio = tts.synthesize(item["transcript_en"], voice_id)
            if not audio:
                raise RuntimeError("empty audio returned")
            out.write_bytes(audio)
            generated += 1
            print(f"[{i}/{len(listening.ITEMS)}] generated {item['audio_asset_key']} ({len(audio)} bytes)")
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(listening.ITEMS)}] FAILED {item['audio_asset_key']}: {e}")

    print(f"\nDone. generated={generated} skipped={skipped} failed={failed}")
    ok = verify() and failed == 0
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
