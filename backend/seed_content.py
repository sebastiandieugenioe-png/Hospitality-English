"""
Sample content for "Inglés para Hostelería" (Phase 1).

Data is structured to be localization-ready:
- Learning items carry a stable, locale-independent id and store `english_content`.
- Translations are kept in a structured `translations` map keyed by locale (only "es" for V1).
- User progress references the learning item id, never the translated text.
This mirrors the future LearningItem / Translations split without duplicating items per language.
"""

CATEGORIES = [
    {
        "slug": "general",
        "name_en": "General Hospitality",
        "name_es": "Hostelería general",
        "description_es": "Frases esenciales que sirven en cualquier trabajo de hostelería.",
        "icon": "sparkles",
        "order": 1,
    },
    {
        "slug": "restaurant",
        "name_en": "Restaurant",
        "name_es": "Restaurante",
        "description_es": "Atiende mesas, toma comandas y explica el menú con seguridad.",
        "icon": "utensils",
        "order": 2,
    },
    {
        "slug": "bar",
        "name_en": "Bar",
        "name_es": "Bar",
        "description_es": "Toma pedidos de bebidas, recomienda y sirve como un profesional.",
        "icon": "wine",
        "order": 3,
    },
    {
        "slug": "hotel",
        "name_en": "Hotel / Reception",
        "name_es": "Hotel / Recepción",
        "description_es": "Recibe huéspedes, gestiona el check-in y resuelve dudas.",
        "icon": "bed-double",
        "order": 4,
    },
    {
        "slug": "coffee",
        "name_en": "Coffee Shop",
        "name_es": "Cafetería",
        "description_es": "Prepara pedidos de café y atiende con rapidez y amabilidad.",
        "icon": "coffee",
        "order": 5,
    },
    {
        "slug": "kitchen",
        "name_en": "Kitchen",
        "name_es": "Cocina",
        "description_es": "Comunícate con claridad durante el servicio en cocina.",
        "icon": "chef-hat",
        "order": 6,
    },
    {
        "slug": "housekeeping",
        "name_en": "Housekeeping",
        "name_es": "Housekeeping",
        "description_es": "Prepara habitaciones y atiende peticiones de los huéspedes.",
        "icon": "brush",
        "order": 7,
    },
]

# situation slug -> True means it has a complete, functional lesson.
SITUATIONS = [
    # general
    {"slug": "greetings-and-small-talk", "category": "general", "title_en": "Greetings & small talk", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "polite-requests", "category": "general", "title_en": "Polite requests", "difficulty": "beginner", "order": 2, "is_full": False},
    # restaurant
    {"slug": "welcoming-guests", "category": "restaurant", "title_en": "Welcoming guests", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "taking-an-order", "category": "restaurant", "title_en": "Taking an order", "difficulty": "beginner", "order": 2, "is_full": True},
    {"slug": "explaining-the-menu", "category": "restaurant", "title_en": "Explaining the menu", "difficulty": "intermediate", "order": 3, "is_full": False},
    {"slug": "allergies-and-dietary-requirements", "category": "restaurant", "title_en": "Allergies & dietary requirements", "difficulty": "intermediate", "order": 4, "is_full": False},
    {"slug": "checking-on-the-table", "category": "restaurant", "title_en": "Checking on the table", "difficulty": "beginner", "order": 5, "is_full": False},
    {"slug": "bringing-the-bill", "category": "restaurant", "title_en": "Bringing the bill", "difficulty": "beginner", "order": 6, "is_full": False},
    # bar
    {"slug": "taking-a-drinks-order", "category": "bar", "title_en": "Taking a drinks order", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "recommending-drinks", "category": "bar", "title_en": "Recommending drinks", "difficulty": "intermediate", "order": 2, "is_full": False},
    {"slug": "explaining-cocktails", "category": "bar", "title_en": "Explaining cocktails", "difficulty": "intermediate", "order": 3, "is_full": False},
    {"slug": "serving-beer", "category": "bar", "title_en": "Serving beer", "difficulty": "beginner", "order": 4, "is_full": False},
    {"slug": "handling-a-complaint-bar", "category": "bar", "title_en": "Handling a complaint", "difficulty": "advanced", "order": 5, "is_full": False},
    # hotel
    {"slug": "welcoming-a-guest", "category": "hotel", "title_en": "Welcoming a guest", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "checking-in", "category": "hotel", "title_en": "Checking in", "difficulty": "beginner", "order": 2, "is_full": False},
    {"slug": "explaining-hotel-facilities", "category": "hotel", "title_en": "Explaining hotel facilities", "difficulty": "intermediate", "order": 3, "is_full": False},
    {"slug": "giving-directions", "category": "hotel", "title_en": "Giving directions", "difficulty": "intermediate", "order": 4, "is_full": False},
    {"slug": "handling-a-complaint-hotel", "category": "hotel", "title_en": "Handling a complaint", "difficulty": "advanced", "order": 5, "is_full": False},
    # coffee
    {"slug": "making-coffee-orders", "category": "coffee", "title_en": "Making coffee orders", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "recommending-pastries", "category": "coffee", "title_en": "Recommending pastries", "difficulty": "beginner", "order": 2, "is_full": False},
    # kitchen
    {"slug": "communicating-with-the-kitchen", "category": "kitchen", "title_en": "Communicating with the kitchen", "difficulty": "intermediate", "order": 1, "is_full": False},
    {"slug": "kitchen-safety-basics", "category": "kitchen", "title_en": "Kitchen safety basics", "difficulty": "beginner", "order": 2, "is_full": False},
    # housekeeping
    {"slug": "cleaning-a-room", "category": "housekeeping", "title_en": "Cleaning a room", "difficulty": "beginner", "order": 1, "is_full": False},
    {"slug": "guest-requests", "category": "housekeeping", "title_en": "Guest requests", "difficulty": "beginner", "order": 2, "is_full": False},
]

