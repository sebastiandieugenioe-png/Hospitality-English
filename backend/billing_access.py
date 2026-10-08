"""Central, profession-aware freemium access config (owned by EnglishToWork).

HospitalityEnglish is one vertical. No domain-specific flags; no premium persisted
in Mongo. Entitlement truth lives in RevenueCat; the backend only knows which
situations are FREE so it can filter pools and gate locked content.
"""

PROFESSION_BILLING = {
    "hospitality": {
        "entitlement_id": "hospitality_premium",
        "offering_id": "hospitality_default",
        # Exactly 5 free situations per role (validated against the live catalog).
        "free_situations": {
            "bartender": [
                "guest-arrives-at-the-bar",
                "taking-a-drinks-order",
                "recommending-drinks",
                "guest-asks-about-cocktail-allergens",
                "handling-a-complaint",
            ],
            "waiter": [
                "welcoming-guests",
                "guest-is-not-ready-to-order",
                "allergies-and-dietary-requirements",
                "explaining-the-menu",
                "bringing-the-bill",
            ],
        },
    },
}


def _cfg(profession_id):
    return PROFESSION_BILLING.get(profession_id or "hospitality") or {}


def free_slugs(profession_id="hospitality", role=None):
    """Free situation slugs. If role is given, only that role's free set; else union."""
    fs = _cfg(profession_id).get("free_situations") or {}
    if role is not None:
        return set(fs.get(role) or [])
    out = set()
    for v in fs.values():
        out |= set(v)
    return out


def is_free_situation(slug, profession_id="hospitality", role=None):
    return slug in free_slugs(profession_id, role)


def can_access_situation(role, situation_slug, is_premium, profession_id="hospitality"):
    """Central access rule. Premium entitlement unlocks everything; otherwise only
    the role's free situations are accessible."""
    if is_premium:
        return True
    return situation_slug in free_slugs(profession_id, role)
