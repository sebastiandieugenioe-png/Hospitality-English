"""
Pilot catalog for the Professional Profile -> Skills -> Situations -> Lessons model.

Six hand-authored, high-quality situations (3 bartender, 3 waiter) plus their full
lessons. Content is A2-B1, framed around a real shift, and introduces "Service English"
(speaking like a hospitality professional, not just correct English).

Kept fully backwards compatible: lessons follow the exact same structure the frontend
already renders (intro / phrases / dialogue / exercises / quiz). Phrases may optionally
carry Service English metadata (service_register, service_rating, service_note_es,
context_es, natural_alternatives, common_mistake_es).
"""

# service_register: casual | neutral | professional | luxury
# service_rating: inappropriate | too_direct | acceptable | professional | excellent

SITUATIONS = [
    # ---------------- BARTENDER ----------------
    {
        "slug": "guest-asks-for-cocktail-recommendation",
        "category": "bar",
        "title": "A guest asks for a cocktail recommendation",
        "title_en": "A guest asks for a cocktail recommendation",
        "translations": {"es": {
            "title": "Un cliente te pide una recomendación de cocktail",
            "description": "Descubre qué le gusta al cliente y recomienda un cocktail de forma natural.",
        }},
        "roles": ["bartender"],
        "primary_skill": "recommendations",
        "skills": ["recommendations", "drink-knowledge", "cocktail-descriptions"],
        "venue_types": ["cocktail-bar", "pub", "hotel-restaurant"],
        "level": "a2",
        "difficulty": 2,
        "estimated_minutes": 6,
        "service_registers": ["neutral", "professional"],
        "country_variants": [],
        "order": 1,
        "active": True,
        "is_full": True,
    },
    {
        "slug": "guest-wants-something-less-sweet",
        "category": "bar",
        "title": "A guest wants something less sweet",
        "title_en": "A guest wants something less sweet",
        "translations": {"es": {
            "title": "Un cliente quiere algo menos dulce",
            "description": "Recomienda una opción refrescante y seca describiendo bien el sabor.",
        }},
        "roles": ["bartender"],
        "primary_skill": "recommendations",
        "skills": ["recommendations", "cocktail-descriptions"],
        "venue_types": ["cocktail-bar", "pub"],
        "level": "b1",
        "difficulty": 2,
        "estimated_minutes": 5,
        "service_registers": ["neutral", "professional"],
        "country_variants": [],
        "order": 2,
        "active": True,
        "is_full": True,
    },
    {
        "slug": "guest-says-cocktail-is-too-sweet",
        "category": "bar",
        "title": "A guest says the cocktail is too sweet",
        "title_en": "A guest says the cocktail is too sweet",
        "translations": {"es": {
            "title": "Un cliente dice que el cocktail está demasiado dulce",
            "description": "Reconoce el problema, discúlpate y ofrece una solución sin culpar a nadie.",
        }},
        "roles": ["bartender"],
        "primary_skill": "complaints",
        "skills": ["complaints", "service-recovery", "cocktail-descriptions"],
        "venue_types": ["cocktail-bar", "pub", "hotel-restaurant"],
        "level": "b1",
        "difficulty": 3,
        "estimated_minutes": 6,
        "service_registers": ["professional", "luxury"],
        "country_variants": [],
        "order": 3,
        "active": True,
        "is_full": True,
    },
    # ---------------- WAITER ----------------
    {
        "slug": "guest-asks-for-food-recommendation",
        "category": "restaurant",
        "title": "A guest asks for a food recommendation",
        "title_en": "A guest asks for a food recommendation",
        "translations": {"es": {
            "title": "Un cliente te pregunta qué plato recomiendas",
            "description": "Pregunta preferencias, describe brevemente un plato y explica por qué lo recomiendas.",
        }},
        "roles": ["waiter"],
        "primary_skill": "recommendations",
        "skills": ["recommendations", "food-descriptions"],
        "venue_types": ["casual-restaurant", "fine-dining", "hotel-restaurant"],
        "level": "a2",
        "difficulty": 2,
        "estimated_minutes": 5,
        "service_registers": ["neutral", "professional"],
        "country_variants": [],
        "order": 4,
        "active": True,
        "is_full": True,
    },
    {
        "slug": "guest-mentions-a-nut-allergy",
        "category": "restaurant",
        "title": "A guest mentions a nut allergy",
        "title_en": "A guest mentions a nut allergy",
        "translations": {"es": {
            "title": "Un cliente menciona una alergia a los frutos secos",
            "description": "Responde de forma segura y profesional, confirmando siempre con la cocina.",
        }},
        "roles": ["waiter"],
        "primary_skill": "allergies",
        "skills": ["allergies"],
        "venue_types": ["casual-restaurant", "fine-dining", "hotel-restaurant", "pub", "cafe"],
        "level": "b1",
        "difficulty": 3,
        "estimated_minutes": 6,
        "service_registers": ["professional"],
        "country_variants": [],
        "order": 5,
        "active": True,
        "is_full": True,
    },
    {
        "slug": "food-is-taking-longer-than-expected",
        "category": "restaurant",
        "title": "The food is taking longer than expected",
        "title_en": "The food is taking longer than expected",
        "translations": {"es": {
            "title": "La comida está tardando más de lo esperado",
            "description": "Reconoce el retraso, gestiona la espera y confirma con la cocina sin inventar tiempos.",
        }},
        "roles": ["waiter"],
        "primary_skill": "service-recovery",
        "skills": ["service-recovery", "complaints"],
        "venue_types": ["casual-restaurant", "fine-dining", "hotel-restaurant", "pub"],
        "level": "b1",
        "difficulty": 3,
        "estimated_minutes": 5,
        "service_registers": ["professional"],
        "country_variants": [],
        "order": 6,
        "active": True,
        "is_full": True,
    },
]


