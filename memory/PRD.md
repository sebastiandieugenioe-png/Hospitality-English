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
- (UX Fase 2) Rediseño interno de Home/Learn/Practice/Progress + /more completo usando designTokens.
- (Manual) Confirmar compra real Test Store (checkout web no headless).

### Fase 15 (2026-06) — UX/UI base: Design System + App Shell + Bottom Nav (PREVIEW, SIN deploy)
- Solo base visual + navegación (sin rediseñar pantallas internas; sin tocar learning/auth/billing/SRS). Genérico reutilizable por EnglishToWork (`AppShell`, `BottomNavigation`, `AppHeader`, `designTokens`).
- Creados: `lib/designTokens.js`, `components/AppShell.js` (+`AppHeader`, prop `showBottomNav` para focus mode), `components/BottomNavigation.js` (+`DesktopNavigation`, `ROOT_TABS`), `pages/More.js`, ruta `/more`. Añadido `nav.more`+`more.*` a los 10 locales.
- IA 5 secciones (Inicio/Aprender/Práctica/Progreso/Más): móvil bottom nav fija (safe-area, tap≥44px, aria-current, iconos Lucide); desktop top-nav con misma IA. Root pages envueltas en `AppShell`, Navbar superior antiguo eliminado de ellas; Language+Account movidos a /more. Páginas focus/públicas intactas.
- Verificado en navegador (390px y 1280px): 5 rutas con tab activo correcto, sin navbar antiguo, contenido no tapado, /more con tools+account+language, i18n ES OK. Sin regresiones (auth/billing/learning sin cambios).


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

### Importación MVP Content Pack v1 (2026-06)
- **13 situations** importadas (7 bartender + 6 waiter) → catálogo activo total **20** (10 bartender, 10 waiter). Las 7 situations previas intactas.
- **Fuente reproducible**: `backend/data/mvp_content_pack_v1.json` (pack aprobado, sin reescribir contenido). Importador: `backend/seed_pack.py` → `seed_pack(db)` llamado en startup tras `seed_catalog`. Idempotente (seed_content limpia colecciones al arrancar; un restart no duplica).
- **Adaptación puramente estructural** al schema existente (situations/lessons/learning_items), sin nuevas colecciones ni segunda arquitectura:
  - phrase `text_en`→`english_content`; `translations.es.text`→`translations.es` (string); `translations.es.{service_note,common_mistake,context}`→sufijos `_es`; `natural_alternatives_en`→`natural_alternatives`.
  - dialogue `text_en`→`english`, `translations.es.text`→`spanish`, `speaker_label_es` derivado del speaker.
  - exercises/quiz: se conserva el shape agrupado `translations.es.{prompt,explanation}` (lo resuelven `getLocalizedField`/`_loc_field`); `sentence_en`→`sentence`. Se preservan stable ids, options, answer/answer_index, assessment_dimension y content_version.
- **Mapping venue_type_targets → IDs taxonomía existente**: cocktail bar→cocktail-bar, pub→pub, hotel 4-5 star→hotel-restaurant, casual restaurant→casual-restaurant, fine dining→fine-dining. `venue_type_targets` no se persiste como modelo final.
- **i18n**: pack trae EN (target, intacto) + ES. Sin italiano → IT hace fallback silencioso a ES vía helpers existentes.
- **Flashcards**: derivadas de phrases; las de `service_rating="inappropriate"` se excluyen (verificado en vivo: 6 frases → 5 flashcards en `guest-has-had-too-much-to-drink`).
- **Tests**: `backend/tests/test_pack_import.py` (9 tests) → PASS. Regresión relevante: test_catalog/test_attempts/test_architecture (41) + test_srs/test_srs_verification (30) → PASS. No deploy.

### Importación multilingüe verificada v1 (2026-06) — 10 idiomas de interfaz
- Fuente de verdad: `backend/data/mvp_i18n_import_bundle_verified_v1.json` (1035 IDs × 10 idiomas).
- **Idiomas soportados (10)**: es, it, fr, pt(pt-PT), de, pl, ro, uk, nl, en. ES = fallback; EN = idioma aprendido Y también idioma de interfaz seleccionable. Registro centralizado en `server.py SUPPORTED_LANGUAGES` y `frontend/src/lib/i18n.js`.
- **Overlay idempotente** `backend/seed_i18n.py` (`apply_i18n_bundle`, corre al startup tras seed_pack): inyecta traducciones sobre docs ya sembrados usando los shapes que los resolvers ya soportan — grouped `translations.<lang>.<base>` (situation title/desc, intro, exercise/quiz prompt/explanation/options), string-map `translations.<lang>` (phrase & dialogue text), suffix `<base>_<lang>` (phrase metadata, dialogue speaker_label). Etiquetas de speaker del pack reutilizan las traducciones legacy verbatim del bundle (mismas cadenas ES). NUNCA modifica: english_content, dialogue english, sentence/words, options canónicas, answer, answer_index, assessment_dimension, scoring, attempts, mastery, review_items, SRS, slugs, IDs.
- **Locales frontend**: 10 archivos `locales/{lang}.json` (174 claves) generados desde el bundle (`tools/gen_locales.py`). `makeT` cae a ES.
- **9 hardcoded UI wired** a `t()`: Category.js ×5 (lesson.backHome, common.loading, category.notFound, category.available, category.comingSoon), Lesson.js ×3 aria-labels (lesson.closeAria, lesson.flipCardAria, common.back), Onboarding.js ×1 (common.back). `speaker_label` de diálogo localizado vía `getLocalizedField`.
- **Fix menor**: `PUT /situation-attempts/{id}/response` ahora devuelve `feedback` localizado (`_loc_field(q,"explanation",lang)`).
- **Fuera del bundle (reportado, no inventado)**: las `categories` (name/description) no vienen en el bundle → permanecen EN/ES en toda interfaz. El bundle sí cubre professional_profiles, venue_types, target_countries, learning_goals, skills.
- **Tests**: `tests/test_i18n_import.py` (8) PASS + testing_agent iteración 3 (9 tests, sin defectos críticos, idempotente, progreso/review_items preservados, contenido inglés intacto). Sin deploy.

