---
name: expo-android-emulator
description: Build and run an Expo / React Native dev build on the local Android emulator on macOS and fix the usual blockers - JDK/NDK problems, Metro port conflicts, "Unable to load script", adb reverse, debug host, emulator storage full, signature mismatch after prebuild, per-app locale, reloading. Use for "lance l'émulateur", "relance mon émulateur", "l'app ne se lance pas sur Android", "run on Android", "Unable to load script", "INSTALL_FAILED_INSUFFICIENT_STORAGE".
---

# Expo dev build on the Android emulator (macOS)

## Environment

- `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (Android Studio's JBR,
  JDK 17/21). Other JDKs (e.g. 23-valhalla) break Gradle/AGP.
- `ANDROID_HOME=~/Library/Android/sdk`; tools: `$ANDROID_HOME/platform-tools/adb`,
  `$ANDROID_HOME/emulator/emulator -list-avds`.
- Start: `emulator -avd <name> -no-snapshot-save -no-boot-anim` (background), then
  `adb wait-for-device` and loop until `adb shell getprop sys.boot_completed` is `1`.
- Corrupted NDK ("NDK did not have a source.properties"): move the folder aside
  (`ndk/<ver>.broken-backup`) and let Gradle reinstall it.

## Build and install

- `npx expo prebuild --platform android` (CNG: never edit `android/` by hand; config goes in
  `app.json` / config plugins). Prebuild may regenerate `debug.keystore` -> next install fails with
  a signature mismatch: uninstall the app first (warn: it deletes the emulator's local save).
- Fast local build: `cd android && ./gradlew installDebug -PreactNativeArchitectures=arm64-v8a`
  (one ABI = several times faster than all four).
- Native module added (expo-localization, ads, filament...) -> rebuild; JS-only changes -> reload.

## Metro

- If port 8081 is taken (an SSH tunnel, another project): `npx expo start --port 8088` and
  `adb reverse tcp:8081 tcp:8088`.
- The emulator defaults to `10.0.2.2:8081` (the host's 8081 = the other process). Point the app at
  the reversed port by writing the debug host pref:
  ```
  printf '<?xml version="1.0" encoding="utf-8" standalone="yes" ?>\n<map>\n<string name="debug_http_host">localhost:8081</string>\n</map>\n' > /tmp/prefs.xml
  adb push /tmp/prefs.xml /data/local/tmp/prefs.xml
  adb shell "run-as <pkg> mkdir -p shared_prefs && run-as <pkg> cp /data/local/tmp/prefs.xml shared_prefs/<pkg>_preferences.xml"
  ```
  then force-stop and relaunch. Reinstalls wipe it.
- Reload: `adb shell input keyevent 46` twice (R R) or `adb shell input text rr`.
- Clear cache when bundling acts weird: restart with `--clear`.

## Storage full (INSTALL_FAILED_INSUFFICIENT_STORAGE)

Android refuses installs under ~500 MB free. `adb shell df -h /data`; `adb shell pm trim-caches 4G`;
remove `/data/local/tmp/*`; uninstall only the project's own old builds (never the user's other
apps without asking).

## Useful

- Per-app language (Android 13+): `adb shell cmd locale set-app-locales <pkg> --locales fr-FR`
  (`""` to reset). The activity is recreated; 3D/GL views re-initialize.
- Crash logs: `adb logcat -d -b crash`; JS logs: `adb logcat -d | grep ReactNativeJS`.
- Screenshot: `adb exec-out screencap -p > shot.png`; taps: `adb shell input tap x y` (pixels).
- UI tree for text-based taps: `adb shell uiautomator dump /data/local/tmp/ui.xml`.
- Release-only problems (R8): see `android-play-release` (`release.mjs smoke`).
