"""
Reference / taxonomy data for the product evolution towards
"training the real conversations a hospitality worker needs in English".

These collections are ADDITIVE and read-only for now. They do NOT touch existing
content (categories/situations/lessons/learning_items) or guest progress.
Seeding is idempotent: each collection is fully replaced on startup.

Collections seeded here:
- professional_profiles : job roles (bartender, waiter, ...)
- venue_types           : type of venue (cocktail bar, casual restaurant, ...)
- target_countries      : English-speaking target markets + english variant
- skills                : service-language / hospitality skills (job-readiness building blocks)
"""

PROFESSIONAL_PROFILES = [
    {
        "slug": "bartender",
        "name_en": "Bartender",
        "name_es": "Bartender",
        "description_es": "Prepara y sirve bebidas, recomienda y atiende en barra.",
        "icon": "wine",
        "order": 1,
        "related_categories": ["bar", "general"],
        "default_venue_types": ["cocktail-bar", "pub"],
    },
    {
        "slug": "waiter",
        "name_en": "Waiter / Server",
        "name_es": "Camarero/a de sala",
        "description_es": "Atiende mesas, toma comandas y acompaña la experiencia del cliente.",
        "icon": "utensils",
        "order": 2,
        "related_categories": ["restaurant", "general"],
        "default_venue_types": ["casual-restaurant", "fine-dining"],
    },
]

VENUE_TYPES = [
    {"slug": "pub", "name_en": "Pub", "name_es": "Pub", "order": 1},
    {"slug": "cafe", "name_en": "Café", "name_es": "Cafetería", "order": 2},
    {"slug": "casual-restaurant", "name_en": "Casual restaurant", "name_es": "Restaurante casual", "order": 3},
    {"slug": "fine-dining", "name_en": "Fine dining", "name_es": "Fine dining", "order": 4},
    {"slug": "cocktail-bar", "name_en": "Cocktail bar", "name_es": "Cocktail bar", "order": 5},
    {"slug": "hotel-restaurant", "name_en": "Hotel restaurant", "name_es": "Hotel 4-5 estrellas", "order": 6},
]

# Stable ids compatible with situation.country_variants; flag is visual support only.
TARGET_COUNTRIES = [
    {"id": "ireland", "name_es": "Irlanda", "flag": "🇮🇪", "english_variant": "british", "order": 1},
    {"id": "united_kingdom", "name_es": "Reino Unido", "flag": "🇬🇧", "english_variant": "british", "order": 2},
    {"id": "canada", "name_es": "Canadá", "flag": "🇨🇦", "english_variant": "canadian", "order": 3},
    {"id": "united_states", "name_es": "Estados Unidos", "flag": "🇺🇸", "english_variant": "american", "order": 4},
    {"id": "australia", "name_es": "Australia", "flag": "🇦🇺", "english_variant": "australian", "order": 5},
    {"id": "international", "name_es": "Internacional", "flag": "🌍", "english_variant": "international", "order": 6},
]

# Small taxonomy for onboarding goals (same pattern as roles/venues/countries).
LEARNING_GOALS = [
    {"id": "first_hospitality_job", "name_es": "Empezar mi primer trabajo en hostelería", "order": 1},
    {"id": "improve_guest_communication", "name_es": "Comunicarme mejor con los clientes", "order": 2},
    {"id": "work_abroad", "name_es": "Trabajar en otro país", "order": 3},
    {"id": "prepare_for_interview", "name_es": "Prepararme para una entrevista", "order": 4},
    {"id": "improve_current_job", "name_es": "Mejorar en mi trabajo actual", "order": 5},
]

