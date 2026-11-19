# Publicar en App Store y Google Play sin Mac

Las apps se compilan en la nube con **Codemagic** (`codemagic.yaml` en la raíz del repo).
Cuenta personal: 500 minutos gratis al mes.

## Una sola vez

### Apple (App Store Connect)
1. Crear la app con el Bundle ID `app.englishtowork.hospitality`.
2. Crear un grupo de suscripción con un producto mensual y uno anual (+ prueba gratis de 1 semana).
3. Users and Access → Integrations → App Store Connect API → generar una clave con rol **App Manager**. Descargar el `.p8` (solo se puede una vez) y anotar Issuer ID y Key ID.

### Google Play Console
1. Crear la app (package `app.englishtowork.hospitality`).
2. Crear las suscripciones mensual y anual (+ oferta de prueba de 7 días).
3. Crear una cuenta de servicio de Google Cloud con acceso a la Play Console y descargar su JSON.

### Firebase
1. Añadir una app iOS y una Android con el ID `app.englishtowork.hospitality`.
2. Descargar `GoogleService-Info.plist` y `google-services.json` y dárselos a Claude (no son secretos; se guardan en el repo).
3. Android: añadir las huellas SHA-1 y SHA-256 (las da Play Console → App integrity, y el keystore de Codemagic).

### RevenueCat
1. Añadir las apps iOS y Android, vincular los productos al entitlement `hospitality_premium` y ponerlos en la offering `hospitality_default` (paquetes Monthly y Annual).
2. Copiar las claves públicas `appl_…` y `goog_…`.

### Codemagic
1. Crear cuenta **personal** y conectar GitHub → repo Hospitality-English.
2. Integrations → App Store Connect: añadir la clave `.p8` con el nombre **Hospitality English**.
3. Code signing → Android: generar o subir un keystore con el nombre **hospitality_upload_key**.
4. Environment variables → grupo **hospitality_app** con las variables que lista `codemagic.yaml`.

## Cada versión nueva
- Codemagic → Start new build → `ios-testflight` (sube a TestFlight) y `android-internal` (sube a Google Play, pista interna).
