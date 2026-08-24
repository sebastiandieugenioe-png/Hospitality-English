# PRD — Inglés para Hostelería

## Original Problem Statement
MVP de una plataforma para hispanohablantes que trabajan (o quieren trabajar) en hostelería, para aprender el inglés de situaciones laborales reales. UI en Español, contenido a aprender en Inglés. Aprendizaje organizado por **situaciones reales de trabajo**, no por niveles A1/A2. Fase 1: landing pública, onboarding simple (sin login/email), y experiencia de aprendizaje básica end-to-end.

## User Choices (confirmadas)
- Progreso guardado en **backend con guest ID anónimo**.
- Contenido servido desde **MongoDB vía API**.
- Estilo visual elegido por el agente (premium, minimalista, NO estilo Duolingo).
- UI 100% Español, sin selector de idioma visible.
- Mobile-first.

## Architecture
- **Backend**: FastAPI + MongoDB (motor). Rutas con prefijo `/api`. Contenido sembrado en startup (`seed_content.py`, idempotente: recarga colecciones de contenido sin tocar `guests`).
  - Colecciones: `categories`, `situations`, `learning_items`, `lessons`, `guests`.
  - **Localization-ready**: los learning items tienen `id` estable independiente del idioma y `english_content`; las traducciones viven en `translations` (map por locale, sólo `es` en V1). El progreso referencia `learning_item_id`, nunca el texto.
- **Frontend**: React (react-router). Estado de guest/onboarding en `AppContext` + `localStorage` (`iph_guest_id`, `iph_onboarding`). Contenido siempre vía API. Diseño: Playfair Display + Manrope, paleta forest/sand/terracotta. framer-motion para transiciones y flip de flashcards.

## API
- `GET /api/categories`, `GET /api/categories/{slug}`, `GET /api/lessons/{situation_slug}`
- `POST /api/guests`, `GET /api/guests/{id}`, `PUT /api/guests/{id}/onboarding`
- `POST /api/guests/{id}/flashcard`, `POST /api/guests/{id}/complete`

## Implemented (2026-08-22)
- Landing pública SEO-friendly (semantic HTML, metadata, headings) con todas las secciones pedidas y CTAs.
- Onboarding 2 preguntas (workplace + goal), sin email/login; crea guest anónimo en backend.
- Home: Continue learning, Recommended for you (según workplace), Explore categories (7 categorías desde API).
- Category page: lista de situaciones (sample). Sólo `taking-an-order` es lección completa; el resto muestra "Pronto".
- Lección completa (Restaurant → Taking an order) end-to-end: Intro (3 objetivos) → Frases útiles (EN+ES) → Situación real (diálogo con toggle de traducción) → Flashcards (EN→ES y ES→EN, flip, "Lo sabía"/"No lo sabía" registran interacción) → Ejercicios (multiple choice, fill gap, word ordering, feedback inmediato) → Quiz 5 preguntas con resultado → Completion (score, frases practicadas, botones).
- Progreso (flashcards + completion) persistido en backend por guest.
- Verificado E2E por testing agent (desktop + mobile 390x844) tras corregir bug de word_ordering.

## Deliberately OUT of scope (fases futuras)
login obligatorio, Google/Apple login, ads, subscriptions, payments, analytics avanzada, admin panel, bulk import, spaced repetition, study queue, streak, XP, achievements, leaderboards, audio, micrófono, speaking, AI, push, app nativa, idiomas adicionales.

## Backlog (P1/P2 — no implementar sin pedido)
- P1: Completar lecciones del resto de situaciones; panel admin + bulk import CSV/JSON.
- P1: Cuentas opcionales y sync de progreso entre dispositivos.
- P2: Spaced repetition / study queue; XP/streak/achievements; PWA + offline; audio/speaking; i18n de UI y nuevos source languages.

## Next Tasks
- Autorizar contenido para más situaciones (mismo esquema que `taking-an-order`).

---

## Architecture Evolution Prep (2026-08-22) — backwards compatible
Objetivo futuro: "Entrenar las conversaciones reales que un trabajador de hostelería necesita en inglés". Roles iniciales: **bartender**, **waiter**.

### Añadido (aditivo, sin romper nada)
- Nuevas colecciones de referencia (read-only) + seed idempotente (`seed_reference.py`): `professional_profiles`, `venue_types`, `target_countries` (con `english_variant`), `skills`.
- Endpoints read-only: `GET /api/professional-profiles`, `/api/venue-types`, `/api/target-countries`, `/api/skills`.
- Campos opcionales en `situations`: `roles`, `skills`, `venue_types`, `country_variants` (default `[]`), mapeados en `SITUATION_META`.
- Campos opcionales en `learning_items`: `skills` (`[]`), `country_variants` (`{}`) — estructura para variantes por país sin duplicar el item.
- `guests` ampliado en creación: `professional_profile {role,venue_type,country,skills}` + placeholders `situation_attempts`, `mistake_bank`, `srs` (aún no usados por ninguna feature).
- Endpoint `PUT /api/guests/{id}/profile` para fijar el perfil profesional.
- Índices Mongo forward-looking (guests.id, slugs).
- Fix latente: los `word_ordering` answers ya no incluyen `?` (el frontend ya normalizaba puntuación) → datos consistentes.

