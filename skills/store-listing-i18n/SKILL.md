---
name: store-listing-i18n
description: Write a multilingual app store listing (title, short and full description) that follows Google Play metadata rules, keep it in a versioned JSON, validate the limits, and enter it plus localized graphics into the Play Console for every language. Use for "fiche store multilingue", "écris la description du Play Store", "traduis la fiche", "store listing in French/English/Spanish/Italian", "ajoute les langues sur la Play Console", "upload screenshots per language".
---

# Multilingual store listing

Writes `store/listing.json`, checks it, and fills the Play Console default listing + translations
with texts and localized graphics. Visuals come from `store-screenshots`; browser technique from
`google-console-browser`.

## 1. Write the listing

Source of truth: `store/listing.json`
```json
{
  "defaultLanguage": "fr-FR",
  "containsAds": true,
  "category": "Games > Simulation",
  "contactEmail": "...", "privacyPolicy": "https://...",
  "languages": { "fr-FR": { "title": "", "short": "", "full": "" }, "en-US": { ... } }
}
```
Languages = the app's own UI languages (read its i18n files); Play locale codes `fr-FR`, `en-US`,
`es-ES`, `it-IT`, `de-DE`, `pt-BR`...

Content rules (Play metadata policy + what converts):
- **title** <= 30: the app name only; no "free", "best", ranks, emoji, ALL CAPS, keyword lists.
- **short** <= 80: one concrete hook with the core verb and the hero/genre ("Tap, bonk and collect
  ... in 3D"); no title repetition, no call to action ("download now").
- **full** <= 4000: opening sentence that says what you do in the game; 4-7 sections with a symbol
  bullet ("★ SECTION") made of real features and real numbers taken from the code (number of
  characters, levels, trophies, languages); then honest monetization ("free, contains video ads:
  optional ones give X, others may appear after Y; no banners" / in-app purchases), then
  credits/licences and "unofficial fan game" disclaimers when the content is inspired by memes or
  third-party IP. No testimonials, no comparisons with other apps, no prices, no unrelated keywords.
- Same structure in every language, written natively (tutoiement for a French game, informal
  "you" in Spanish/Italian), not word-for-word. Proper nouns (character names, brand names,
  in-game names that are lore) are never translated; in-game item names must match the app's own
  translations (grep the i18n file).
- Facts must match the build: if the description says "works offline", "10 characters", "25
  trophies", check the code.

Validate: `node ~/.claude/skills/store-listing-i18n/scripts/check-listing.mjs store/listing.json`
(limits, missing fields, banned words, all caps, ads disclosure). Fix every error; read warnings.

## 2. Enter it in the Play Console

`/app/<appId>/store-listings` -> "Créer une fiche Play Store par défaut" (first time) or
`/store-listings/default/edit`.

1. Default language: fill the three visible fields with `__set` on `__fields()` (indexes 0/1/2 =
   name / short / full). Confirm with the counters (`15/30 79/80 1808/4000`).
2. Graphics of the default language (each slot: open, upload one file, add, close - see
   `google-console-browser` section 4): icon 512, feature graphic, phone screenshots in order,
   then expand "Éléments pour tablette" and fill 7" and 10" (same tablet images for both).
3. "Enregistrer comme brouillon".
4. Languages: language dropdown (real click) -> "Gérer les langues" -> tick the locales (match on
   "Anglais (États-Unis) – en-US" style labels inside the dialog) -> "Appliquer".
5. For each added language: switch with the language dropdown (more reliable than "Langue suivante",
   whose order is not the list order) and **confirm the active language** from
   `document.body.innerText.match(/(Anglais|Espagnol|Italien|Allemand|...)[^\n]*– [a-z]{2}-[A-Z]{2}/)`
   before writing anything. Fill texts, then localized feature graphic + phone + tablet screenshots
   (a localized slot replaces the inherited default ones; an empty slot inherits the default
   language's images). Save as draft after each language.
6. "Suivant" (review) -> check there is no error -> "Enregistrer".
7. Check each language once more (fields non-empty, images localized) - a fill that ran while the
   wrong language was active is the classic mistake.

## 3. Report

Per language: lengths, graphics count, saved state. Point to `store/listing.json` as the place to
edit next time.
