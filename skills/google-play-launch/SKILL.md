---
name: google-play-launch
description: End-to-end playbook to take a mobile app (Expo/React Native) from "it runs" to "testers install it from Google Play" and then production - pre-flight checks (package name, licences, IP), store visuals, multilingual listing, Play Console app and forms, AdMob, signed release, testers, review, production rollout. Use when the user wants to publish an app on Google Play / "mettre l'app sur le Play Store" / "lancer l'app" without naming a single step, or asks for the whole method.
---

# Launching an app on Google Play - the playbook

Each step has its own skill; this one orders them and holds the cross-cutting checks.
Keep a task list with these steps and commit at each one.

## 0. Pre-flight (do before anything public - these are hard to undo)

- **Package name is permanent** on Play. Pick the final one now (e.g. `io.<brand>.app`, a domain
  you own reversed) - changing it later means a brand-new Play app, redone listing and forms, and
  an orphan old app that cannot be deleted.
- **Licences of every asset**: 3D models, sounds, music, fonts. CC BY-NC (non-commercial) assets
  cannot ship in an app with ads or purchases; CC BY needs credits in the app. List them in an
  in-app credits screen.
- **Third-party IP**: characters or logos owned by others (memes with a known owner, anime
  symbols, brands) risk rejection/removal under Play's IP policy. Tell the user plainly; let them
  decide.
- **Developer account**: organization vs personal (personal accounts created after Nov 2023 need a
  12-tester / 14-day closed test before production). Find which Google account owns it.
- Privacy policy URL, public contact email, publisher name (never a home address).
- Target age (13+ keeps out of the Families policy).

## 1. Build quality

- App works on a release build, not only debug: `android-play-release` -> `release.mjs smoke`.
- Default language follows the device (fall back to English), all UI strings translated.

## 2. Monetization (if any) - `admob-integration`

AdMob app + units, consent message, privacy policy published, ads module wired, pacing agreed.

## 3. Store visuals - `store-screenshots`

Showcase save -> captures per language (phone + tablet) -> config-driven mockups, feature graphic,
512 icon. Commit `store/`.

## 4. Store listing - `store-listing-i18n`

`store/listing.json` in every UI language, validated.

## 5. Play Console - `play-console-app-setup` (+ `google-console-browser`)

Create the app with the final package -> all app-content declarations -> store settings ->
listing texts and graphics per language (`store-listing-i18n` section 2) -> testers.

## 6. First release - `android-play-release`

Upload key + signing plugin (once) -> version, branch, notes -> signed AAB -> smoke test -> tag,
PR -> internal testing release (user drops the AAB) -> **send all changes for review** from the
Publishing overview (new apps stay invisible to testers until then) -> tester link.

## 7. Production

After review passes and testers are happy (and the 14-day closed test if the account requires
it): promote or create a production release with a staged rollout, then link the app in AdMob
(only possible once public) and publish `app-ads.txt`.

## Troubleshooting quick map

| Symptom | Cause / fix |
|---|---|
| Testers: "app not found" / not in Play Store | changes never sent for review on a new app; Play Store signed in with another account; tester used another app's link |
| Crash at launch only from Play | R8 in release builds - read the crash's `r8-map-id`, `usage.txt`; keep rule via `extraProguardRules`; smoke-test release |
| AdMob can't find the app | app not public yet - link after production launch |
| Release bundle fails on native-only imports | `app.json` `web.output: "server"` - use `"single"` (or `static`) |
| Play rejects the AAB versionCode | bump again; every upload needs a higher versionCode |
| Upload button does nothing in the in-app browser | use Claude in Chrome for files; ask the user to drag files > 10 MB |