SKILLS = [
    {"id": "greeting-guests", "name": "Greeting guests", "roles": ["bartender", "waiter"], "order": 1, "active": True,
     "translations": {"es": {"name": "Recibir a los clientes", "description": "Saluda y da la bienvenida con naturalidad y calidez."}}},
    {"id": "seating-guests", "name": "Seating guests", "roles": ["waiter"], "order": 2, "active": True,
     "translations": {"es": {"name": "Acomodar a los clientes", "description": "Acompaña y sienta a los clientes correctamente."}}},
    {"id": "taking-orders", "name": "Taking orders", "roles": ["bartender", "waiter"], "order": 3, "active": True,
     "translations": {"es": {"name": "Tomar pedidos", "description": "Anota comandas de comida y bebida con precisión."}}},
    {"id": "menu-knowledge", "name": "Menu knowledge", "roles": ["waiter"], "order": 4, "active": True,
     "translations": {"es": {"name": "Conocer la carta", "description": "Domina la carta para responder con seguridad."}}},
    {"id": "drink-knowledge", "name": "Drink knowledge", "roles": ["bartender"], "order": 5, "active": True,
     "translations": {"es": {"name": "Conocer las bebidas", "description": "Domina la carta de bebidas y sus características."}}},
    {"id": "cocktail-descriptions", "name": "Cocktail descriptions", "roles": ["bartender"], "order": 6, "active": True,
     "translations": {"es": {"name": "Describir cocktails", "description": "Explica cómo es un cocktail de forma clara y atractiva."}}},
    {"id": "food-descriptions", "name": "Food descriptions", "roles": ["waiter"], "order": 7, "active": True,
     "translations": {"es": {"name": "Describir platos", "description": "Describe los platos de forma breve y apetecible."}}},
    {"id": "recommendations", "name": "Recommendations", "roles": ["bartender", "waiter"], "order": 8, "active": True,
     "translations": {"es": {"name": "Recomendaciones", "description": "Descubre qué busca el cliente y sugiere una opción con confianza."}}},
    {"id": "upselling", "name": "Upselling", "roles": ["bartender", "waiter"], "order": 9, "active": True,
     "translations": {"es": {"name": "Sugerir extras", "description": "Propón extras y mejoras de forma natural, sin presionar."}}},
    {"id": "allergies", "name": "Allergies", "roles": ["bartender", "waiter"], "order": 10, "active": True,
     "translations": {"es": {"name": "Alergias", "description": "Gestiona alergias e intolerancias de forma segura y profesional."}}},
    {"id": "complaints", "name": "Complaints", "roles": ["bartender", "waiter"], "order": 11, "active": True,
     "translations": {"es": {"name": "Quejas", "description": "Responde a las quejas con calma y profesionalidad."}}},
    {"id": "service-recovery", "name": "Service recovery", "roles": ["bartender", "waiter"], "order": 12, "active": True,
     "translations": {"es": {"name": "Recuperar el servicio", "description": "Resuelve incidencias y recupera la confianza del cliente."}}},
    {"id": "payments", "name": "Payments", "roles": ["bartender", "waiter"], "order": 13, "active": True,
     "translations": {"es": {"name": "Cobros y cuenta", "description": "Gestiona la cuenta, la propina y el pago."}}},
    {"id": "difficult-guests", "name": "Difficult guests", "roles": ["bartender"], "order": 14, "active": True,
     "translations": {"es": {"name": "Clientes difíciles", "description": "Maneja situaciones tensas con clientes exigentes."}}},
]


async def seed_reference(db):
    """Idempotently (re)load taxonomy collections. Never touches guest or content data."""
    await db.professional_profiles.delete_many({})
    await db.venue_types.delete_many({})
    await db.target_countries.delete_many({})
    await db.skills.delete_many({})
    await db.learning_goals.delete_many({})

    await db.professional_profiles.insert_many([dict(x) for x in PROFESSIONAL_PROFILES])
    await db.venue_types.insert_many([dict(x) for x in VENUE_TYPES])
    await db.target_countries.insert_many([dict(x) for x in TARGET_COUNTRIES])
    await db.skills.insert_many([dict(x) for x in SKILLS])
    await db.learning_goals.insert_many([dict(x) for x in LEARNING_GOALS])
