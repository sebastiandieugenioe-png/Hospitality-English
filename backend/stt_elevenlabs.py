"""
Isolated ElevenLabs Speech-to-Text adapter (batch, backend-only).

Transcribes a short user recording with Scribe v2. Raw audio is passed in-memory
by the caller and never persisted here. Returns transcript text plus confidence
signals (language_probability and average per-word logprob when available).
"""
import io
import os

from elevenlabs import ElevenLabs

MODEL_ID = "scribe_v2"
LANGUAGE_CODE = "eng"

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])
    return _client


def transcribe(audio_bytes, filename="audio.webm"):
    client = _get_client()
    buf = io.BytesIO(audio_bytes)
    buf.name = filename
    r = client.speech_to_text.convert(
        file=buf,
        model_id=MODEL_ID,
        language_code=LANGUAGE_CODE,
        diarize=False,
        tag_audio_events=False,
    )
    text = (getattr(r, "text", None) or "").strip()
    language_probability = getattr(r, "language_probability", None)
    words = getattr(r, "words", None) or []
    logps = [w.logprob for w in words if getattr(w, "logprob", None) is not None]
    avg_logprob = (sum(logps) / len(logps)) if logps else None
    return {
        "text": text,
        "language_probability": language_probability,
        "avg_logprob": avg_logprob,
    }