### NO tocado
Rutas existentes, diseño visual, autenticación (no hay), colecciones de contenido/guests existentes, UI en español, frontend (ignora los campos nuevos). 19/19 tests backend pasan.

### Próximo a implementar (roadmap, NO hecho aún)
professional profiles UI + onboarding por rol; situation attempts + service-language scoring; job-readiness progress; mistake bank; spaced repetition; shift practice; on-shift phrase search; country-specific vocabulary variants.

---

## Fase: Mistake Bank + Repetición Espaciada (SRS) + Practice (2026-08-24)
Backend es la fuente de verdad para corrección y para el scheduling SRS. Timestamps en UTC.

### Backend (`server.py`)
- **Mastery semantics**: umbrales en constantes (`MASTERY_OVERALL_THRESHOLD=80`, `MASTERY_SERVICE_THRESHOLD=70`). `complete_attempt` escribe el campo canónico `met_mastery_threshold` + mirror legacy `mastered` (retrocompat). `situation_stats` deriva mastery con `_attempt_mastered` (canónico con fallback al legacy).
- **Colección `review_items`** (independiente). Único por `guest_id + source_type + source_id + situation_slug` (índice único). Al enviar respuesta incorrecta en un attempt (`PUT /situation-attempts/{id}/response`), `_upsert_mistake` crea/actualiza el item (source_type=question, origin=mistake). `times_wrong` se incrementa como máximo una vez por attempt (guardado por `last_mistake_attempt_id`).
- **Endpoints SRS**:
  - `GET /api/guests/{id}/review-items?due=&limit=` → items con `content` resuelto (sin N+1 vía `_resolve_review_content`), sin filtrar la respuesta (`_public_question`). `due=true` = `next_review_at<=now`. Orphans (contenido inexistente) se omiten.
  - `GET /api/guests/{id}/review-summary` → `{total, due, by_skill, by_dimension}`.
  - `POST /api/review-items/{id}/answer` → backend califica; devuelve `correct`, `correct_answer`, `explanation`; incrementa `times_seen`/`times_correct`. No toca scheduling.
  - `POST /api/review-items/{id}/rate` → `again|hard|good|easy` (422 si otro). `_compute_schedule` recalcula `ease_factor` (min 1.3), `interval_days`, `consecutive_successes`, `review_state`, `next_review_at`, `last_reviewed_at`. Rating independiente de la corrección. SM-2 simplificado: again=+10min/reset; good 1º=1d, 2º=3d; easy 1º=3d, 2º=7d; luego ×ease.
- Índices nuevos para `review_items`.

### Frontend (`pages/Practice.js`, ruta `/practice`, enlace navbar `Practicar`)
- Landing: tarjeta prominente de items **due**, "Errores por habilidad", "Banco de errores" con filtros Todos/Inglés/Comprensión/Servicio (por `assessment_dimension`, incluye todos los errores activos aunque no estén due), estado vacío, y estado de error con reintento.
- Sesión de repaso: pregunta (MC/fill_gap/word_ordering) → Comprobar → feedback (correcto/incorrecto + respuesta correcta + explicación) → valorar dificultad → siguiente → "Repaso completado".
- Redirige a `/onboarding` si el perfil no está completo; `load()` con try/catch (guest inválido no rompe la página).

### i18n (multilingüe es/it) — implementado (2026-06)
- **Idioma de interfaz** por huésped: `guests.interface_language` ("es"|"it"). `PUT /api/guests/{id}/language` lo actualiza.
- **Helper `_loc_field(obj, base, lang)`**: resuelve campo localizado con doble forma soportada — agrupada `translations.<lang>.<base>` (usado en situaciones) y sufijo `<base>_<lang>` (usado en ejercicios/quiz). Fallback silencioso: lang → es → None. `_loc_options` localiza opciones MC solo si existe traducción; las respuestas objetivo en inglés NUNCA se traducen.
- **Endpoints localizados**: `/review-items` resuelve `content.prompt`, `content.options`, `situation_title` y `explanation` según `interface_language` del huésped. `title_en` (inglés objetivo) preservado.
- **Contrato de tests actualizado** (i18n): `content.prompt_es`→`content.prompt`, `situation_title_es`→`situation_title`. Sin cambio en lógica SRS/scoring ni exposición de `answer`/`answer_index` antes del POST.
- **Frontend**: `locales/es.json`, `locales/it.json`, `lib/i18n.js` (`t()`), strings reemplazados en Navbar/Onboarding/Lesson/Practice/ServiceNote.
- **Seed**: taxonomías + 2 lecciones piloto (incl. `guest-says-cocktail-is-too-sweet`) con `it`.

### Tests
- `tests/test_srs.py` + `test_srs_verification.py`: **30 passed** tras adaptar aserciones al contrato i18n. Validación manual curl: guest conserva `interface_language=it`, título/prompt en italiano, opciones/`title_en` en inglés objetivo intactos.

### Fuera de alcance (confirmado por el usuario, NO hecho)
Fusionar flashcards legacy en SRS; Job Readiness global; ampliar catálogo; Shift Practice; IA.

## Next Tasks
- (Backlog) Integrar flashcards legacy en el motor `review_items`.
- (Backlog) Shift/Daily Practice; Job Readiness global.

