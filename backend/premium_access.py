"""Server-side RevenueCat entitlement verification (generic, profession-agnostic).

App User ID = central users.id. Fail closed: any error/unknown => not entitled.
Short in-process cache only; never a persistent source of truth.
"""
import logging
import os
import time
from datetime import datetime, timezone
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

RC_API_BASE = "https://api.revenuecat.com/v1"
POSITIVE_TTL_SECONDS = 60
NEGATIVE_TTL_SECONDS = 15

_cache = {}  # user_id -> (expires_monotonic, frozenset(active_entitlement_ids))
_warned_missing_key = False


def _secret():
    return (os.environ.get("REVENUECAT_SECRET_API_KEY") or "").strip()


def _is_active(ent):
    if not isinstance(ent, dict):
        return False
    expires = ent.get("expires_date")
    if expires is None:
        return True  # lifetime / non-expiring
    try:
        dt = datetime.fromisoformat(str(expires).replace("Z", "+00:00"))
    except ValueError:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt > datetime.now(timezone.utc)


async def _fetch_active_entitlements(user_id):
    """Returns a set of active entitlement ids, or None when verification failed."""
    global _warned_missing_key
    key = _secret()
    if not key:
        if not _warned_missing_key:
            logger.warning("REVENUECAT_SECRET_API_KEY not configured: premium verification disabled (fail closed)")
            _warned_missing_key = True
        return None
    url = f"{RC_API_BASE}/subscribers/{quote(str(user_id), safe='')}"
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(4.0, connect=2.0)) as client:
            r = await client.get(url, headers={"Authorization": f"Bearer {key}", "Accept": "application/json"})
        if r.status_code not in (200, 201):
            logger.warning("RevenueCat verification failed: HTTP %s", r.status_code)
            return None
        ents = (r.json().get("subscriber") or {}).get("entitlements") or {}
        return {eid for eid, ent in ents.items() if _is_active(ent)}
    except Exception as e:  # network / JSON errors — never log the key
        logger.warning("RevenueCat verification error: %s", type(e).__name__)
        return None


async def get_user_entitlements(user_id):
    """Active entitlement ids for a verified central users.id (empty on failure)."""
    if not user_id:
        return frozenset()
    now = time.monotonic()
    hit = _cache.get(user_id)
    if hit and hit[0] > now:
        return hit[1]
    active = await _fetch_active_entitlements(user_id)
    if active is None:
        return frozenset()  # unknown: not cached as positive, retried next request
    result = frozenset(active)
    ttl = POSITIVE_TTL_SECONDS if result else NEGATIVE_TTL_SECONDS
    _cache[user_id] = (now + ttl, result)
    return result


async def has_entitlement(user_id, entitlement_id):
    return entitlement_id in await get_user_entitlements(user_id)


def invalidate(user_id):
    _cache.pop(user_id, None)
