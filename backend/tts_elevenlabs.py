"""
Isolated ElevenLabs TTS adapter.

The ONLY place that talks to ElevenLabs. Used exclusively by the one-time batch
generation script (generate_listening_audio.py) — never on normal playback.
It synthesizes transcript_en verbatim; it never rewrites or paraphrases input.
"""
import os
from elevenlabs import ElevenLabs, VoiceSettings

MODEL_ID = "eleven_multilingual_v2"
OUTPUT_FORMAT = "mp3_44100_128"

# Clear, stable delivery for short hospitality lines (same family as the voice test).
VOICE_SETTINGS = VoiceSettings(
    stability=0.5,
    similarity_boost=0.75,
    style=0.0,
    use_speaker_boost=True,
)

_client = None


def _get_client():
    global _client
    if _client is None:
        api_key = os.environ["ELEVENLABS_API_KEY"]
        _client = ElevenLabs(api_key=api_key)
    return _client


def voice_id_for_profile(voice_profiles, profile_name):
    """Resolve the ElevenLabs voice id from the profile's env var."""
    env_key = voice_profiles[profile_name]["voice_id_env"]
    return os.environ[env_key]


def synthesize(text, voice_id):
    """Return MP3 bytes for the given text (verbatim) in the given voice."""
    client = _get_client()
    stream = client.text_to_speech.convert(
        text=text,
        voice_id=voice_id,
        model_id=MODEL_ID,
        output_format=OUTPUT_FORMAT,
        voice_settings=VOICE_SETTINGS,
    )
    audio = b""
    for chunk in stream:
        if chunk:
            audio += chunk
    return audio
