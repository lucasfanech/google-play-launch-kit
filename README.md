# Google Play Launch Kit

A Claude Code plugin that takes an Expo / React Native app from "it runs on my emulator" to
"testers install it from Google Play" and then production - store visuals, multilingual listing,
Play Console forms, AdMob, signed releases - including the browser techniques that make Google
consoles automatable.

Born from shipping a real game end to end; every pitfall it hit is written down in the skills.

## Install

```
/plugin marketplace add lucasfanech/google-play-launch-kit
/plugin install google-play-launch-kit@lucasfanech
```

Or from a terminal: `claude plugin marketplace add lucasfanech/google-play-launch-kit` then
`claude plugin install google-play-launch-kit@lucasfanech`.

## Skills

| Skill | What it does |
|---|---|
| `google-play-launch` | The end-to-end playbook: pre-flight checks (final package name, asset licences, third-party IP, account type), then every step in order, plus a troubleshooting map |
| `google-console-browser` | Driving Play Console / AdMob / Google Sites: which browser (uploads need Claude in Chrome), which Google account (`?authuser=`), shadow-DOM helpers, native value setter, one-by-one asset uploads, save verification, consent rules |
| `play-console-app-setup` | Create the app and fill every declaration: app access, ads, advertising ID, target audience, IARC content rating, data safety (SDK mapping), category, contact, testers, send for review |
| `store-screenshots` | Showcase-state captures on the Android emulator (all languages, phone + tablet, demo status bar) and config-driven marketing mockups, feature graphic and icon |
| `store-listing-i18n` | Multilingual title / short / full description following Play metadata rules, a validator script, and per-language entry of texts and localized graphics |
| `android-play-release` | Upload key + signing plugin, version bump, release branch, patch notes in every language, signed AAB, R8 release smoke test, tag + PR, track release |
| `admob-integration` | Compliant AdMob: UMP consent before init, test ads in dev, rewarded + capped interstitials, GDPR message, privacy policy (template + Google Sites), store linking |
| `expo-android-emulator` | Dev builds on the macOS emulator: JDK/NDK, Metro port conflicts, "Unable to load script", storage full, per-app locale |

## Scripts

- `skills/store-screenshots/scripts/android-capture.sh` - capture toolkit (demo mode, per-app locale,
  text taps, bursts, tablet canvas)
- `skills/store-screenshots/scripts/render-mockups.mjs` - mockups from `store/mockups.config.json`
  (example in `references/`)
- `skills/store-listing-i18n/scripts/check-listing.mjs` - listing limits and policy checks
- `skills/android-play-release/scripts/release.mjs` - `init | status | bump | notes-check | keystore | build | smoke`
- `skills/android-play-release/templates/with-release-signing.js` - Expo config plugin for release signing
- `skills/admob-integration/templates/` - ads module and privacy policy (FR/EN) templates

## Requirements

macOS with Android Studio (JBR, SDK, an emulator), Node 20+, Google Chrome, an Expo (CNG) project.
Console automation needs the Claude in Chrome extension for file uploads. The skills always ask
before legal declarations, sending for review or publishing.

## License

MIT