### Localización de `categories` (micro-pack v1, 2026-06)
- Fuente de verdad: `backend/data/mvp_categories_i18n_micro_pack_v1.json` (7 categorías × 10 idiomas name+description).
- Overlay idempotente `seed_i18n.apply_categories_i18n(db)` (llamado al final de `apply_i18n_bundle`): match por slug; preserva `_id`, `slug`, `icon`, `order`, `name_en`, `name_es`, `description_es`; añade grouped `translations.<lang>.{name,description}` (shape que `getLocalizedField` ya resuelve, ES fallback). PT bajo código interno `pt` (contenido pt-PT).
- Wiring frontend mínimo (usa resolver existente): `Home.js` nombre de categoría vía `getLocalizedField` (la descripción ya lo usaba); `Category.js` header name+description vía `getLocalizedField`.
- **Tests**: `tests/test_categories_i18n.py` (7) PASS + testing_agent iteración 4 (**100% backend + 100% frontend**, sin issues, idempotente). Sin deploy.

### QA final pre-deploy (2026-06)
- **Suite completa backend**: 161 tests → 160 passed + 1 flaky (`ConnectionError` transitorio bajo carga paralela; pasa aislado). 0 regresiones reales.
- **Bugs bloqueantes encontrados y corregidos** (verificados por testing_agent iteración 6, 100% backend+frontend):
  1. `seed_i18n._set_options` compactaba mapas de índices sparse → opciones MC localizadas truncadas/desplazadas → corrupción de grading (falsos positivos, preguntas irresolubles) + 500 en `POST /review-items/{id}/answer`. **Fix**: construir desde las `options` canónicas y sobrescribir solo los índices provistos (position-preserving); `_loc_options` ahora exige `len(loc)==len(canonical)` y `_correct_answer_text` valida bounds (nunca 500). Regresión: `test_i18n_import.py::TestLocalizedOptionsInvariant` (+2 tests).
  2. Navbar móvil (390px) desbordaba en uk/fr y ocultaba el selector de idioma. **Fix**: enlaces en contenedor scrollable `min-w-0`, `LanguageSwitcher` en wrapper `shrink-0` (siempre accesible). Sin rediseño.
- **Gaps de datos del bundle (report-only, NO corregidos — prohibido inventar)**: cobertura de traducción de opciones MC ~40% (223/376 por idioma caen a ES → listas mixtas en ~26-28 preguntas/idioma); `skills` solo es/it (8 idiomas caen a ES); `categories.situation_count` incluye situations inactivas 'Pronto' (preexistente/intencional); interfaz EN duplica el target inglés como su traducción (por diseño); word_ordering chips sin data-testid (LOW, solo testabilidad).
- **Build producción**: frontend `yarn build` OK; backend inicia OK. **No se hizo deploy.**

### Cierre final de gaps i18n (micro-pack final, 2026-06)
- Fuente de verdad: `backend/data/mvp_final_i18n_gaps_micro_pack_v1.json`.
- **Skills**: `seed_i18n.apply_skills_i18n` añade fr/pt/de/pl/ro/uk/nl/en (grouped `translations.<lang>.{name,description}`, match por id); los 14 skills resuelven los 10 idiomas (ES fallback). Base name/roles/order/active y es/it intactos.
- **Opciones MC**: `seed_i18n.apply_mc_option_gaps` rellena los 223 índices faltantes × 9 idiomas (2007 valores) por `question_id+index`, position-preserving (nunca compacta). `preserve_english_target_verbatim` (152) conserva el inglés canónico verbatim; `localized_interface_answer` (71) usa la traducción. Las 94 MC mantienen 4 opciones, orden, `answer_index` y `assessment_dimension` intactos.
- **situation_count**: `GET /api/categories` ahora filtra `active:True` → counts 0/10/10/0/0/0/0 (visibilidad de categorías sin cambios).
- Idempotente tras restart. **Tests**: `tests/test_final_gaps.py` (7) PASS + testing_agent iteración 7 (**100% backend 32/32 + 100% frontend**, sin issues). Sin deploy.

