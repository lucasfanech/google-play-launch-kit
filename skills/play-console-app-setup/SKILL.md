---
name: play-console-app-setup
description: Create an app in the Google Play Console and complete every setup form - app access, ads, content rating (IARC), target audience, data safety, advertising ID, government/financial/health declarations, privacy policy, category and contact details, testers - then send the changes for review. Answers are derived from the project's code (SDKs, permissions, accounts, ads). Use for "crée l'app sur Google Play", "remplis les formulaires du store", "set up the Play Console", "configure my app on Play", "déclarations / sécurité des données / classification".
---

# Play Console: create the app and fill the forms

Load `google-console-browser` first (browser choice, account, helpers, consent rules).
Store listing texts/graphics are `store-listing-i18n`; the AAB and tracks are `android-play-release`.

## 0. Gather facts from the project before touching the console

Read them from code, not memory - every answer below must be true:

| Fact | Where |
|---|---|
| App name, package (applicationId) | `app.json` (`expo.android.package`) or `android/app/build.gradle` |
| Default language | the language most players use; usually the dev's own |
| Ads? which SDK? | `package.json` (`react-native-google-mobile-ads`, `com.google.android.gms:play-services-ads`...) |
| Accounts / login / IAP / payments | auth libs, `react-native-iap`, billing |
| Data the app or its SDKs send | your backend calls + SDK disclosures (see data safety table) |
| Permissions | merged `AndroidManifest.xml` (`unzip -p app.aab base/manifest/AndroidManifest.xml \| strings`) |
| Target age | ask the user if not stated; 13+ avoids the Families policy |
| Violence, fear, gambling, user content... | play the app / grep strings and assets |
| Privacy policy URL, contact email | ask the user if missing; see `admob-integration` for a template |

Ask the user only for what the project cannot tell (age target, contact email, publisher name).

## 1. Create the app

`https://play.google.com/console/u/0/developers/<devId>/create-new-app`
- Name (30 chars max), package name -> "Vérifier la disponibilité" must say available.
  **The package can never change afterwards** - confirm it with the user if it looks temporary
  (e.g. `com.yourname.*`).
- Default language, App vs Game, Free vs Paid (free can never become paid).
- Two declarations (Developer Program Policies, US export laws): **ask the user** before ticking.
- Note the new `appId` from the URL after creation.

## 2. App content declarations (`/app/<appId>/app-content/...`)

Direct URLs (all save with "Enregistrer"; check `__saved()`):

| Page | Path | Typical answer for an offline game with AdMob |
|---|---|---|
| Privacy policy | `privacy-policy` | public URL (https, no login, not a PDF) |
| App access | `testing-credentials` | "Non" - nothing restricted (else give test credentials) |
| Ads | `ads-declaration` | "Oui, mon application contient des annonces" |
| Advertising ID | `ad-id-declaration` | Oui -> "Publicité ou marketing" + "Prévention des fraudes, sécurité et conformité" (needs `com.google.android.gms.permission.AD_ID`, merged automatically by the Ads SDK) |
| Government apps | `government-apps` | Non |
| Financial features | `finance` | "Mon appli ne fournit aucune fonctionnalité financière" -> Suivant -> Enregistrer |
| Health | `health` | "Mon appli ne propose aucune fonctionnalité de santé" -> Suivant -> Enregistrer |
| Target audience | `target-audience-content` | tick age groups (13-15, 16-17, 18+ for a teen game) -> Suivant -> Enregistrer. Any group under 13 pulls in the Families policy (certified ad SDKs, teacher-approved...) |
| Content rating | `content-rating-overview` -> "Répondre au questionnaire" | see section 3 |
| Data safety | `data-privacy-security` | see section 4 |

The overview page `app-content/overview` lists what is still missing ("Attention requise").

## 3. Content rating (IARC)

Email (developer contact) + category (Game / Social / Other) + accept IARC terms (ask first).
Then one accordion section per topic; "Suivant" reveals the next. Use `__radios()` to see indexes.
Be accurate - misdeclaration can get the app removed. Guidance:
- Hitting/killing cartoon or fantasy creatures = violence **Oui** -> "Violence contre d'autres
  entités que les humains", fantasy setting, cartoon style, unrealistic reactions, blood "Aucune".
  This still yields mild ratings (PEGI 3 / ESRB 10+ / USK 12 in our case). Tell the user if they
  doubt it.
- Fear, sexuality, gambling (real or simulated casino; random chest rewards earned in-game are
  not gambling), language, controlled substances, crude humour, digital purchases/NFT, user
  interaction, location sharing, extremist symbols: answer from the content.
- "Enregistrer", then "Suivant" shows the ratings per region; show them to the user, then
  "Enregistrer" again (URL gets `?applied=true`).

## 4. Data safety

Step 1 overview -> Suivant. Step 2: collects/shares data? encrypted in transit? account creation
methods ("Mon appli ne permet pas aux utilisateurs de créer un compte" if none), login with
external accounts, deletion request (optional - leave empty rather than overclaim).
Step 3 data types (expand each category with a REAL click on its "Afficher le contenu" ref, then
tick with `__pick`). Step 4: for each type, "Questions ouvertes sur ..." opens a dialog: collected
and/or shared, ephemeral?, required or optional, purposes for collection and for sharing.

Mapping for common SDKs (verify against the SDK's current Play data disclosure page):

| SDK | Data types | Purposes |
|---|---|---|
| Google Mobile Ads (AdMob) | Approximate location (IP), App interactions, Crash logs, Diagnostics, Device or other IDs | Advertising or marketing, Analytics, Fraud prevention, security and compliance; collected + shared, not ephemeral, required |
| Firebase Analytics | App interactions, Device or other IDs, (Diagnostics) | Analytics |
| Crashlytics / Sentry | Crash logs, Diagnostics | Analytics / App functionality |
| Your backend with accounts | Email, User IDs, ... | App functionality, Account management |

Local-only game saves (MMKV, AsyncStorage) are not "collected". Preview step 5, then "Enregistrer".

## 5. Store settings (`/app/<appId>/store-settings`)

- Category: "Modifier" -> real click on the category dropdown -> pick (idle/clicker games:
  Simulation or Casual) -> Enregistrer.
- Contact details: email (public), optional phone/website -> Enregistrer.

## 6. Testers and first review

- Internal testing (`tracks/internal-testing?tab=testers`): tick an existing email list or create
  one; Enregistrer. Get the opt-in link with `__captureCopy()` + click "Copier le lien".
- Publishing overview (`/app/<appId>/publishing`): "Envoyer N modifications pour examen" -
  **ask the user first**. Until this is done for a new app, even internal testers get
  "app not found" on the store page.
- Reviews usually take up to 7 days for a new app.

## 7. Report

App id, package, what was declared (one line per form), content ratings, tester link, what is
left (store listing, AAB upload, review).
