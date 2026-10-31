---
name: app-website
description: Publish the app's website on Cloudflare (a free static Worker on a subdomain of the user's domain) with a ready-made landing page in every store language - Google Play badge, phone hero, screenshots, features, privacy and contact - then set it as the developer website of the Google Play listing and serve the AdMob app-ads.txt so AdMob can verify the app ("Examen requis", "Verify app", limited ad serving). Helps set up Cloudflare and a domain when the user has none. Use for "crée un site pour l'app", "page web de l'app", "site développeur", "app-ads.txt", "AdMob examen requis", "valider l'app AdMob", "héberge sur Cloudflare", "app website", "developer website", "landing page".
---

# App website on Cloudflare (+ app-ads.txt)

Script: `node ~/.claude/skills/app-website/scripts/site.mjs init | build | check` from the project
root (usage at the top of the script). Browser steps follow `google-console-browser`; every
account, payment and OAuth step is the user's.

Every app gets the same design: hero in the app's theme colours (`store/mockups.config.json`
`theme`) with the app's fonts, language buttons, official Google Play badge per language, phone
showing the home screen, screenshot strip, feature cards, monetization note, final call to action,
footer with privacy policy and contact. Texts switch with the browser language (default language
written in the HTML as the no-script fallback).

Why AdMob needs it: a new app stays "Examen requis / Diffusion d'annonces limitée" until it is
public on Google Play, linked to its listing in AdMob, and `app-ads.txt` sits on the **developer
website of the listing**. The crawler reads `https://<host>/app-ads.txt` (then http), then one
level up (`example.com`); `www.` and `m.` are skipped.

## 1. Ask the user (once)

- Their domain on Cloudflare (`example.com`) and the subdomain for this app (suggest the app slug:
  `myapp.example.com`). One level only - the free certificate covers `*.example.com`, not
  `a.b.example.com`; not `www`/`m`. An existing site on the root domain is not affected.
- No domain or no Cloudflare account: section 2 first.
- Nothing else: the rest comes from the project.

## 2. Cloudflare setup (only if needed)

1. Account: the user signs up at dash.cloudflare.com (Free plan).
2. Domain - either:
   - buy it in Cloudflare: Domain Registration -> Register Domains (at-cost price; the user pays);
   - or bring one: "Add a domain" -> Free -> keep the imported DNS records (mail MX, etc.) -> at the
     registrar, replace the nameservers by the two `*.ns.cloudflare.com` shown -> wait for "Active"
     (minutes to 24 h). Check: `dig NS example.com +short` lists `ns.cloudflare.com` servers.
3. `npx wrangler login` (the user clicks Authorize), `npx wrangler whoami`. Several accounts: set
   `cloudflareAccountId` in the config.

Without any domain a `*.workers.dev` site works but is a weak developer website for app-ads.txt:
recommend a domain.

## 3. Generate

1. `site.mjs init` drafts `site.config.json` from `app.json` (or `apps/*/app.json`: name, package,
   AdMob publisher id from `androidAppId`), `store/listing.json` (languages, short description,
   features from the "★" sections, contact, privacy URL), `store/mockups.config.json` (theme,
   fonts, screen order) and `release.config.json` (publisher). All options:
   `references/site.config.example.json`.
2. Edit it - `build` refuses while any "TODO" remains:
   - `host` = the chosen subdomain; `out` = `site` (or `apps/site` in a monorepo);
   - per language: an emoji per feature, feature texts cut to 1-2 sentences (<= 170 chars), titles
     in sentence case with proper nouns restored, `note` = the honest monetization line plus the
     languages (same facts as the listing: free, ad formats, no banners), `finalTitle` adapted
     (app vs game), optional `footerNote`; other languages than fr/en/es/de/it/pt start in English;
   - `rating` from the Play content rating ("PEGI 3"), `images.shots` in the listing order.
   Facts must match the build and the listing.
3. `site.mjs build` writes `<out>/public` (generated: change the config, not these files) and
   `<out>/wrangler.jsonc` (static Worker `<slug>-site` + custom domain). It downloads the official
   badges and resizes images (`sips`, else ImageMagick).
4. Preview: `cd <out> && npx wrangler dev --port 8790`; look at desktop and phone widths, each
   language button, no horizontal scroll. Commit the config and `<out>`.

## 4. Deploy

`cd <out> && npx wrangler deploy` creates the DNS record and certificate. Then
`site.mjs check <host> --pub pub-XXXX`: it resolves through 1.1.1.1 because the local resolver can
keep a "not found" from a lookup made before the deploy. Static-asset Workers run no code: free and
unlimited. After any config change: `build`, then `deploy`.

## 5. Google Play: developer website

Play Console -> `/app/<appId>/store-settings` -> "Coordonnées sur la fiche Play Store" -> Modifier
-> Site Web = full `https://<host>` (the "https://" shown is only a placeholder) -> "Enregistrer et
publier" -> dialog "Publier la modification sur Google Play ?" -> "Enregistrer et publier". It is
public at once (no review, usually within the hour): get the user's go-ahead (a request to set up
the site counts). Check: `site.mjs check <host> --package <applicationId>`.

## 6. AdMob: link the store, then verify

The app must be public on Google Play.
1. Apps -> the app's row -> "Ajouter un magasin d'applications". The package-name search often
   finds nothing for a new app: paste `https://play.google.com/store/apps/details?id=<package>` ->
   Rechercher -> "Ajouter" -> Continuer -> confirm the package -> Enregistrer. AdMob starts its
   review ("two or three days").
2. Same row -> "Verify app" -> "Rechercher des mises à jour". At first it answers "Impossible de
   valider ... ne correspondent pas": the Apps -> app-ads.txt tab shows no data until Google's
   crawler has fetched the file (up to 7 days for a new domain; it may also wait for real ad
   requests). Do not touch a file that `check` validates; recheck later.
3. The CMP reminder on the confirmation page is covered by `admob-integration` (UMP + GDPR message).

Several apps on one AdMob account: one site per app, each with the same `app-ads.txt` line.

## 7. Report

Site URL, `app-ads.txt` line, Play listing field, AdMob link and status, what is left (crawl,
review), how to redeploy.
