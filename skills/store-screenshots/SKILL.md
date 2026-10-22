---
name: store-screenshots
description: Capture app screenshots on the Android emulator (phone and tablet, every language, clean status bar, a showcase save state) and turn them into store-ready marketing visuals - captioned screenshots in device frames, 1024x500 feature graphic, 512 px icon - with a reusable config-driven renderer. Use for "fais des captures de l'app", "prépare les images du store", "mockups pour la fiche Play Store", "store screenshots", "feature graphic", "visuels Google Play".
---

# Store screenshots and mockups

Two phases: **capture** raw screens from the real app, then **render** marketing visuals.
Uploading them to the Play Console is `store-listing-i18n`.

Play Console specs (Oct 2026): phone 2-8 screenshots, JPEG or 24-bit PNG, 9:16 or 16:9, each side
320-3840 px (>= 1080 px to be eligible for promotion, 4+ screenshots recommended); 7" and 10" tablet
up to 8 each (10": sides 1080-7680 px); feature graphic 1024x500 JPEG/24-bit PNG; icon 512x512 PNG
<= 1 MB. Same canvases work for every language; localize captions per language.

## Phase 1 - Capture

Toolkit: `scripts/android-capture.sh` (source it; functions documented at the top).

1. **Showcase state.** A fresh install looks empty. Inject a demo save behind a temporary dev-only
   switch and revert it afterwards - never commit it:
   - find where the app loads its save (e.g. `storage.getString(KEY)` in a store module);
   - temporarily replace it with `JSON.stringify(require('./demo-save.json'))`, plus
     `require('react-native').LogBox.ignoreAllLogs()` so dev warnings do not cover the UI;
   - build the demo save from the real state type: mid-game progress, unlocked content, a few
     items left locked (mystery sells), counters that look earned, audio muted;
   - keep a backup of the file you patch and restore it at the end (`git status` must be clean).
2. **Device state.** `cap_demo_on` (clock 09:41, full battery). The debug build talks to Metro; see
   `expo-android-emulator` if the app shows "Unable to load script".
3. **Plan script per project** (`scratchpad/capture.sh`): for each locale `cap_launch fr-FR 25`, then
   navigate with `cap_tap_text "<label>"` (labels differ per language: pass them as arguments) or
   `cap_tap_pct x y`, and `cap_shot`. Typical set of 5: core loop (action), collection, shop/upgrade,
   reward moment (open a chest / level up), progression (trophies, stats).
   - Action shots: `cap_spam_taps` in the background, then `cap_burst` and keep the best frame.
   - Toasts/popups covering the top: wait longer before that shot, or capture it before timed
     events fire.
   - Order matters: capture fragile/timed states first.
4. **Tablet.** `cap_tablet_on` (1600x2560 @320 dpi on the phone emulator), rerun the plan into
   `store/raw/tablet/<lang>/`, `cap_tablet_off`. The renderer crops the taskbar (`crop`).
5. **Review** every capture before rendering: build a contact sheet (HTML grid of the JPEGs served
   by `python3 -m http.server`) and look at it; redo shots with toasts, blur or wrong language.
6. **Store raw captures** as JPEG q90 (`cap_jpeg`) in `store/raw/<phone|tablet>/<lang>/<n>-<key>.jpg`.
7. `cap_reset`, restore the patched save loader, uninstall nothing of the user's.

## Phase 2 - Render

`node ~/.claude/skills/store-screenshots/scripts/render-mockups.mjs store/mockups.config.json`
(optional filter: `phone-fr`, `tablet-en`, `feature-it`). Start from
`references/mockups.config.example.json`:
- `theme` from the app's own palette (theme file / icon background), `fonts` from the app's bundled
  fonts (`node_modules/@expo-google-fonts/...` or `assets/fonts`), so visuals match the game.
- `copy[lang][screen] = [line1, line2 (accent colour), subtitle pill]`; `copy[lang].feature =
  [tagline line 1, line 2]`. Short punchy lines (2-3 words each), sentence-case subtitle, real
  numbers from the game ("25 trophies", "10 characters").
- `hero`: transparent PNG characters/objects (e.g. collection thumbnails) popping out of the frame;
  pick ones NOT already visible in that screenshot; alternate `side`.
- `burst`: a comic burst word for the action shot.

Then check the output visually (contact sheet again) for: text overflow on long languages (the
renderer shrinks lines longer than 11 chars), heroes covering important UI, burst over the HUD,
feature-graphic art clipping. Iterate on the config, not on the script.

Commit `store/raw`, `store/play`, and the config (they are the source for every future upload).

## Report

Counts per language/device, where the files are, anything worth re-shooting.