### Content Pack v2 — 30 situaciones (2026-06, catálogo 20→50)
- Fuente de verdad: `backend/data/hospitality_english_content_v2_emergent_single_file.json` (content_pack 30 situaciones + i18n_bundle 1024 IDs × 10 idiomas + preserve_english_mc_items 48).
- Importador `seed_pack_v2.py` (reutiliza transformaciones de `seed_pack.py`): 10 `activate_existing_placeholder` (por slug exacto) + 20 `new`. `handling-a-complaint` no tenía placeholder exacto (solo `handling-a-complaint-bar`); por autorización del usuario se importó como **new** con slug exacto `handling-a-complaint`, dejando `handling-a-complaint-bar` inactivo/intacto. Idempotente (seed_content limpia + replace/upsert).
- i18n: `seed_i18n.apply_i18n_bundle` fusiona bundles v1+v2; `_build_lookup` acepta source `mvp_content_pack_v2_30`, normaliza el vocabulario de keys v2 (`lesson.intro.*`→`intro.*`, `intro.objective.N`→`intro.objectives.N`, `exercise.*`→`exercises.*`) y descarta el índice redundante en campos escalares por item_id (mantiene índice solo en `.option.N`).
- MC: 120 preguntas v2 (48 preserve_english_target_verbatim → opciones en inglés verbatim en todos los locales; 72 translate_from_es → opciones localizadas full-length). Orden/answer_index/assessment_dimension/canonical intactos.
- Catálogo final: **50 activas (25 Bartender + 25 Waiter)**; categorías active-only (restaurant 25, bar 25, resto 0). MC activas totales 214 (94 v1 + 120 v2).
- **Tests**: `tests/test_v2_import.py` (8) PASS + regresión v1 actualizada (33) PASS + testing_agent iteración 8 (**100% backend 64/64 + 100% frontend**, sin issues críticos, idempotencia verificada en 2 restarts). Sin deploy.

### Exportación i18n v1 (2026-06) — solo lectura, sin cambios de código/contenido
- Herramienta reproducible `backend/tools/export_i18n.py` → genera `backend/data/mvp_i18n_export_v1.json` (copia descargable en `frontend/public/`).
- Contiene: 7 situations legacy activas (completas: situation+lesson+learning_items, sin las 13 del pack), `ui_translations` (168 claves es+it), 9 strings visibles hardcodeados detectados, taxonomías (profiles 2, venues 6, countries 6, goals 5, skills 14), idiomas soportados (es/it) y descripción del fallback. Excluye guests/progress/attempts/SRS.

### Fuera de alcance (confirmado por el usuario, NO hecho)
Fusionar flashcards legacy en SRS; Job Readiness global; ampliar catálogo; Shift Practice; IA.

### Fase 2 (2026-06) — Onboarding con consecuencias reales + detección automática de idioma (PREVIEW, SIN deploy)
- **Schema**: añadido `professional_profile.employment_status` (`looking_for_job | interview_soon | starting_new_job | already_working`), opcional y compatible con perfiles existentes (default `null`, nunca resetea progreso). `ProfileUpdate` lo valida (422 si inválido).
- **Recomendaciones deterministas**: nuevo endpoint `GET /api/guests/{id}/recommended-situations?limit=5`. Helper `_rec_score` con pesos por bandas que garantizan el orden de prioridad requerido: role (1000) > progreso not_started/in_progress/completed/mastered (200/120/40/0) > debilidades del banco de errores (80/40) > goal/employment (focus comunicación/práctico +60, dificultad±según already_working/looking_for_job) > venue_type (30, neutral si `venue_types` vacío) > english_level (0-20 por proximidad). Nunca oculta contenido; el catálogo completo sigue accesible.
- **Home**: sección "Recommended for you" ahora muestra 3-5 **situaciones** personalizadas (antes categorías); nuevo `RecommendedSituationCard`. "Explore categories" intacto.
- **Detección de idioma**: `detectBrowserLanguage()` itera `navigator.languages`, normaliza variantes regionales (es-*→es, en-IE→en, pt-BR→pt, …), fallback `es`. Solo se usa en primer uso (sin `iph_lang` ni `guest.interface_language`); nunca sobrescribe una elección manual (fuente de verdad: DB `interface_language`). `pt` sigue siendo el código interno.
- **Onboarding**: ahora 6 pasos (language, role, venue, country, goal, **employment**). Opciones de employment hardcodeadas con labels i18n en los 10 locales.
- **i18n**: añadidas claves `onboarding.employment.*` y `home.recommendedEmpty` a los 10 locales.
- **Tests**: `tests/test_phase2_recommendations.py` (15/15 PASS) + `test_onboarding.py` actualizado. testing_agent iteración 9: 100% backend (15/15) + 100% frontend (6/6 detección idioma, onboarding 6 pasos, elección manual no sobrescrita, Home recomendaciones). Confirmado **50/25/25 intacto**. Sin deploy.

