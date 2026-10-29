# Capacitor mobile shell — Hospitality English

- Capacitor 7.6.9 (`@capacitor/core`, `ios`, `android`; `@capacitor/cli` dev). Capacitor 8 needs Node ≥22; this env runs Node 20.
- App name: Hospitality English · App ID: `app.englishtowork.hospitality`
- Config: `frontend/capacitor.config.json` · `webDir: build` (CRA/craco output). Bundled assets, no `server.url`.
- Platforms: `frontend/ios/` (Xcode project `ios/App/App.xcodeproj`; workspace created by `pod install` on macOS), `frontend/android/` (Gradle).
- Platform helper: `frontend/src/lib/platform.js` (`isNative`, `getPlatform`, `isIOS`, `isAndroid`). Used by auth (not billing yet).
- Permissions: iOS `NSMicrophoneUsageDescription`; Android `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` (+ `INTERNET`). ATS default (no arbitrary loads); Android cleartext not enabled (Capacitor serves `https://localhost`).

## Commands (from `frontend/`)
```
REACT_APP_BACKEND_URL=<production API origin> yarn build   # bundle bakes the API URL from env
npx cap sync                                               # copy build + update native deps
npx cap open ios | npx cap open android                    # macOS/Xcode, Android Studio
```

## Native auth (MOBILE_NATIVE_AUTH_V1)
- Plugin `@capacitor-firebase/authentication@7.5.0` (last 7.x; peer `firebase ^11` warning — native path never loads the plugin's web/Firebase code).
- `skipNativeAuth: true` + providers `google.com`, `apple.com`. Plugin returns only OAuth credentials; the session lives ONLY in Firebase JS (`signInWithCredential` / `linkWithCredential` / `reauthenticateWithCredential`). Native: `initializeAuth(indexedDBLocalPersistence)`.
- `src/lib/nativeAuth.js` (Google idToken, Apple idToken + raw nonce + fresh authorizationCode, sign-out, Apple revoke via `identitytoolkit v2/accounts:revokeToken` tokenType `CODE`). Web flows unchanged (GIS + Apple popup).
- Android native: Apple hidden (`APPLE_ENABLED`). Known V1 limit: an Apple-only account cannot reauth/delete from the Android app (use web/iOS).
- iOS: deployment target 15.0 (project + Podfile), `App/App.entitlements` (Sign in with Apple), Podfile `CapacitorFirebaseAuthentication/Google`. Android: `rgcfaIncludeGoogle = true`.

### OWNER_ACTION_REQUIRED
1. Firebase Console → Project settings → Add app **iOS**, Bundle ID `app.englishtowork.hospitality` → download `GoogleService-Info.plist` → place at `frontend/ios/App/App/GoogleService-Info.plist` and add it to the App target in Xcode.
2. Firebase Console → Add app **Android**, package `app.englishtowork.hospitality`, add SHA-1 + SHA-256 of debug/upload keystore AND Play App Signing key → download `google-services.json` → `frontend/android/app/google-services.json`.
3. Xcode → App target → Info → URL Types → add URL scheme = `REVERSED_CLIENT_ID` from the plist.
4. Apple Developer → Identifiers → `app.englishtowork.hospitality` → enable Sign in with Apple; select Team in Xcode Signing (automatic). Firebase accepts native Apple tokens (aud = bundle ID) once the iOS app from step 1 is registered; the web Services ID/Team ID/Key config stays as is.
5. Firebase Auth → Sign-in method: Google + Apple enabled (already for web). Google Cloud: the iOS/Android OAuth clients are auto-created by Firebase when adding the apps.
6. macOS: `cd frontend/ios/App && pod install`.

## Native billing (NATIVE_BILLING_V1)
- `@revenuecat/purchases-capacitor@11.3.3` (last line for Capacitor 7; 12+ needs Capacitor 8). Dynamically imported only on native.
- `src/lib/revenuecat.js` dispatches web (purchases-js) vs native (`src/lib/revenuecatNative.js`). BillingContext/paywall/entitlement logic is shared; native packages are normalised to the same price shape; native error codes normalised to the purchases-js numbering.
- Identity: configure with `users.id` (anonymous only when no account), `logIn(users.id)` on sign-in, `logOut()` on sign-out. Purchase/restore refused until RevenueCat is synced to the current identity (`resolvedFor`).
- Account-first: guests sign in before Subscribe or Restore; the requested action resumes automatically.
- Restore purchases (native only): paywall secondary action + Subscription page. Web keeps "Refresh subscription status".
- Android: `com.android.vending.BILLING` permission; launchMode `singleTop` (RevenueCat requirement).

### OWNER_ACTION_REQUIRED (billing)
1. RevenueCat: add iOS app (bundle `app.englishtowork.hospitality`) and Android app (package `app.englishtowork.hospitality`); attach store products to entitlement `hospitality_premium` and offering `hospitality_default` (monthly + annual packages, existing prices).
2. App Store Connect / Play Console: create the subscription products; Play needs a closed-testing track + license testers; iOS a Sandbox tester.
3. Frontend build env: `REACT_APP_REVENUECAT_IOS_API_KEY` (`appl_…`) and `REACT_APP_REVENUECAT_ANDROID_API_KEY` (`goog_…`) public SDK keys. Missing key = native app stays Free with the calm "Premium unavailable" message.
4. Xcode: add the In-App Purchase capability; `pod install`.

## Pending
- App icons/splash, signing, CI builds (IPA/AAB), store listings.
- `public/` also ships dev exports (`mvp_i18n_*.json`, `voice_test/`) into the bundle; consider excluding before release.
