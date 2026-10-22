---
name: android-play-release
description: Ship an Expo/React Native Android app to Google Play - upload key and release signing, version bump, one release branch per release, player-facing patch notes in every store language, signed AAB, R8 release smoke test on the emulator, tag + PR, then the Play Console release on a track (internal, closed, production) with notes. Also covers first-release pitfalls (testers can't see the app, crash at launch only in release). Use for "fais une release", "nouvelle version", "publie sur Google Play", "prépare l'AAB", "release v1.2", "ship to Play", "/release" in a project without its own release skill.
argument-hint: "[patch|minor|major|x.y.z|none] [internal|closed|production]"
---

# Android release to Google Play (Expo)

Helper: `node ~/.claude/skills/android-play-release/scripts/release.mjs <cmd>` from the project
root (commands documented at the top of the script). Console steps use `google-console-browser`.
Commit and push at each step if the project works that way.

## 0. One-time project setup

1. `release.mjs init` -> edit `release.config.json` (`languages` = store listing locales,
   `certName` = publisher name used in the upload certificate). Commit it.
2. Signing: copy `templates/with-release-signing.js` to `plugins/`, set `PREFIX` to
   `signingPrefix`, add `"./plugins/with-release-signing"` to `app.json` plugins.
3. `release.mjs keystore` creates the upload key outside the repo and its Gradle properties. Tell
   the user to back up `~/.android-keys/<slug>-upload.jks` and the block in
   `~/.gradle/gradle.properties`. Never print, copy or commit the passwords. (Play App Signing holds
   the real app key; a lost upload key can be reset through Play support.)
4. `app.json`: `android.versionCode` set; `web.output` must not be `"server"` for a native-only app
   (the release bundle then also builds a web server manifest and fails on native-only imports).
5. `.gitignore`: `dist/`, `*.jks`, `/android` (CNG).

## 1. Preconditions

`release.mjs status`: clean tree on the main branch (else ask). Typecheck and tests pass
(`npx tsc --noEmit`, `npx jest`, or the project's commands). Upload key configured.

## 2. Version and branch

- First release ever: `bump none` (keeps 1.0.0, versionCode 1). Otherwise `bump patch|minor|major`
  (also increments versionCode - Play rejects an AAB whose versionCode was already uploaded).
- `git switch -c release/v<version>` - always one branch per release.

## 3. Patch notes

From the commits since the last tag (read diffs when subjects are vague), write
`store/release-notes/v<version>.txt` in the exact Play format, one block per language:

```
<fr-FR>
• ...
</fr-FR>
<en-US>
• ...
</en-US>
```

For players, not developers: visible changes only (content, balance, fixes they can notice), short
"• " lines, <= 500 chars per language, same content everywhere, natural phrasing per language,
proper nouns untranslated. First release of an app (or of a new package): a short welcome text
presenting the game. Check with `release.mjs notes-check <file>`; prepend the English notes to
`CHANGELOG.md` under `## v<version> - <date>`. Commit "Release v<version>", push the branch.

## 4. Build and smoke test

- `release.mjs build` (long - run in background): prebuild, `bundleRelease`, verifies the upload
  certificate, copies `dist/releases/<slug>-v<version>-<code>.aab`.
- `release.mjs smoke` with the emulator running: builds the **release APK with R8**, installs,
  launches, checks the crash buffer. Then tap through every screen and recheck
  `adb logcat -d -b crash`. Debug builds never run R8, so this is the only place R8 breakage shows.
  - If it crashes with obfuscated frames (`r8-map-id-...`), read
    `android/app/build/outputs/mapping/release/usage.txt` (members R8 removed) and `mapping.txt`, and
    add keep rules through `expo-build-properties` -> `android.extraProguardRules` in `app.json`.
    Known one: Room/WorkManager (pulled in by Google Mobile Ads) needs
    `-keep class * extends androidx.room.RoomDatabase { <init>(); }`.
- Tag and push: `git tag v<version> && git push origin release/v<version> --tags`; open a PR to the
  main branch. Merge it only when the user says so.

## 5. Play Console release

Track URL: `/app/<appId>/tracks/internal-testing` (or `closed-testing`, `production`).
1. "Créer une version" -> wait for the form.
2. Upload the AAB: > 10 MB, so reveal it in Finder (`mcp__ccd_host__reveal_path`) and ask the user
   to drop it on "Déposez ici les app bundles"; wait for their confirmation, then check the page
   shows the file and `<versionCode> (<version>)`.
3. Release name `v<version>` and the notes file content as is in the notes textarea (`__set` on the
   visible input and textarea); check "Notes de version disponibles pour N langues sur N".
4. "Suivant" -> read errors/warnings and fix them (missing declarations -> `play-console-app-setup`).
5. "Enregistrer et publier" + confirm dialog **only with the user's go-ahead** for this release
   (an explicit "publie" in their request counts).
6. New app: from Publishing overview, the pending changes must be sent for review once (ask), or
   testers get "app not found". Give testers the link (`__captureCopy()` + "Copier le lien" on the
   Testers tab) and remind them the Play Store app must be signed in with the tester account.

Notes:
- Personal accounts created after Nov 2023: production requires a 14-day closed test with 12+
  testers first. Organization accounts don't.
- Production: suggest a staged rollout (e.g. 20 %) for updates.

## 6. Report

Version/versionCode, branch, tag, PR, AAB path, the notes, track and state, what is left (review,
rollout %, merging the PR).