### Fase 4 (2026-06) — Tonight's Shift MVP (PREVIEW, SIN deploy)
- Práctica diaria de 5 preguntas (3–5 min) que REUTILIZA items existentes de `lessons.exercises` + `lessons.quiz` (400 items únicos). No crea contenido nuevo ni duplica filas.
- **Selección** (`_select_shift_items`) implementa `algorithm.slot_order` exacto: slot1 due_review → slot2/3 assessment_weakness → slot4 recommended → slot5 variety, con fallbacks. Dedupe: sin item_id repetido, prefiere situaciones distintas y ≤2 del mismo type. Desempate determinista = `sha256(guest_id|local_date|item_id)`; sin IA ni random. `local_date` del navegador.
- **Persistencia**: colección `shift_sessions`, índice único `(guest_id, local_date, role)`. Reanuda in_progress; completed es read-only ese día; distinto role = sesión distinta.
- **Scoring**: 5 preguntas, X/5, `focus_skill` = skill con más errores (empate por orden de slot; si todo correcto usa primer weak skill del assessment o nulo). NO toca mastery, situation completion, attempts ni review_items (SRS solo lectura).
- Endpoints: `POST /api/guests/{id}/tonights-shift/start`, `GET /api/guests/{id}/tonights-shift`, `PUT /api/shift-sessions/{id}/response`, `POST /api/shift-sessions/{id}/complete`, `GET /api/tonights-shift/meta`. Refactor: `_rank_situations_for_guest` compartido con Recommended.
- Frontend: `TonightsShift.js` (/tonights-shift) con feedback inmediato; card en Home (`shift-entry-card`, estado "completed today").
- i18n: `tonights_shift_data.py` + `data/tonights_shift.json` (ui en 10 idiomas).
- **Tests** (iteración 12): 20/20 backend + frontend happy path completo. Sin bugs. Confirmado: 5 items, estabilidad diaria/idioma, no-SRS/mastery, 10 idiomas, Assessment+Emergency intactos, 50/25/25.

### Fase 7 (2026-06) — Listening MVP (WorkEnglish-compatible) (PREVIEW, SIN deploy)
- **Contenido**: `backend/data/listening.json` (source of truth, read-only) = 50 listening items (25 bartender / 25 waiter), `profession_id="hospitality"`, 10 idiomas. 50 situation_slugs únicos = 1:1 con las 50 situations activas. `transcript_en` / `model_response_en` servidos verbatim (nunca traducidos/reescritos); `answer_index` nunca expuesto antes de responder.
- **Audio**: adapter aislado `tts_elevenlabs.py` (ElevenLabs `eleven_multilingual_v2`, mp3_44100_128, VoiceSettings stability=0.5/similarity=0.75). Script idempotente `generate_listening_audio.py` → 50 MP3 en `frontend/public/listening/<slug>.mp3` (servidos estáticamente). Reproducción normal NUNCA llama a ElevenLabs. 4 voice profiles (irish/british/american/international) desde `ELEVENLABS_VOICE_*`.
- **Backend** (`listening_data.py` + endpoints en `server.py`): `GET /api/listening/meta`, `GET /api/listening/item/{slug}?lang=` (answer-free, localizado), `GET /api/guests/{id}/listening-practice` (5 items, ranking determinista), `POST /api/guests/{id}/listening-attempts` (scoring + reveal), `GET /api/guests/{id}/listening-summary`.
- **Ranking de Practice** (`_rank_listening_items_for_guest`): reusa `_rank_situations_for_guest` + boosts: not-yet-correct (+500), nuevo (+100), role match (+400), voice_profile↔target_country (señal suave +20). Determinista, sesión = 5, filtro profession=hospitality.
- **Persistencia**: colección `listening_attempts` (id, guest_id, profession_id='hospitality', listening_item_id, situation_slug, selected_index, correct, attempted_at, interface_language) + contadores en guest (listening_attempted_count/correct_count). NO toca review_items/SRS ni mastery/completion existentes. Cambio de idioma conserva intentos.
- **Lesson integration**: nuevo step `listening` en `Lesson.js` STEPS (después de flashcards, antes de exercises/quiz/completion) en las 50 lessons. Resultado listening independiente (no altera mastery/grading del lesson).
- **Frontend**: `components/ListeningQuestion.js` (audio-first, transcript/translation/model_response ocultos hasta responder, reveal después), `pages/ListeningPractice.js` (/listening-practice, sesión de 5 + summary), card en Home (`listening-entry-card`). UI en 10 idiomas desde `/listening/meta`.
- **Tests**: `tests/test_listening.py` 20/20 PASS (content, audio existente/HTTP/idempotente, answer-free, scoring, persistencia profession_id, cambio idioma, practice=5, role influence, regresión módulos + recommended 3-5). Suites existentes (first_week/job_interview/tonights_shift/emergency/assessment/phase2) 100/100 PASS → sin regresiones. **50/25/25 intacto. Sin deploy.**

