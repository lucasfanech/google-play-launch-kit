---
name: admob-integration
description: Add Google AdMob to an Expo/React Native app the compliant way - rewarded videos and capped interstitials (no banners by default), UMP/GDPR consent before init, test ads in dev, ad units created in the AdMob console, privacy policy page (published on Google Sites), GDPR consent message, privacy-options entry in settings, Play data-safety mapping, release R8 rule, and linking the app to the store once public. Use for "intègre AdMob", "ajoute de la pub", "pubs vidéo récompensées", "coffre gratuit contre une pub", "RGPD / consentement", "politique de confidentialité", "monetize with ads".
---

# AdMob, compliant

Browser work (AdMob console, Google Sites) follows `google-console-browser`. Data-safety answers
are in `play-console-app-setup`.

## 1. Decide with the user (ask once, short)

- Formats: rewarded video (opt-in reward: free chest, extra life, x2) and/or interstitial video at
  natural pauses. Banners only if asked (they hurt game UX).
- Audience: 13+ (simplest: not child-directed) vs under-13 (Families policy: certified SDKs only,
  `tagForChildDirectedTreatment`, no personalized ads).
- Interstitial pacing: low / moderate (default: max 1 per 4 natural pauses, >= 3 min apart, none in
  the first 2 min of a session) / high.
- Daily cap for rewarded rewards (e.g. 10/day) so ads stay a bonus, not the economy.

## 2. AdMob console (admob.google.com, the user's account)

1. Apps -> Add app -> Android -> "not published yet" -> name. Note the **app id**
   `ca-app-pub-XXXX~YYYY`.
2. Ad units: one Rewarded ("Free chest"), one Interstitial with **video only** if videos only.
   Note the unit ids `ca-app-pub-XXXX/ZZZZ`.
3. Privacy & messaging -> GDPR -> create a message: app, privacy policy URL, default language +
   translations for the app's languages, buttons Consent / Do not consent / Manage options all
   enabled -> Publish (it can take up to an hour to show up in the app).
4. Later, once the app is public on Play: Apps -> the app -> "Ajouter un magasin d'applications"
   -> search the package (or paste the Play URL) -> link. Before that the search finds nothing
   and serving stays "limited"; nothing to do but wait. Also publish `app-ads.txt` on the
   developer website then: `app-website` builds the site on Cloudflare, sets it in the Play
   listing and verifies the app in AdMob.

## 3. Code (Expo, react-native-google-mobile-ads)

- `npx expo install react-native-google-mobile-ads`; `app.json` plugin config:
  `androidAppId`, `iosAppId` (test id until iOS exists), `delayAppMeasurementInit: true`,
  `userTrackingUsageDescription` (iOS ATT text in the app's language).
- Copy `templates/ads.ts` to the project (e.g. `src/ads/index.ts`) and adapt: unit ids, the two
  project hooks (pause timers / music while an ad is full screen), pacing constants. It implements:
  - `AdsConsent.gatherConsent()` then `getConsentInfo()`; only if `canRequestAds` ->
    `setRequestConfiguration({ maxAdContentRating: T, tagForChildDirectedTreatment: false,
    tagForUnderAgeOfConsent: false })` -> `initialize()`; `privacyRequired` flag for the settings
    entry (`showPrivacyOptionsForm()`).
  - `TestIds` whenever `__DEV__` - never request real ads from dev builds.
  - Rewarded: reward granted only on `EARNED_REWARD`; preloads the next one; retry after failures.
  - Interstitial: only from `onNaturalPauseEnded()` (e.g. after a reward dialog closes), pacing
    rule exported as a pure function for tests.
  - Full-screen flag so offline-earnings / timers do not count ad time as "away".
- UI: rewarded buttons say clearly that a video ad plays ("Watch a video"), show the remaining
  daily count, are disabled while loading; an occasional opt-in bonus offer after a reward is fine.
- Settings: link to the privacy policy + "Ad privacy" entry when `privacyRequired`.
- Call `initAds()` once at startup (root layout), after the first frame.
- Unit-test the pacing and daily-cap logic.
- Release builds: R8 keep rule for Room (WorkManager comes with the Ads SDK) - see
  `android-play-release`; always smoke-test the release APK.

## 4. Privacy policy

`templates/privacy-policy.fr-en.md` (FR + EN): fill `{{APP_NAME}}`, `{{PUBLISHER_LEGAL_NAME}}`,
`{{TRADE_NAME}}`, `{{CONTACT_EMAIL}}`, dates; adapt data list, ad formats, age section. Never put
the user's home address; ask which name/email to publish. Save it in `docs/`.

Publishing on Google Sites (free, https, no login), with the user's account:
1. sites.google.com -> blank site -> title, page content: paste the policy (typing into Sites'
   editor often fails - insert via a paste event: `DataTransfer` with `text/html`, dispatched on the
   focused text box; remove leftovers with real Backspace key presses).
2. Publish -> choose the URL slug (e.g. `<app>-privacy`) -> visibility public. Verify the URL loads
   logged out. Put the URL in the app (constant), the AdMob GDPR message and the Play Console.

## 5. Verify

Dev build on the emulator: consent form (EEA), test rewarded plays and grants, interstitial respects
pacing, music pauses/resumes, no offline-earnings bump after an ad. Logcat: `I Ads` lines; "Ad failed
to load : 3" = no fill (normal for a new/unapproved app).
