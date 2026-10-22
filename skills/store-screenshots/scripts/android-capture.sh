#!/bin/bash
# Android emulator capture toolkit for store screenshots. Source it from a per-project plan:
#
#   source ~/.claude/skills/store-screenshots/scripts/android-capture.sh
#   PKG=com.example.app
#   cap_demo_on                          # clean status bar (9:41, full battery, no notifications)
#   for L in fr-FR en-US; do
#     D=store/raw/phone/${L%%-*}; mkdir -p "$D"
#     cap_launch "$L" 25                 # per-app locale + cold start + wait
#     cap_shot "$D/1-home.png"
#     cap_tap_text "Settings"; sleep 2; cap_shot "$D/2-settings.png"
#   done
#   cap_tablet_on; ...same loop into store/raw/tablet/...; cap_tablet_off
#   cap_reset                            # locale, demo mode, screen size back to normal
#
# Coordinates are given in percent of the screen so the same plan works on phone and tablet.

ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
: "${PKG:?set PKG=<applicationId> before using the capture helpers}"

cap_size() { "$ADB" shell wm size | tail -1 | grep -oE '[0-9]+x[0-9]+'; }
cap_w() { local s; s=$(cap_size); echo "${s%x*}"; }
cap_h() { local s; s=$(cap_size); echo "${s#*x}"; }

# demo mode: fixed clock, full battery, wifi, no notification icons
cap_demo_on() {
  "$ADB" shell settings put global sysui_demo_allowed 1
  for c in "enter" "clock -e hhmm 0941" "battery -e level 100 -e plugged false" \
           "network -e wifi show -e level 4 -e mobile hide" "notifications -e visible false"; do
    # shellcheck disable=SC2086
    "$ADB" shell am broadcast -a com.android.systemui.demo -e command $c >/dev/null
  done
}
cap_demo_off() { "$ADB" shell am broadcast -a com.android.systemui.demo -e command exit >/dev/null; }

# per-app language (Android 13+), then cold start; $2 = seconds to wait for the first frame
cap_launch() {
  "$ADB" shell cmd locale set-app-locales "$PKG" --locales "$1"
  "$ADB" shell am force-stop "$PKG"
  "$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
  sleep "${2:-20}"
}

cap_shot() { mkdir -p "$(dirname "$1")"; "$ADB" exec-out screencap -p > "$1"; }

# n screenshots back to back (pick the frame with the best effects/animation)
cap_burst() { local base=$1 n=${2:-6}; for i in $(seq 1 "$n"); do cap_shot "${base}-$i.png"; done; }

# tap at x%,y% of the screen
cap_tap_pct() { "$ADB" shell input tap $(( $(cap_w) * $1 / 100 )) $(( $(cap_h) * $2 / 100 )); }

# tap the n-th (default 1st) element whose text is exactly $1, found with uiautomator
cap_tap_text() {
  "$ADB" shell uiautomator dump /data/local/tmp/ui.xml >/dev/null
  local b; b=$("$ADB" shell cat /data/local/tmp/ui.xml | grep -oE "text=\"$1\"[^>]*bounds=\"[^\"]*\"" | sed -n "${2:-1}p" \
    | grep -oE 'bounds="[^"]*"' | grep -oE '[0-9]+' | tr '\n' ' ')
  [ -z "$b" ] && { echo "cap_tap_text: '$1' not found" >&2; return 1; }
  set -- $b; "$ADB" shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

# rapid taps in the background ON the device (adb taps from the host are too slow for combos):
# cap_spam_taps x% y% count
cap_spam_taps() {
  local x=$(( $(cap_w) * $1 / 100 )) y=$(( $(cap_h) * $2 / 100 ))
  "$ADB" shell "nohup sh -c 'for i in \$(seq 1 ${3:-40}); do input tap $x $y; done' >/dev/null 2>&1 &"
}

# tablet canvas on the phone emulator (10" portrait). The app must allow it (no phone-only layout).
# Crop the bottom ~125 px later: the tablet taskbar shows the user's other apps.
cap_tablet_on() { "$ADB" shell wm size 1600x2560; "$ADB" shell wm density 320; sleep 3; }
cap_tablet_off() { "$ADB" shell wm size reset; "$ADB" shell wm density reset; }

cap_reset() {
  cap_tablet_off
  "$ADB" shell cmd locale set-app-locales "$PKG" --locales ""
  cap_demo_off
}

# PNG -> JPEG q90 (keeps repo weight down for raw captures); macOS sips, else ImageMagick
cap_jpeg() {
  if command -v sips >/dev/null; then sips -s format jpeg -s formatOptions 90 "$1" --out "$2" >/dev/null
  else magick "$1" -quality 90 "$2"; fi
}
