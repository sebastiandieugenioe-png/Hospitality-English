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
