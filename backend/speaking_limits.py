"""Usage limits for the paid speaking pipeline (ElevenLabs STT + OpenAI evaluation).

Every speaking attempt costs real money, and free situations are reachable without
an account. These limits bound that cost:

* per-profile daily quota (free and premium, different sizes),
* a global daily cap across ALL free usage (hard ceiling on free spend, independent
  of IPs or how many guest profiles someone creates),
* a maximum upload size, checked before anything is sent to a paid API.

Usage is recorded in Mongo (``speaking_usage``) BEFORE the paid calls run, so failed
or garbage uploads still count. Mongo-backed, so it survives restarts and works with
several backend instances. All values are configurable through environment variables.
"""
import os
from datetime import datetime, timedelta, timezone


def _int_env(name, default):
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


FREE_DAILY_PER_PROFILE = _int_env("SPEAKING_FREE_DAILY_PER_PROFILE", 10)
PREMIUM_DAILY_PER_PROFILE = _int_env("SPEAKING_PREMIUM_DAILY_PER_PROFILE", 100)
FREE_DAILY_GLOBAL = _int_env("SPEAKING_FREE_DAILY_GLOBAL", 2000)
# The client records at most 30 s. 3 MB covers uncompressed WAV fallbacks too.
MAX_AUDIO_BYTES = _int_env("SPEAKING_MAX_AUDIO_BYTES", 3 * 1024 * 1024)

WINDOW = timedelta(hours=24)
COLLECTION = "speaking_usage"
LIMIT_DETAIL = "speaking_daily_limit"


async def ensure_indexes(db):
    col = db[COLLECTION]
    await col.create_index([("guest_id", 1), ("at", -1)])
    await col.create_index([("premium", 1), ("at", -1)])
    # Rows are only needed for the rolling window: let Mongo drop them after 2 days.
    await col.create_index("at", expireAfterSeconds=2 * 24 * 3600)


async def check_and_record(db, guest_id, is_premium, now=None):
    """Returns None when the attempt may proceed (and records it), or the limit
    name that was hit ("profile" | "global")."""
    now = now or datetime.now(timezone.utc)
    since = now - WINDOW
    col = db[COLLECTION]

    per_profile = PREMIUM_DAILY_PER_PROFILE if is_premium else FREE_DAILY_PER_PROFILE
    if per_profile >= 0:
        used = await col.count_documents({"guest_id": guest_id, "at": {"$gte": since}})
        if used >= per_profile:
            return "profile"

    if not is_premium and FREE_DAILY_GLOBAL >= 0:
        used_global = await col.count_documents({"premium": False, "at": {"$gte": since}})
        if used_global >= FREE_DAILY_GLOBAL:
            return "global"

    await col.insert_one({"guest_id": guest_id, "premium": bool(is_premium), "at": now})
    return None


async def read_limited(upload, max_bytes=None):
    """Reads at most max_bytes + 1 so an oversized upload is never fully buffered.
    Returns (bytes, too_large)."""
    max_bytes = MAX_AUDIO_BYTES if max_bytes is None else max_bytes
    data = await upload.read(max_bytes + 1)
    return data, len(data) > max_bytes