# Learning items for the fully functional lesson (Restaurant -> Taking an order).
# Each item has a stable id, independent of any translation.
PHRASES_TAKING_AN_ORDER = [
    {
        "id": "li_take_order_ready",
        "english_content": "Are you ready to order?",
        "translations": {"es": "¿Están listos para pedir?"},
    },
    {
        "id": "li_take_order_what_like",
        "english_content": "What would you like to have?",
        "translations": {"es": "¿Qué les gustaría tomar?"},
    },
    {
        "id": "li_take_order_steak_cooked",
        "english_content": "How would you like your steak cooked?",
        "translations": {"es": "¿Cómo quiere el punto de la carne?"},
    },
    {
        "id": "li_take_order_anything_else",
        "english_content": "Would you like anything else?",
        "translations": {"es": "¿Desean algo más?"},
    },
    {
        "id": "li_take_order_put_through",
        "english_content": "I'll put your order through now.",
        "translations": {"es": "Voy a enviar su comanda ahora."},
    },
]

DIALOGUE_TAKING_AN_ORDER = [
    {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Excuse me, we're ready to order.", "spanish": "Disculpe, estamos listos para pedir."},
    {"speaker": "waiter", "speaker_label_es": "Camarero", "english": "Of course. What would you like to have?", "spanish": "Por supuesto. ¿Qué les gustaría tomar?"},
    {"speaker": "customer", "speaker_label_es": "Cliente", "english": "I'll have the steak, please.", "spanish": "Yo tomaré el filete, por favor."},
    {"speaker": "waiter", "speaker_label_es": "Camarero", "english": "How would you like it cooked?", "spanish": "¿Cómo lo quiere de punto?"},
    {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Medium, please.", "spanish": "Al punto, por favor."},
    {"speaker": "waiter", "speaker_label_es": "Camarero", "english": "Perfect. Would you like anything else?", "spanish": "Perfecto. ¿Desean algo más?"},
]

EXERCISES_TAKING_AN_ORDER = [
    {
        "id": "ex_mc_ready",
        "type": "multiple_choice",
        "prompt_es": "¿Cuál es la forma correcta de preguntar si están listos para pedir?",
        "options": [
            "Are you ready to order?",
            "Do you ready order?",
            "You want food now?",
            "Are ready food?",
        ],
        "answer_index": 0,
        "explanation_es": "\"Are you ready to order?\" es la fórmula estándar y educada para preguntar si el cliente quiere pedir.",
    },
    {
        "id": "ex_gap_anything",
        "type": "fill_gap",
        "prompt_es": "Completa la frase para preguntar si desean algo más:",
        "sentence": "Would you like ______ else?",
        "answer": "anything",
        "explanation_es": "Usamos \"anything\" en preguntas: \"Would you like anything else?\".",
    },
    {
        "id": "ex_order_ready",
        "type": "word_ordering",
        "prompt_es": "Ordena las palabras para formar la pregunta correcta:",
        "words": ["ready", "you", "Are", "to", "order"],
        "answer": "Are you ready to order?",
        "explanation_es": "El orden correcto es: Are you ready to order?",
    },
]

QUIZ_TAKING_AN_ORDER = [
    {
        "id": "q_steak",
        "type": "multiple_choice",
        "prompt_es": "¿Cómo preguntas el punto de la carne en inglés?",
        "options": [
            "How would you like your steak cooked?",
            "How you want the meat?",
            "What cook the steak?",
            "Which steak you cook?",
        ],
        "answer_index": 0,
        "explanation_es": "\"How would you like your steak cooked?\" pregunta el punto de cocción de la carne.",
    },
    {
        "id": "q_gap_through",
        "type": "fill_gap",
        "prompt_es": "Completa: vas a enviar la comanda a cocina.",
        "sentence": "I'll put your order ______ now.",
        "answer": "through",
        "explanation_es": "\"Put an order through\" significa enviar/tramitar la comanda.",
    },
    {
        "id": "q_mc_reply",
        "type": "multiple_choice",
        "prompt_es": "Un cliente dice: \"We're ready to order\". ¿Qué respondes?",
        "options": [
            "Of course. What would you like to have?",
            "No, you can't.",
            "I don't know food.",
            "Order is finished.",
        ],
        "answer_index": 0,
        "explanation_es": "Respondes con amabilidad e invitas a pedir: \"Of course. What would you like to have?\".",
    },
    {
        "id": "q_order_anything",
        "type": "word_ordering",
        "prompt_es": "Ordena las palabras:",
        "words": ["else", "anything", "like", "Would", "you"],
        "answer": "Would you like anything else?",
        "explanation_es": "El orden correcto es: Would you like anything else?",
    },
    {
        "id": "q_mc_meaning",
        "type": "multiple_choice",
        "prompt_es": "¿Qué significa \"Would you like anything else?\"",
        "options": [
            "¿Desean algo más?",
            "¿Están listos para pedir?",
            "¿Cómo lo quiere?",
            "¿Dónde se sientan?",
        ],
        "answer_index": 0,
        "explanation_es": "Significa \"¿Desean algo más?\".",
    },
]

# Full lessons keyed by situation slug.
LESSONS = {
    "taking-an-order": {
        "situation_slug": "taking-an-order",
        "intro": {
            "summary_es": "Aprenderás las frases más comunes para tomar una comanda en un restaurante en inglés.",
            "objectives_es": [
                "Preguntar de forma educada si el cliente quiere pedir.",
                "Tomar la comanda y preguntar el punto de la carne.",
                "Ofrecer algo más y confirmar el pedido.",
            ],
        },
        "phrases": PHRASES_TAKING_AN_ORDER,
        "dialogue": DIALOGUE_TAKING_AN_ORDER,
        "exercises": EXERCISES_TAKING_AN_ORDER,
        "quiz": QUIZ_TAKING_AN_ORDER,
    }
}


async def seed(db):
    """Idempotently (re)load static content collections. Guest progress is never touched."""
    await db.categories.delete_many({})
    await db.situations.delete_many({})
    await db.learning_items.delete_many({})
    await db.lessons.delete_many({})

    await db.categories.insert_many([dict(c) for c in CATEGORIES])
    await db.situations.insert_many([dict(s) for s in SITUATIONS])

    # Persist learning items with their category/situation context.
    items = []
    for phrase in PHRASES_TAKING_AN_ORDER:
        items.append({
            "id": phrase["id"],
            "category_slug": "restaurant",
            "situation_slug": "taking-an-order",
            "type": "phrase",
            "difficulty": "beginner",
            "english_content": phrase["english_content"],
            "translations": phrase["translations"],
        })
    if items:
        await db.learning_items.insert_many(items)

    for slug, lesson in LESSONS.items():
        doc = dict(lesson)
        doc["situation_slug"] = slug
        await db.lessons.insert_one(doc)
