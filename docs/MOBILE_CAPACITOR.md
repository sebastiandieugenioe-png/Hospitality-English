# Capacitor mobile shell — Hospitality English

- Capacitor 7.6.9 (`@capacitor/core`, `ios`, `android`; `@capacitor/cli` dev). Capacitor 8 needs Node ≥22; this env runs Node 20.
- App name: Hospitality English · App ID: `app.englishtowork.hospitality`
- Config: `frontend/capacitor.config.json` · `webDir: build` (CRA/craco output). Bundled assets, no `server.url`.
- Platforms: `frontend/ios/` (Xcode project `ios/App/App.xcodeproj`; workspace created by `pod install` on macOS), `frontend/android/` (Gradle).
- Platform helper: `frontend/src/lib/platform.js` (`isNative`, `getPlatform`, `isIOS`, `isAndroid`). Not used by auth/billing yet.
- Permissions: iOS `NSMicrophoneUsageDescription`; Android `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS` (+ `INTERNET`). ATS default (no arbitrary loads); Android cleartext not enabled (Capacitor serves `https://localhost`).

## Commands (from `frontend/`)
```
REACT_APP_BACKEND_URL=<production API origin> yarn build   # bundle bakes the API URL from env
npx cap sync                                               # copy build + update native deps
npx cap open ios | npx cap open android                    # macOS/Xcode, Android Studio
```

## Pending
- Native Google / Apple sign-in (web popups and GIS don't work in WebViews).
- RevenueCat Capacitor SDK + App Store / Play products (`logIn(users.id)`, entitlement `hospitality_premium`).
- iOS deployment target is 14.0; MediaRecorder needs iOS 14.5+ → raise to ≥14.5 (recommend 15.0) before release.
- App icons/splash, signing, CI builds (IPA/AAB), store listings.
- `public/` also ships dev exports (`mvp_i18n_*.json`, `voice_test/`) into the bundle; consider excluding before release.