### Fase 8 (2026-06) — Speaking MVP (WorkEnglish-compatible) (PREVIEW, SIN deploy)
- **Contenido**: `backend/data/speaking.json` (read-only) = 50 speaking items (25 bartender / 25 waiter), `profession_id="hospitality"`, 10 idiomas, 1:1 con las 50 situations activas. Cada item REUTILIZA el audio de Listening (`prompt_audio_asset_key`) y su `prompt_transcript_en`/`model_response_en` verbatim. Respuesta abierta (no multiple choice); múltiples respuestas válidas; no se exige repetir `model_response_en`.
- **Adapters aislados**: `stt_elevenlabs.py` (ElevenLabs Scribe v2 batch, backend-only, audio solo en memoria y eliminado tras transcribir) · `speaking_evaluator.py` (OpenAI `gpt-4o-mini`, Structured Outputs/strict JSON schema, backend-only, usa `OPENAI_API_KEY` del usuario — NO la Emergent key; no puntúa acento/native-likeness; `improved_response_en` ≤30 palabras).
- **Endpoints** (`speaking_data.py` + `server.py`): `GET /api/speaking/meta`, `GET /api/speaking/item/{slug}?lang=` (sin model_response), `GET /api/guests/{id}/speaking-practice` (5 items, ranking determinista), `POST /api/guests/{id}/speaking-attempts` (multipart audio → STT → eval → persistencia; raw audio NO persistido), `GET /api/guests/{id}/speaking-summary`.
- **Ranking de Practice** (`_rank_speaking_items_for_guest`): reusa `_rank_situations_for_guest` + boosts: previous needs_practice/nunca intentado (+500/+100), role match (+400). Sesión=5, filtro profession=hospitality primero.
- **Persistencia**: colección `speaking_attempts` (id, guest_id, profession_id='hospitality', speaking_item_id, situation_slug, role, transcript_en, stt_language_probability, stt_avg_logprob, 5 ratings, issue_codes, improved_response_en, overall, attempted_at, interface_language, duration_ms) + contadores en guest. `audio_persisted=false`. Retake = nuevo attempt (insert, nunca sobrescribe). NO toca review_items/SRS ni mastery/completion.
- **Frontend**: `components/SpeakingQuestion.js` (MediaRecorder, permiso mic solo al grabar, max 30s/min 1s, replay local, estados recording/processing/result, mobile-first, opcional si mic denegado), `pages/SpeakingPractice.js` (/speaking-practice), step `speaking` en `Lesson.js` (después de listening, opcional), card en Home (`speaking-entry-card`). UI en 10 idiomas desde `/speaking/meta`.
- **Tests**: `tests/test_speaking.py` 14/14 PASS (content, reuse audio/texto, meta 10 idiomas, item sin model_response, practice=5/role, guards 422, **evaluador OpenAI structured output live + improved≤30**, regresión listening 50/50 + módulos + recommended 3-5 + 25/25). Suite Listening 20/20 PASS.
- **BLOCKER real**: la ElevenLabs API key NO tiene el permiso `speech_to_text` → Scribe v2 devuelve 401 `missing_permissions`. El pipeline record→STT→eval NO puede verificarse end-to-end hasta habilitar ese scope en la key (el código es correcto; OpenAI eval verificado live). Sin deploy.

### Fase 9 (2026-06) — Accounts & Auth MVP (Firebase, WorkEnglish-compatible) (PREVIEW, SIN deploy)
- **Identity**: Firebase Authentication (anonymous + Google linking). FastAPI+Mongo = source of truth del learning data. `users.id` interno independiente de `guest_id`. Sin migración masiva: se extiende `guests` con `user_id`/`profession_id`/`auth_state` (backward-compatible). `profession_id="hospitality"` en V1. Apple feature flag OFF (APPLE_CONFIG_REQUIRED).
- **Backend** (`firebase_admin_setup.py` + `server.py`): Admin SDK init desde `FIREBASE_*` env (private key normalizada), verify_id_token, delete_user. Endpoints: `POST /api/auth/bootstrap`, `POST /api/auth/complete-link`, `GET /api/auth/me`, `DELETE /api/account`. Identidad SIEMPRE derivada del token verificado (nunca del uid del cliente). Rate limiting in-memory. Colecciones nuevas: `users` (firebase_uid UNIQUE), `account_events` (audit, sin tokens). 
- **Flows**: guest usable sin cuenta; bootstrap anónimo mapea firebase_uid→guest conservando guest_id; Google link conserva EXACTAMENTE guest_id (sin copiar progreso); existing-account sign-in resuelve canonical profile sin sobrescribir el guest temporal; cross-device resuelve firebase_uid→users→profile_ids_by_profession.hospitality→canonical guest_id; logout crea sesión anónima + guest fresco; delete borra learning data (situation_attempts, review_items, assessment_attempts, shift_sessions, job_interview_progress, first_week_progress, listening_attempts, speaking_attempts) + guest + user + Firebase user (idempotente).
- **Frontend**: `lib/firebase.js` (SDK v12, init con limpieza de comillas en env, anon/Google/link/signout/reauth/delete), `context/AppContext.js` (bootstrap no bloqueante y tolerante a fallos; signInWithGoogle/logout/deleteAccount; safety timeout), `pages/Account.js` (`/account`: guest → "Continue with Google" + Apple deshabilitado; authenticated → email/providers/Sign out/Delete con confirmación), icono de cuenta en Navbar. Mensaje no bloqueante "Your saved account progress has been loaded." en existing-account.
- **Seguridad**: Admin creds solo backend; no se loguean tokens/secrets; no se guardan OAuth access tokens; errores auth sin filtrar internals; rate limiting.
- **Tests**: `tests/test_accounts_auth.py` 9/9 PASS con tokens Firebase REALES (anonymous REST + Admin custom token): guest sin cuenta, 401 token inválido, bootstrap anónimo conserva guest_id, uid del cliente ignorado, link crea user y preserva guest_id + resuelve canonical (refresh/cross-device), existing-account no sobrescrito, deletion elimina solo datos del test user e idempotente, regresiones learning. Suites previas: listening 20/20, speaking 14/14, módulos 100/100 → **143 tests PASS, 0 regresiones**. 50/25/25 intacto. SRS/mastery intactos. Sin deploy.

