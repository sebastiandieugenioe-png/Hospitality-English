# Privacy data inventory — Inglés para Hostelería (V1, June 2026)

Source of truth for the Privacy Policy (`frontend/src/legal/privacyPolicy.js`), Apple App Privacy and Google Play Data Safety.
Built from code audit only. Re-audit before every store submission.

## 1. Data categories

| Data | Collected | Stored (where) | Purpose | Retention | Processor(s) | Deleted on account deletion | Linked to identity |
|---|---|---|---|---|---|---|---|
| Email, display name (Google/Apple) | Only on sign-in | Mongo `users`; Firebase Auth | Account | Until deletion | Firebase/Google, Apple | Yes (Mongo + Firebase user) | Yes |
| Auth provider, internal user id, timestamps | On sign-in | Mongo `users` | Account | Until deletion | Firebase | Yes | Yes |
| Guest id + anonymous Firebase uid | Every visitor | Mongo `guests`; device localStorage `iph_guest_id`; Firebase Auth anonymous user | Save progress without account | No automatic expiry (guest without account) | Firebase | Yes for the account's guest(s); orphan anonymous Firebase users are not cleaned up | Pseudonymous; linked after sign-in |
| Interface language | Yes | Mongo `guests`; localStorage `iph_lang` | UI | Until deletion | — | Yes | Yes (if account) |
| Role, venue_type, target_country, goal, employment_status, english_level | Onboarding/preferences | Mongo `guests.professional_profile` | Personalisation | Until deletion | — | Yes | Yes (if account) |
| Lesson attempts, answers, scores | Yes | Mongo `situation_attempts` | App functionality | Until deletion | — | Yes | Yes |
| Review/SRS items | Yes | Mongo `review_items` | App functionality | Until deletion | — | Yes | Yes |
| Assessment, Tonight's Shift, Job Interview, First Week | Yes | Mongo `assessment_attempts`, `shift_sessions`, `job_interview_progress`, `first_week_progress` | App functionality | Until deletion | — | Yes | Yes |
| Listening answers | Yes | Mongo `listening_attempts` | App functionality | Until deletion | — | Yes | Yes |
| Speaking raw audio | Yes (per attempt) | NOT stored (in memory only, `del audio_bytes` after STT) | Transcription | Discarded after transcription | ElevenLabs (STT) | n/a | Sent without name/email |
| Speaking transcript + evaluation + duration | Yes | Mongo `speaking_attempts` | Feedback | Until deletion | OpenAI (transcript + item prompt, no identifiers) | Yes | Yes |
| Subscription/entitlement | On purchase / check | RevenueCat (App User ID = `users.id`; anonymous RC id for guests in localStorage `rc_anonymous_app_user_id`) | Payments / Premium | RevenueCat policy | RevenueCat (+ stores later) | **No** (RevenueCat customer not deleted) | Yes |
| Payment card details | Not by us | RevenueCat checkout / stores | Payments | — | RevenueCat / Apple / Google | — | — |
| Feedback (category, message, app_version, route) | When sent | Mongo `feedback` | Support / improvement | Until deletion | — | Yes (by guest_id) | Yes |
| Account events (sign_in/link; user_id, firebase_uid, provider, guest_id, profession, time, metadata) | Yes | Mongo `account_events` (write-only log) | Account lifecycle log | Until account deletion | — | Yes (by firebase_uid/user_id/guest_ids; no post-deletion record) | Yes (internal ids, firebase uid) |
| Usage events + session replay | **Production: No.** PostHog `init` in `public/index.html` runs only on `*.preview.emergentagent.com` (internal preview) | — | — | — | — | — | — |
| IP address / user agent | Implicit | Hosting/CDN logs (Emergent, Cloudflare), Google Fonts | Delivery | Unknown | Emergent, Cloudflare, Google | No | No |

## 2. Processors (verified in code/config)

- **Firebase / Google**: Auth (anonymous, Google), Admin SDK verify/delete; Google Identity Services; Google Fonts (IP).
- **Apple**: Sign in with Apple; token revocation on deletion (`reauthRevokeApple`).
- **RevenueCat**: Web SDK (public key) + server REST v1 (secret key) for entitlement checks.
- **ElevenLabs**: STT (raw Speaking audio). TTS only for pre-generated Listening content (no user data).
- **OpenAI**: Speaking evaluation (`gpt-4o-mini`, transcript text).
- **Emergent**: hosting (frontend, FastAPI, MongoDB), `emergent-main.js` (platform script, no analytics found). PostHog (app template code) is gated to preview hosts only.
- **Cloudflare**: edge (cookies `cf_clearance`, `__cf_bm`), set by hosting.

No advertising SDKs, no cross-app tracking, no Meta/TikTok/Google Analytics.

## 3. Apple App Privacy (draft answers supported by code)

- Contact Info → Email Address, Name: collected, linked, App Functionality.
- User Content → Audio Data: collected (processed, not stored by us), App Functionality. Other User Content (transcripts, feedback): linked, App Functionality.
- Identifiers → User ID: linked, App Functionality.
- Purchases → Purchase History: linked, App Functionality.
- Usage Data → Product Interaction: collected (learning progress: linked, App Functionality). No analytics in production.
- Tracking: **No** (no cross-app tracking / data brokers).

## 4. Google Play Data Safety (draft)

- Personal info: Email, Name — collected, App functionality / Account management, not shared (processors only).
- Audio: Voice recordings — collected, processed ephemerally (not stored by us), App functionality.
- Messages/other user content: feedback, transcripts — collected, App functionality.
- App activity: in-app interactions/learning progress — collected, App functionality, Personalisation. No analytics.
- Financial info: purchase history — collected via RevenueCat/Play, App functionality.
- Device or other IDs: internal/guest IDs — collected, App functionality.
- Encrypted in transit: HTTPS endpoints used (OWNER_ACTION_REQUIRED: confirm for all hosting).
- Deletion: in-app + web resource `/account-deletion`.

## 5. Consent

- Essential local storage: guest id, language, onboarding draft, RevenueCat anon id, scroll position.
- PostHog (non-essential) no longer initialises in production (hostname gate), so no consent banner is needed in production. Re-check after each Emergent template update and on the live domain (no `ph_phc_*` cookie, no requests to `ap.emergent.sh`).

## 6. Owner actions

1. Operator legal name, address, privacy/support email (Privacy §1, §11; Terms intro, §11; `/account-deletion` Option 3).
2. Effective dates of Privacy and Terms.
3. Minimum age (Privacy §12).
4. (Resolved) `account_events` are deleted with the account.
5. (Resolved) PostHog gated to preview hosts; verify on the live domain after deploy.
6. Confirm international transfer safeguards with processors (Privacy §8).
7. Governing law (Terms §11).
8. Consider deleting the RevenueCat customer on account deletion (currently not done; disclosed).
9. Legal review recommended; localized legal copies recommended post-launch (English canonical in V1).