def _p(pid, en, es, **service):
    """Build a phrase (learning item), attaching optional Service English metadata."""
    item = {"id": pid, "english_content": en, "translations": {"es": es}}
    item.update(service)
    return item


LESSONS = {
    # =====================================================================
    "guest-asks-for-cocktail-recommendation": {
        "intro": {
            "context_es": "Estás detrás de la barra. Un cliente mira la carta unos segundos y luego te dice:",
            "guest_opening_en": "I'm not sure what to get. What would you recommend?",
            "guest_opening_es": "No sé qué pedir. ¿Qué me recomiendas?",
            "summary_es": "Aprenderás a descubrir qué le gusta al cliente y recomendar un cocktail de forma natural y profesional.",
            "objectives_es": [
                "Preguntar por las preferencias del cliente.",
                "Identificar si quiere algo dulce, ácido, fuerte o refrescante.",
                "Recomendar y explicar brevemente tu elección.",
            ],
        },
        "phrases": [
            _p("li_rec_cocktail_1", "What kind of drinks do you usually like?", "¿Qué tipo de bebidas te suelen gustar?",
               service_register="professional", service_rating="professional",
               service_note_es="Empezar con una pregunta abierta te ayuda a recomendar mejor y suena atento.",
               common_mistake_es="Evita \"What you want?\": es incorrecto y suena brusco.",
               natural_alternatives=["What are you in the mood for?"]),
            _p("li_rec_cocktail_2", "Do you prefer something sweet, sour, or more refreshing?", "¿Prefieres algo dulce, ácido o más refrescante?"),
            _p("li_rec_cocktail_3", "Are you in the mood for something strong or light?", "¿Te apetece algo fuerte o suave?"),
            _p("li_rec_cocktail_4", "I'd recommend the Gin Sour.", "Te recomendaría el Gin Sour.",
               service_register="professional", service_rating="professional"),
            _p("li_rec_cocktail_5", "It's refreshing and not too sweet.", "Es refrescante y no demasiado dulce."),
            _p("li_rec_cocktail_6", "Would you like me to make it for you?", "¿Quieres que te lo prepare?"),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "I'm not sure what to get. What would you recommend?", "spanish": "No sé qué pedir. ¿Qué me recomiendas?"},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Of course. What kind of drinks do you usually like?", "spanish": "Claro. ¿Qué tipo de bebidas te suelen gustar?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "I like gin, but nothing too sweet.", "spanish": "Me gusta la ginebra, pero nada demasiado dulce."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Got it. Do you prefer something citrusy or more herbal?", "spanish": "Entendido. ¿Prefieres algo cítrico o más herbal?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Citrusy sounds good.", "spanish": "Cítrico suena bien."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Then I'd recommend a Gin Sour. It's fresh, citrus-forward and not too sweet.", "spanish": "Entonces te recomendaría un Gin Sour. Es fresco, cítrico y no demasiado dulce."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Sounds great, I'll have that.", "spanish": "Suena genial, tomaré ese."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Perfect, I'll make it for you now.", "spanish": "Perfecto, te lo preparo ahora."},
        ],
        "exercises": [
            {"id": "ex_rc_1", "type": "multiple_choice",
             "prompt_es": "El cliente dice: \"I don't really like sweet drinks.\" ¿Cuál sería la mejor respuesta?",
             "options": ["Then don't order a cocktail.", "What kind of flavours do you usually enjoy?", "All cocktails are sweet.", "I don't know."],
             "answer_index": 1,
             "explanation_es": "Preguntar por sus gustos es profesional y te ayuda a recomendar mejor. Las otras opciones suenan bruscas o poco útiles."},
            {"id": "ex_rc_2", "type": "fill_gap",
             "prompt_es": "Completa la pregunta para conocer sus preferencias:",
             "sentence": "Do you prefer something sweet, sour or more ______?",
             "answer": "refreshing",
             "explanation_es": "\"Refreshing\" (refrescante) es una categoría de sabor muy útil al recomendar bebidas."},
            {"id": "ex_rc_3", "type": "word_ordering",
             "prompt_es": "Ordena las palabras para recomendar una opción:",
             "words": ["recommend", "the", "I'd", "Gin Sour"],
             "answer": "I'd recommend the Gin Sour",
             "explanation_es": "\"I'd recommend the...\" es la fórmula natural para recomendar."},
        ],
        "quiz": [
            {"id": "q_rc_1", "type": "multiple_choice",
             "prompt_es": "El cliente dice \"I'm not sure what to get.\" ¿Qué está haciendo?",
             "options": ["Pidiendo una recomendación", "Quejándose", "Pidiendo la cuenta", "Marchándose"],
             "answer_index": 0, "explanation_es": "Está indeciso y busca que le orientes: es el momento de recomendar."},
            {"id": "q_rc_2", "type": "multiple_choice",
             "prompt_es": "¿Cuál es gramaticalmente correcta pero demasiado directa para un servicio profesional?",
             "options": ["What do you want?", "What can I get you?", "What would you like?", "How can I help you?"],
             "answer_index": 0, "explanation_es": "\"What do you want?\" es correcta pero suena brusca. Mejor \"What can I get you?\"."},
            {"id": "q_rc_3", "type": "fill_gap",
             "prompt_es": "Completa la descripción del sabor:",
             "sentence": "It's citrus-______ and not too sweet.",
             "answer": "forward", "explanation_es": "\"Citrus-forward\" significa con un sabor cítrico predominante."},
            {"id": "q_rc_4", "type": "multiple_choice",
             "prompt_es": "\"Citrusy\" significa:",
             "options": ["Con sabor cítrico", "Amargo", "Muy dulce", "Muy fuerte"],
             "answer_index": 0, "explanation_es": "\"Citrusy\" = con sabor a cítricos (limón, lima...)."},
            {"id": "q_rc_5", "type": "word_ordering",
             "prompt_es": "Ordena para ofrecer prepararlo:",
             "words": ["you", "like", "would", "What"],
             "answer": "What would you like",
             "explanation_es": "\"What would you like?\" es educado y profesional."},
        ],
    },
    # =====================================================================
    "guest-wants-something-less-sweet": {
        "intro": {
            "context_es": "El cliente quiere un cocktail, pero antes de pedir te aclara algo:",
            "guest_opening_en": "I'd like a cocktail, but nothing too sweet.",
            "guest_opening_es": "Quiero un cocktail, pero nada demasiado dulce.",
            "summary_es": "Aprenderás a recomendar una opción refrescante y seca, describiendo bien el sabor.",
            "objectives_es": [
                "Entender la preferencia \"not too sweet\".",
                "Describir un cocktail como seco, cítrico o refrescante.",
                "Ofrecer una alternativa más ligera si hace falta.",
            ],
        },
        "phrases": [
            _p("li_less_1", "I'm looking for something not too sweet.", "Busco algo no demasiado dulce."),
            _p("li_less_2", "I'd recommend something more citrus-forward.", "Te recomendaría algo más cítrico.",
               service_register="professional", service_rating="professional"),
            _p("li_less_3", "It's quite dry.", "Es bastante seco."),
            _p("li_less_4", "It's refreshing rather than sweet.", "Es refrescante en lugar de dulce."),
            _p("li_less_5", "If you'd prefer something lighter, we could do a spritz.", "Si prefieres algo más ligero, podemos hacer un spritz."),
            _p("li_less_6", "How does that sound?", "¿Qué te parece?"),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "I'd like a cocktail, but nothing too sweet.", "spanish": "Quiero un cocktail, pero nada demasiado dulce."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "No problem. Do you like citrus or herbal flavours?", "spanish": "Sin problema. ¿Te gustan los sabores cítricos o herbales?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Citrus, I think.", "spanish": "Cítricos, creo."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Then I'd suggest a Paloma. It's refreshing and quite dry.", "spanish": "Entonces te sugiero una Paloma. Es refrescante y bastante seca."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Is it strong?", "spanish": "¿Es fuerte?"},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "It's medium — refreshing rather than strong. How does that sound?", "spanish": "Es media: más refrescante que fuerte. ¿Qué te parece?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Perfect, I'll try it.", "spanish": "Perfecto, la probaré."},
        ],
        "exercises": [
            {"id": "ex_ls_1", "type": "multiple_choice",
             "prompt_es": "El cliente dice: \"I don't want anything too sweet.\" ¿Cuál es la mejor respuesta?",
             "options": ["It's more citrus-forward and quite dry.", "Everything here is sweet.", "Okay.", "That's not possible."],
             "answer_index": 0, "explanation_es": "Describir el sabor (cítrico y seco) responde directamente a su preferencia."},
            {"id": "ex_ls_2", "type": "fill_gap",
             "prompt_es": "Completa la descripción:",
             "sentence": "It's refreshing ______ than sweet.",
             "answer": "rather", "explanation_es": "\"Refreshing rather than sweet\" = refrescante en lugar de dulce."},
            {"id": "ex_ls_3", "type": "word_ordering",
             "prompt_es": "Ordena para describir la preferencia:",
             "words": ["something", "not", "too", "sweet"],
             "answer": "something not too sweet",
             "explanation_es": "\"Something not too sweet\" = algo no demasiado dulce."},
        ],
        "quiz": [
            {"id": "q_ls_1", "type": "multiple_choice",
             "prompt_es": "\"Citrus-forward\" significa:",
             "options": ["Con predominio cítrico", "Muy dulce", "Sin alcohol", "Caliente"],
             "answer_index": 0, "explanation_es": "\"Citrus-forward\" = con un sabor cítrico predominante."},
            {"id": "q_ls_2", "type": "fill_gap",
             "prompt_es": "Completa:",
             "sentence": "It's quite ______, not sweet.",
             "answer": "dry", "explanation_es": "\"Dry\" (seco) es lo contrario de dulce en bebidas."},
            {"id": "q_ls_3", "type": "multiple_choice",
             "prompt_es": "El cliente pregunta \"Is it strong?\". ¿Mejor respuesta profesional?",
             "options": ["It's medium — refreshing rather than strong.", "No idea.", "Very strong, be careful.", "Just drink it."],
             "answer_index": 0, "explanation_es": "Da información útil y tranquiliza al cliente."},
            {"id": "q_ls_4", "type": "multiple_choice",
             "prompt_es": "Si el cliente quiere algo aún más ligero, ¿qué ofrecerías?",
             "options": ["A spritz", "A double whisky", "A sweet liqueur", "Nothing"],
             "answer_index": 0, "explanation_es": "Un spritz es más ligero y refrescante."},
            {"id": "q_ls_5", "type": "word_ordering",
             "prompt_es": "Ordena para confirmar:",
             "words": ["does", "How", "sound", "that"],
             "answer": "How does that sound",
             "explanation_es": "\"How does that sound?\" invita al cliente a confirmar."},
        ],
    },
    # =====================================================================
    "guest-says-cocktail-is-too-sweet": {
        "intro": {
            "context_es": "Sirves un cocktail. El cliente lo prueba, hace una pequeña mueca y te dice:",
            "guest_opening_en": "Excuse me, this cocktail is too sweet for me.",
            "guest_opening_es": "Disculpa, este cocktail está demasiado dulce para mí.",
            "summary_es": "Aquí verás la diferencia entre hablar inglés correcto y dar un servicio profesional: reconoce, discúlpate y ofrece una solución.",
            "objectives_es": [
                "Reconocer el problema y agradecer el aviso.",
                "Disculparte sin culpar al cliente ni a la receta.",
                "Ofrecer una alternativa concreta.",
            ],
        },
        "phrases": [
            _p("li_sweet_1", "I'm sorry to hear that.", "Siento oír eso.",
               service_register="professional", service_rating="professional"),
            _p("li_sweet_2", "Thank you for letting me know.", "Gracias por decírmelo.",
               service_rating="excellent", service_note_es="Agradecer el aviso convierte una queja en una oportunidad de dar buen servicio."),
            _p("li_sweet_3", "Would you prefer something less sweet?", "¿Preferirías algo menos dulce?"),
            _p("li_sweet_4", "I can make you something more citrus-forward and dry.", "Puedo prepararte algo más cítrico y seco."),
            _p("li_sweet_5", "Let me fix that for you.", "Deja que lo arregle."),
            _p("li_sweet_bad", "That's how it's supposed to taste.", "Así es como debe saber.",
               service_register="casual", service_rating="inappropriate",
               service_note_es="Correcto en inglés, pero culpa indirectamente al cliente y no resuelve nada.",
               common_mistake_es="Nunca culpes al cliente ni a la receta ante una queja.",
               natural_alternatives=["I'm sorry it's not to your taste. Let me make you something different."]),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Excuse me, this cocktail is too sweet for me.", "spanish": "Disculpa, este cocktail está demasiado dulce para mí."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "I'm really sorry about that. Thank you for letting me know.", "spanish": "Lo siento mucho. Gracias por decírmelo."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "It's just a bit much.", "spanish": "Es solo que es demasiado."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "Of course. Would you prefer something less sweet and more citrus-forward?", "spanish": "Por supuesto. ¿Preferirías algo menos dulce y más cítrico?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Yes, that sounds better.", "spanish": "Sí, eso suena mejor."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "I'll make you a dry, refreshing one instead. This one's on me.", "spanish": "Te preparo uno seco y refrescante en su lugar. Este corre de mi cuenta."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Thank you, that's very kind.", "spanish": "Gracias, muy amable."},
            {"speaker": "bartender", "speaker_label_es": "Bartender", "english": "My pleasure. I'll be right back with it.", "spanish": "Un placer. Vuelvo enseguida con él."},
        ],
        "exercises": [
            {"id": "ex_sw_1", "type": "multiple_choice",
             "prompt_es": "El cliente dice: \"This is too sweet.\" ¿Cuál es la MEJOR respuesta?",
             "options": ["That's how it's supposed to taste.", "I'm sorry about that. Would you like something less sweet?", "You ordered it.", "It's fine."],
             "answer_index": 1, "explanation_es": "Reconoce el problema y ofrece una solución. Las demás culpan al cliente o no resuelven."},
            {"id": "ex_sw_2", "type": "fill_gap",
             "prompt_es": "Completa la disculpa:",
             "sentence": "I'm ______ to hear that.",
             "answer": "sorry", "explanation_es": "\"I'm sorry to hear that\" reconoce el problema con empatía."},
            {"id": "ex_sw_3", "type": "word_ordering",
             "prompt_es": "Ordena para ofrecer una solución:",
             "words": ["fix", "me", "that", "for", "you", "Let"],
             "answer": "Let me fix that for you",
             "explanation_es": "\"Let me fix that for you\" transmite que vas a resolverlo."},
        ],
        "quiz": [
            {"id": "q_sw_1", "type": "multiple_choice",
             "prompt_es": "¿Cuál es correcta en inglés pero culpa al cliente?",
             "options": ["You ordered it, though.", "I'm sorry about that.", "Let me fix that for you.", "Thank you for letting me know."],
             "answer_index": 0, "explanation_es": "\"You ordered it\" es gramatical pero culpa al cliente: mal servicio."},
            {"id": "q_sw_2", "type": "multiple_choice",
             "prompt_es": "El cliente se queja. ¿Cuál es el primer paso profesional?",
             "options": ["Reconocer y disculparte", "Explicar la receta", "Ignorarlo", "Cobrar igualmente"],
             "answer_index": 0, "explanation_es": "Primero reconocer el problema y disculparte; luego ofrecer solución."},
            {"id": "q_sw_3", "type": "fill_gap",
             "prompt_es": "Completa la oferta de solución:",
             "sentence": "I can make you something more citrus-______ and dry.",
             "answer": "forward", "explanation_es": "\"Citrus-forward\" describe un perfil más cítrico, menos dulce."},
            {"id": "q_sw_4", "type": "multiple_choice",
             "prompt_es": "\"This one's on me\" significa:",
             "options": ["Invita la casa", "Está encima de mí", "Es mi culpa", "Págalo tú"],
             "answer_index": 0, "explanation_es": "\"It's on me\" = lo invito yo / la casa."},
            {"id": "q_sw_5", "type": "word_ordering",
             "prompt_es": "Ordena para agradecer el aviso:",
             "words": ["for", "Thank", "you", "letting me know"],
             "answer": "Thank you for letting me know",
             "explanation_es": "Agradecer el aviso demuestra buen servicio."},
        ],
    },
    # =====================================================================
    "guest-asks-for-food-recommendation": {
        "intro": {
            "context_es": "Estás atendiendo una mesa. El cliente cierra la carta y te pregunta:",
            "guest_opening_en": "What would you recommend?",
            "guest_opening_es": "¿Qué me recomiendas?",
            "summary_es": "Aprenderás a preguntar preferencias, describir un plato brevemente y explicar por qué lo recomiendas.",
            "objectives_es": [
                "Preguntar preferencias alimentarias.",
                "Describir un plato de forma breve y apetecible.",
                "Recomendar con confianza sin extenderte demasiado.",
            ],
        },
        "phrases": [
            _p("li_food_1", "Are you in the mood for meat, fish or something vegetarian?", "¿Te apetece carne, pescado o algo vegetariano?"),
            _p("li_food_2", "Do you have any dietary preferences?", "¿Tienes alguna preferencia alimentaria?",
               service_register="professional", service_rating="professional"),
            _p("li_food_3", "I'd recommend the grilled salmon.", "Te recomendaría el salmón a la parrilla."),
            _p("li_food_4", "It's one of our most popular dishes.", "Es uno de nuestros platos más populares."),
            _p("li_food_5", "It's served with seasonal vegetables.", "Se sirve con verduras de temporada."),
            _p("li_food_6", "Would you like me to bring that for you?", "¿Quieres que te lo traiga?"),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "What would you recommend?", "spanish": "¿Qué me recomiendas?"},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Are you in the mood for meat, fish or something vegetarian?", "spanish": "¿Te apetece carne, pescado o algo vegetariano?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Fish, probably.", "spanish": "Pescado, probablemente."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Then I'd recommend the grilled salmon. It's one of our most popular dishes.", "spanish": "Entonces te recomendaría el salmón a la parrilla. Es uno de nuestros platos más populares."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "What does it come with?", "spanish": "¿Con qué viene?"},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "It's served with seasonal vegetables and a lemon sauce.", "spanish": "Se sirve con verduras de temporada y una salsa de limón."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Sounds good, I'll have that.", "spanish": "Suena bien, tomaré eso."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Great choice. I'll bring that for you.", "spanish": "Buena elección. Te lo traigo."},
        ],
        "exercises": [
            {"id": "ex_fd_1", "type": "multiple_choice",
             "prompt_es": "El cliente pregunta \"What would you recommend?\". ¿Mejor primera respuesta?",
             "options": ["Everything is good.", "Are you in the mood for meat, fish or something vegetarian?", "I don't eat here.", "The most expensive one."],
             "answer_index": 1, "explanation_es": "Preguntar la preferencia te permite recomendar algo adecuado."},
            {"id": "ex_fd_2", "type": "fill_gap",
             "prompt_es": "Completa la descripción del plato:",
             "sentence": "It's ______ with seasonal vegetables.",
             "answer": "served", "explanation_es": "\"It's served with...\" = se sirve con..."},
            {"id": "ex_fd_3", "type": "word_ordering",
             "prompt_es": "Ordena para recomendar:",
             "words": ["recommend", "the", "I'd", "grilled salmon"],
             "answer": "I'd recommend the grilled salmon",
             "explanation_es": "\"I'd recommend the...\" es la fórmula para recomendar."},
        ],
        "quiz": [
            {"id": "q_fd_1", "type": "multiple_choice",
             "prompt_es": "\"Dietary preferences\" significa:",
             "options": ["Preferencias alimentarias", "Precio del menú", "Horario de cocina", "Método de pago"],
             "answer_index": 0, "explanation_es": "\"Dietary preferences\" = preferencias/restricciones alimentarias."},
            {"id": "q_fd_2", "type": "multiple_choice",
             "prompt_es": "El cliente pregunta \"What does it come with?\". ¿Mejor respuesta?",
             "options": ["It's served with seasonal vegetables.", "I don't know.", "Food.", "Ask the chef."],
             "answer_index": 0, "explanation_es": "Describe brevemente el acompañamiento del plato."},
            {"id": "q_fd_3", "type": "fill_gap",
             "prompt_es": "Completa:",
             "sentence": "It's one of our most ______ dishes.",
             "answer": "popular", "explanation_es": "\"Most popular\" ayuda a dar confianza en la recomendación."},
            {"id": "q_fd_4", "type": "multiple_choice",
             "prompt_es": "¿Qué respuesta es demasiado larga/poco útil?",
             "options": ["A detailed 2-minute history of the dish", "It's grilled salmon with vegetables.", "It's one of our most popular dishes.", "It's served with a lemon sauce."],
             "answer_index": 0, "explanation_es": "En sala, mejor una descripción breve y apetecible."},
            {"id": "q_fd_5", "type": "word_ordering",
             "prompt_es": "Ordena para ofrecer traerlo:",
             "words": ["me", "to", "bring that", "for you", "Would you like"],
             "answer": "Would you like me to bring that for you",
             "explanation_es": "Ofrecer traer el plato cierra la recomendación con amabilidad."},
        ],
    },
    # =====================================================================
    "guest-mentions-a-nut-allergy": {
        "intro": {
            "context_es": "Un cliente va a pedir, pero antes te avisa de algo importante:",
            "guest_opening_en": "Just so you know, I have a nut allergy.",
            "guest_opening_es": "Para que lo sepas, tengo alergia a los frutos secos.",
            "summary_es": "Aprenderás a responder de forma segura y profesional. Nunca garantices que un plato es seguro: confirma siempre con la cocina.",
            "objectives_es": [
                "Agradecer el aviso y tomarlo en serio.",
                "Confirmar siempre con la cocina antes de asegurar nada.",
                "Usar lenguaje seguro, sin minimizar la alergia.",
            ],
        },
        "phrases": [
            _p("li_nut_1", "Thank you for letting me know.", "Gracias por avisarme.",
               service_rating="professional"),
            _p("li_nut_2", "Let me double-check with the kitchen for you.", "Déjame confirmarlo con la cocina.",
               service_rating="excellent", service_note_es="Confirmar con la cocina es la respuesta segura y profesional ante una alergia."),
            _p("li_nut_3", "I'll confirm that with the kitchen before you order.", "Lo confirmaré con la cocina antes de que pidas."),
            _p("li_nut_4", "We do handle nuts in the kitchen, so let me check the cross-contamination information.", "Trabajamos con frutos secos en la cocina, así que déjame comprobar la información sobre contaminación cruzada."),
            _p("li_nut_5", "Could you tell me exactly which nuts you need to avoid?", "¿Podrías decirme exactamente qué frutos secos debes evitar?"),
            _p("li_nut_bad", "Don't worry, it's completely safe.", "No te preocupes, es totalmente seguro.",
               service_register="casual", service_rating="inappropriate",
               service_note_es="Nunca garantices que algo es seguro si no lo has confirmado con la cocina.",
               common_mistake_es="No minimices una alergia ni des garantías que no puedes asegurar.",
               natural_alternatives=["Let me double-check with the kitchen to be sure."]),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Just so you know, I have a nut allergy.", "spanish": "Para que lo sepas, tengo alergia a los frutos secos."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Thank you for letting me know. Could you tell me exactly which nuts you need to avoid?", "spanish": "Gracias por avisarme. ¿Podrías decirme exactamente qué frutos secos debes evitar?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Peanuts, mostly. Is the pad thai safe?", "spanish": "Cacahuetes, sobre todo. ¿El pad thai es seguro?"},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "We do handle nuts in the kitchen, so let me double-check the cross-contamination information for you.", "spanish": "Trabajamos con frutos secos en la cocina, así que déjame confirmar la información sobre contaminación cruzada."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Thank you, I'd appreciate that.", "spanish": "Gracias, te lo agradecería."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Of course. I'll confirm with the kitchen before you order so we get it right.", "spanish": "Por supuesto. Lo confirmaré con la cocina antes de que pidas para hacerlo bien."},
        ],
        "exercises": [
            {"id": "ex_nt_1", "type": "multiple_choice",
             "prompt_es": "El cliente dice que tiene alergia a los frutos secos. ¿Cuál es la respuesta más SEGURA?",
             "options": ["Don't worry, it's completely safe.", "Let me double-check with the kitchen for you.", "A little bit won't hurt.", "I think it's fine."],
             "answer_index": 1, "explanation_es": "Nunca garantices seguridad. Confirmar con la cocina es lo correcto."},
            {"id": "ex_nt_2", "type": "fill_gap",
             "prompt_es": "Completa la respuesta profesional:",
             "sentence": "Let me double-______ with the kitchen for you.",
             "answer": "check", "explanation_es": "\"Double-check\" = confirmar/verificar de nuevo."},
            {"id": "ex_nt_3", "type": "word_ordering",
             "prompt_es": "Ordena para agradecer el aviso:",
             "words": ["for", "Thank", "you", "letting me know"],
             "answer": "Thank you for letting me know",
             "explanation_es": "Agradecer el aviso demuestra que tomas la alergia en serio."},
        ],
        "quiz": [
            {"id": "q_nt_1", "type": "multiple_choice",
             "prompt_es": "¿Cuál de estas respuestas es INSEGURA y debes evitar?",
             "options": ["Don't worry, it's completely safe.", "Let me confirm with the kitchen.", "Could you tell me which nuts to avoid?", "I'll check the cross-contamination info."],
             "answer_index": 0, "explanation_es": "Garantizar seguridad sin confirmar es peligroso e inapropiado."},
            {"id": "q_nt_2", "type": "multiple_choice",
             "prompt_es": "\"Cross-contamination\" significa:",
             "options": ["Contaminación cruzada", "Plato principal", "Pago con tarjeta", "Menú infantil"],
             "answer_index": 0, "explanation_es": "Es el contacto entre alimentos que puede transferir alérgenos."},
            {"id": "q_nt_3", "type": "fill_gap",
             "prompt_es": "Completa:",
             "sentence": "I'll ______ that with the kitchen before you order.",
             "answer": "confirm", "explanation_es": "\"Confirm with the kitchen\" es la acción segura."},
            {"id": "q_nt_4", "type": "multiple_choice",
             "prompt_es": "Antes de asegurar que un plato no lleva frutos secos, ¿qué debes hacer?",
             "options": ["Confirmar con la cocina", "Adivinar", "Decir que sí para no molestar", "Ignorarlo"],
             "answer_index": 0, "explanation_es": "Siempre confirmar con la cocina; nunca adivinar con alergias."},
            {"id": "q_nt_5", "type": "word_ordering",
             "prompt_es": "Ordena la respuesta segura:",
             "words": ["with", "the kitchen", "check", "Let me", "double"],
             "answer": "Let me double check with the kitchen",
             "explanation_es": "Confirmar con la cocina es la respuesta profesional y segura."},
        ],
    },
    # =====================================================================
    "food-is-taking-longer-than-expected": {
        "intro": {
            "context_es": "La mesa lleva un rato esperando su comida. El cliente te llama y te pregunta:",
            "guest_opening_en": "Excuse me, is our food going to be much longer?",
            "guest_opening_es": "Disculpa, ¿va a tardar mucho más nuestra comida?",
            "summary_es": "Aprenderás a reconocer el retraso, gestionar la espera y confirmar con la cocina, sin inventar tiempos exactos.",
            "objectives_es": [
                "Reconocer el retraso y disculparte.",
                "Comprobar con la cocina antes de dar información.",
                "Gestionar la espera sin inventar tiempos exactos.",
            ],
        },
        "phrases": [
            _p("li_wait_1", "I'm so sorry for the wait.", "Siento mucho la espera.",
               service_rating="professional"),
            _p("li_wait_2", "Let me check with the kitchen for you.", "Déjame comprobarlo con la cocina.",
               service_rating="excellent", service_note_es="Comprobar con la cocina te permite dar información real, no inventada."),
            _p("li_wait_3", "I'll find out how much longer it will be.", "Voy a averiguar cuánto falta."),
            _p("li_wait_4", "Thank you for your patience.", "Gracias por tu paciencia."),
            _p("li_wait_5", "Can I get you anything while you wait?", "¿Te traigo algo mientras esperas?"),
            _p("li_wait_bad", "It'll be ready in two minutes.", "Estará listo en dos minutos.",
               service_register="casual", service_rating="too_direct",
               service_note_es="No inventes tiempos exactos si no los conoces: si fallas, empeora la queja.",
               common_mistake_es="Evita prometer tiempos concretos sin confirmarlos con la cocina.",
               natural_alternatives=["Let me check with the kitchen and I'll come straight back to you."]),
        ],
        "dialogue": [
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Excuse me, is our food going to be much longer?", "spanish": "Disculpa, ¿va a tardar mucho más nuestra comida?"},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "I'm so sorry for the wait. Let me check with the kitchen for you.", "spanish": "Siento mucho la espera. Déjame comprobarlo con la cocina."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Thanks, we've been waiting a while.", "spanish": "Gracias, llevamos un rato esperando."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "I completely understand. I'll find out how much longer it will be.", "spanish": "Lo entiendo perfectamente. Voy a averiguar cuánto falta."},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Okay, thank you.", "spanish": "Vale, gracias."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Can I get you anything while you wait?", "spanish": "¿Te traigo algo mientras esperas?"},
            {"speaker": "customer", "speaker_label_es": "Cliente", "english": "Some water would be great.", "spanish": "Un poco de agua estaría genial."},
            {"speaker": "waiter", "speaker_label_es": "Camarero/a", "english": "Right away. Thank you for your patience.", "spanish": "Enseguida. Gracias por tu paciencia."},
        ],
        "exercises": [
            {"id": "ex_wt_1", "type": "multiple_choice",
             "prompt_es": "El cliente pregunta por su comida que tarda. ¿Cuál es la mejor respuesta?",
             "options": ["It'll be ready in two minutes.", "I'm sorry for the wait. Let me check with the kitchen.", "Not my problem.", "The kitchen is slow today."],
             "answer_index": 1, "explanation_es": "Disculparte y comprobar con la cocina evita inventar tiempos y calma al cliente."},
            {"id": "ex_wt_2", "type": "fill_gap",
             "prompt_es": "Completa la disculpa:",
             "sentence": "I'm so sorry for the ______.",
             "answer": "wait", "explanation_es": "\"Sorry for the wait\" reconoce el retraso."},
            {"id": "ex_wt_3", "type": "word_ordering",
             "prompt_es": "Ordena para comprobar con la cocina:",
             "words": ["with", "the kitchen", "check", "Let me"],
             "answer": "Let me check with the kitchen",
             "explanation_es": "Comprobar con la cocina te permite dar información real."},
        ],
        "quiz": [
            {"id": "q_wt_1", "type": "multiple_choice",
             "prompt_es": "¿Por qué es arriesgado decir \"It'll be ready in two minutes\"?",
             "options": ["Porque inventas un tiempo que quizá no se cumpla", "Porque es descortés", "Porque es incorrecto en inglés", "Porque es demasiado formal"],
             "answer_index": 0, "explanation_es": "Prometer un tiempo exacto sin confirmarlo puede empeorar la queja."},
            {"id": "q_wt_2", "type": "fill_gap",
             "prompt_es": "Completa para agradecer la espera:",
             "sentence": "Thank you for your ______.",
             "answer": "patience", "explanation_es": "\"Thank you for your patience\" es cortés y profesional."},
            {"id": "q_wt_3", "type": "multiple_choice",
             "prompt_es": "Mientras el cliente espera, ¿qué gesto mejora el servicio?",
             "options": ["Ofrecerle algo de beber", "Ignorarle", "Culpar a la cocina", "Decir que no sabes nada"],
             "answer_index": 0, "explanation_es": "Ofrecer agua o algo de beber gestiona bien la espera."},
            {"id": "q_wt_4", "type": "multiple_choice",
             "prompt_es": "\"I'll find out\" significa:",
             "options": ["Voy a averiguarlo", "Ya está listo", "No lo sé y no me importa", "Está cancelado"],
             "answer_index": 0, "explanation_es": "\"Find out\" = averiguar/descubrir información."},
            {"id": "q_wt_5", "type": "word_ordering",
             "prompt_es": "Ordena la oferta durante la espera:",
             "words": ["you", "get", "Can I", "anything", "while you wait"],
             "answer": "Can I get you anything while you wait",
             "explanation_es": "Ofrecer algo durante la espera demuestra atención."},
        ],
    },
}