### Fase 10 (2026-06) — Google Auth móvil fix: Google Identity Services (GIS) (PREVIEW, SIN deploy)
- **Problema**: Google Sign-In fallaba en Safari/iOS por usar Firebase popup (`signInWithPopup`/`linkWithPopup`); el hosting Emergent no permite reverse-proxy de `/__/auth/*`.
- **Fix**: Migrado "Continue with Google" a **Google Identity Services** (sin popup/redirect, sin `/__/auth/*`). `lib/firebase.js`: `loadGis()`/`initGis()` (carga `https://accounts.google.com/gsi/client`, `google.accounts.id.initialize` idempotente con dispatcher estable), `renderGisButton()`; el callback entrega el Google ID token (solo en memoria) → `GoogleAuthProvider.credential(idToken)` → `linkWithCredential` (anónimo, preserva uid+guest) o `signInWithCredential` (cuenta existente). `reauthWithGoogleCredential()` para recent-login en delete.
- **Account.js**: botón GIS para guest; reauth con GIS antes de borrar cuenta; callback compartido que infiere link vs reauth por estado (stateRef). Sin popup/redirect. Funciones popup legacy conservadas solo para rollback (no usadas).
- **AppContext**: `connectGoogle(idToken)` y `reauthGoogle(idToken)` (credential-based) son el path activo; `deleteAccount` sin popup; bootstrap sigue con `signInAnonymously`. Backend `/auth/*` sin cambios (verify token agnóstico de proveedor).
- **Config**: `REACT_APP_GOOGLE_CLIENT_ID` (público) en frontend/.env. `authDomain` sin cambios. Apple OFF.
- **Seguridad**: no se persisten Google ID/access tokens ni Firebase ID token (solo Bearer temporal); no logs de tokens.
- **Tests**: `tests/test_gis_frontend.py` 7/7 (GIS presente, sin popup/redirect, sin `/__/auth`, tokens no persistidos, client id OK) + `tests/test_accounts_auth.py` 9/9 (tokens Firebase reales). **testing_agent (iteration_15): 100% en ítems GIS, 0 issues, retest_needed=False** — GIS script cargado, botón GIS renderizado, sin Firebase popup/redirect, guest usable, navbar→/account. No se pudo completar OAuth real de Google en automatización (esperado). Regresiones learning intactas; 50/25/25 intacto; SRS/mastery intactos.

## Next Tasks
- (Manual) Confirmar en navegador la compra real del Test Store (monthly/annual) — el checkout web de RevenueCat no es automatizable headless.
- (RevenueCat Fase 3) Restore purchases + enforcement server-side (requiere RevenueCat webhooks/REST, hoy fuera de alcance).
- (Manual) Safari/iPhone: login y delete de Apple (popups no automatizables).

### Fase 14 (2026-06) — RevenueCat Phase 2: freemium gating + paywall + Test Store purchase (PREVIEW, SIN deploy)
- **Catálogo validado**: 50 situations activas = 25 bartender + 25 waiter; los 10 free slugs existen con rol correcto (FREE_SLUG_MISMATCH: NONE), 5 bartender + 5 waiter.
- **Config central profession-aware**: `backend/billing_access.py` y `frontend/src/lib/accessConfig.js` (free_situations por rol, `can_access_situation`/`canAccessSituation`). Extensible a otras verticales. Sin flags de dominio ni premium persistido.
- **Backend (additivo)**: `/situations` y `/lessons/{slug}` exponen `is_free`. `listening-practice`, `speaking-practice`, `review-items` aceptan `?premium=` y, si no premium, restringen el pool a las free situations del rol (no borran review_items; premium restaura). El endpoint `/lessons` NO bloquea (se revirtió un 403 que rompía Tonight's Shift); el gate del Learn flow es a nivel de ruta en el cliente.
- **Entitlement = fuente de verdad**: `billing.isPremium("hospitality")` deriva de `customerInfo.entitlements.active["hospitality_premium"]`. Nada premium en localStorage/Mongo.
- **Frontend**: `BillingContext.purchase()` (unlock inmediato, refresh 1x si entitlement inactivo, no desbloquea si sigue inactivo). `components/PremiumGate.js` = `PremiumProvider`/`usePremium` + account-gate (guest: Google+Apple+Not now, intento continúa al paywall tras login) + paywall custom ("Unlock all Hospitality English", beneficios, Annual/Monthly con precios reales de RevenueCat $39.99/$5.99, ahorro calculado si misma moneda, CTA Continue, estados idle/purchasing/error, cancel sin desbloquear). Gating en `Category.js` (tiles premium con lock → account/paywall), `Lesson.js` (ruta: locked view si `is_free===false` y !premium), `ListeningPractice`/`SpeakingPractice`/`Practice` pasan `premium` al pool. Billing loading/error → toast "Premium is temporarily unavailable". App free nunca se rompe.
- **Freemium Phase 1 (consolidación)**: añadidos helpers `requires_premium`/`requiresPremium`. El filtro de pools pasó de `premium` (default filtraba a todos) a `free_only` **opt-in** (default OFF → preserva el contrato de review-items/SRS); el cliente del usuario free envía `free_only=true`. Corregida regresión propia que rompía SRS/assessment. Test `test_onboarding` actualizado (welcoming-guests ya está autorizado). NOTA: los tests `iter7`/`v2_import` fallan de forma pre-existente (asumen catálogo antiguo de 20 situations) — ajenos al freemium; `test_phase2_recommendations` pasa aislado (los fallos en suite completa son contención de MongoDB por xdist, no código).

### Fase 13 (2026-06) — RevenueCat Phase 1: SDK + identity + entitlement read (PREVIEW, SIN deploy)
- **SDK**: `@revenuecat/purchases-js@1.70.0` (Web SDK, Test Store, PUBLIC key `test_` desde `REACT_APP_REVENUECAT_API_KEY`). API web: `configure({apiKey, appUserId})`, `getSharedInstance`, `getOfferings`, `getCustomerInfo`, `changeUser` (no existe logIn/logOut en web), `isAnonymous`, `generateRevenueCatAnonymousAppUserId`.
- **Arquitectura EnglishToWork (central, profession-aware)**: `lib/billingConfig.js` `PROFESSION_BILLING_CONFIG = { hospitality: { entitlementId:"hospitality_premium", offeringId:"hospitality_default" } }` (extensible a nursing/pharmacy/cabin_crew/sales/electricians, NO implementadas). Sin flags de dominio tipo hospitality_subscription.
- **Servicio** `lib/revenuecat.js`: init una sola vez; `configureRevenueCat(appUserId|null)` (null→anónimo `$RCAnonymousID`), `switchRevenueCatIdentity(id|null)` (id→`changeUser(users.id)`, null→nuevo anónimo). App User ID = **users.id interno** (NUNCA Firebase UID/email/guest_id).
- **Context** `context/BillingContext.js` (`BillingProvider`/`useBilling`): estados `uninitialized|loading|ready|error`; reacciona a `account?.id` (guest→account→logout) sin bloquear la app. API: `ready`, `status`, `customerInfo`, `offerings`, `isPremium(professionId)`, `getProfessionAccess(professionId)`, `currentOffering(professionId)`, `refresh()`. `isPremium` deriva SIEMPRE de `customerInfo.entitlements.active[...]`, nunca de localStorage. Montado en `App.js` dentro de `AppProvider`.
- **Verificado en navegador real (Test Store)**: status `ready`; guest anónimo `$RCAnonymousID`; offerings `['default','hospitality_default']`; `hospitality_default` con monthly=`hospitality_premium_monthly` y annual=`hospitality_premium_annual`; `isPremium("hospitality")=false`; profession-aware OK. Identidad: `logIn(users.id)`→appUserId exacto; `logout`→nuevo anónimo (harness temporal de test eliminado). Fallo de RC → `status=error`, la app y el contenido gratuito siguen usables (sin gating).
- **Sin implementar (por spec)**: paywall, purchase, restore, webhooks, REST backend, App Store/Google Play/Stripe. Backend `server.py` SIN cambios. 52 tests backend verdes, 0 regresiones de learning/auth. Sin deploy.

### Fase 12 (2026-06) — Apple delete account: reauth + token revocation (PREVIEW, SIN deploy)
- **Backend**: SIN cambios. `DELETE /api/account` ya borra learning data (todas las `LEARNING_COLLECTIONS`) del/los canonical guest(s), el `users` doc y el Firebase user (Admin), idempotente, solo datos del propio uid.
- **Frontend**: `lib/firebase.js` `reauthAndRevokeApple()`: `reauthenticateWithPopup(user, OAuthProvider("apple.com"))` (credencial Apple NUEVA, nunca sesión antigua) → `OAuthProvider.credentialFromResult(result).accessToken` → si falta token lanza `APPLE_REVOKE_TOKEN_MISSING` (aborta sin borrar) → `revokeAccessToken(auth, accessToken)` (solo en memoria, sin guardar/loguear). `context/AppContext.js` `reauthRevokeApple()`. `pages/Account.js` `handleAppleDelete()`: reauth+revoke → `deleteAccount()` (orden: Apple reauth → revoke → DELETE /api/account → learning data → mongo user/guest → firebase user → limpiar local → fresh anonymous → fresh guest). UI de borrado provider-aware: botón GIS (Google) o botón negro HIG "Confirm with Apple & delete" según `account.providers`. Cancel Apple → "Account deletion was cancelled. No data was deleted.".
- **Google**: flujo delete/reauth (GIS `reauthWithGoogleCredential`) SIN cambios.
- **Seguridad**: no se persisten/loguean Apple access/ID token, authorization code ni Firebase ID token. Firebase v12.19.0 (`revokeAccessToken` verificado como función).
- **Tests**: 18 PASS (`test_apple_auth.py` 2 + `test_accounts_auth.py` 9 incl. deletion idempotente/aislada + `test_gis_frontend.py` 7), 0 regresiones. Compila. Smoke screenshot OK. **Popup de Apple reauth/revoke NO automatizable → falta 1 prueba manual Safari/iPhone del delete end-to-end.** Sin deploy.

### Fase 11 (2026-06) — Sign in with Apple (login + guest linking) (PREVIEW, SIN deploy)
- **Contexto**: Apple provider ya configurado/habilitado en Firebase (Services ID `app.hospitalityenglish.web`, key, return URL `https://hospitalityenglish-bf82d.firebaseapp.com/__/auth/handler`). Diagnóstico previo: `auth/invalid-credential` de Google resuelto alineando `REACT_APP_GOOGLE_CLIENT_ID` (Preview) con el clientId del proveedor google.com de Firebase (debug panel/authDebug.js eliminado tras validar).
- **Backend**: SIN cambios — `providers_from_claims` ya es agnóstico de proveedor (lee `firebase.identities` → `apple.com`), y `/auth/complete-link` ya mergea providers y preserva `display_name`/`email` nullable cuando Apple no los reenvía.
- **Frontend**: `lib/firebase.js` `APPLE_ENABLED=true` + `connectAppleProvider()` (`OAuthProvider("apple.com")`, scopes email+name, `linkWithPopup` para anónimo preservando uid+guest, `signInWithPopup` para cuenta Apple existente / credential-already-in-use; sin persistir tokens Apple). `context/AppContext.js` `connectApple()` reutiliza el pipeline de `complete-link`/`me` (resuelve canonical, nunca copia/mergea learning data). `pages/Account.js`: botón HIG "Continue with Apple" (negro, logo Apple) con **consent screen obligatorio** ("Your current HospitalityEnglish progress will be linked to your Apple account and available across devices.") antes del linking; eliminado "Apple Sign In coming soon".
- **Privacy**: email/display_name nullable; no se asume reenvío de nombre/email en logins futuros; se conservan datos ya guardados.
- **Seguridad**: no se guardan/loguean Apple access/ID token, authorization code ni Firebase ID token; Team ID/Key ID/private key solo en Firebase.
- **Tests**: `tests/test_apple_auth.py` 2/2 (mapping `apple.com` vía identities + fallback sign_in_provider; pipeline compartido preserva guest_id, resuelve canonical, protege guest temporal) + `test_accounts_auth.py` 9/9 + `test_gis_frontend.py` 7/7 → **18 PASS, 0 regresiones Google**. Screenshot: botón Apple + consent + Google GIS OK. **Popup OAuth de Apple NO automatizable → falta 1 prueba manual en Safari/iPhone.** Sin deploy. Delete/revoke Apple y Apple redirect NO implementados (fuera de alcance de esta fase).


## UX/UI Implementation 2 — Home Redesign (Jun 2026) — DONE
- `pages/Home.js` rewritten: greeting (display_name) + role · Hospitality; single primary card (continue → up next/first step from existing recommendations, free-filtered for Free → fallback /learn); Review (due via review-items?due&free_only, hidden for new users) → /practice; Listening/Speaking tiles; Premium card only for Free → existing requestPremium().
- Weekly activity OMITTED (no reliable weekly metrics). Tool cards + recommended/category grids removed from Home (tools in /more).
- 31 new `home.*` keys in 10 locales. Fixed Practice.js session-complete undefined `Navbar` (now AppShell showBottomNav={false}).
- Tested: testing_agent iteration_16 (100% frontend), pytest billing/apple 7/7.