# Assessment dimension per question id (only service/comprehension listed; rest = english).
# Added as metadata at seed time so the curated copy is never rewritten.
ASSESSMENT_DIMENSIONS = {
    # taking-an-order
    "q_mc_reply": "comprehension", "q_mc_meaning": "comprehension",
    # cocktail recommendation
    "ex_rc_1": "service", "q_rc_2": "service", "q_rc_1": "comprehension",
    # less sweet
    "ex_ls_1": "service", "q_ls_3": "service", "q_ls_4": "comprehension",
    # too sweet
    "ex_sw_1": "service", "q_sw_1": "service", "q_sw_2": "service", "q_sw_4": "comprehension",
    # food recommendation
    "ex_fd_1": "service", "q_fd_4": "service", "q_fd_2": "comprehension",
    # nut allergy
    "ex_nt_1": "service", "q_nt_1": "service", "q_nt_4": "service", "q_nt_2": "comprehension",
    # food delay
    "ex_wt_1": "service", "q_wt_1": "service", "q_wt_3": "service", "q_wt_4": "comprehension",
}


def dimension_for(qid):
    return ASSESSMENT_DIMENSIONS.get(qid, "english")


def apply_lesson_metadata(lesson):
    """Return a copy of the lesson with content_version + per-question assessment_dimension.
    Does not alter any curated text."""
    out = dict(lesson)
    out["content_version"] = 1
    for section in ("exercises", "quiz"):
        out[section] = [{**q, "assessment_dimension": dimension_for(q["id"])} for q in lesson[section]]
    return out


async def seed_catalog(db):
    situations = [dict(s) for s in SITUATIONS]
    if situations:
        await db.situations.insert_many(situations)

    for sit in SITUATIONS:
        slug = sit["slug"]
        lesson = LESSONS[slug]
        lesson_doc = {"situation_slug": slug, **apply_lesson_metadata(lesson)}
        await db.lessons.insert_one(dict(lesson_doc))

        # Persist each phrase as a learning item (stable id, forward-looking fields).
        items = []
        for phrase in lesson["phrases"]:
            item = {
                "id": phrase["id"],
                "category_slug": sit["category"],
                "situation_slug": slug,
                "type": "phrase",
                "difficulty": sit["level"],
                "english_content": phrase["english_content"],
                "translations": phrase["translations"],
                "skills": sit["skills"],
                "country_variants": {},
            }
            # Carry optional Service English metadata onto the learning item too.
            for k in ("service_register", "service_rating", "service_note_es",
                      "context_es", "natural_alternatives", "common_mistake_es"):
                if k in phrase:
                    item[k] = phrase[k]
            items.append(item)
        if items:
            await db.learning_items.insert_many(items)
