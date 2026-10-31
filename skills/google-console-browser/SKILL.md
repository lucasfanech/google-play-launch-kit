---
name: google-console-browser
description: How to drive Google web consoles (Google Play Console, AdMob, Google Sites, Firebase, Search Console) from the browser reliably - picking the right browser and Google account, filling Angular/Material forms through shadow DOM, uploading files, saving and verifying. Load it before any browser automation on play.google.com/console, admob.google.com or sites.google.com, and whenever another skill (play-console-app-setup, store-listing-i18n, android-play-release, admob-integration) says to. Triggers: "remplis la Play Console", "fill the Play Console forms", "va sur AdMob", "publie sur Google Sites", "upload sur le store".
---

# Driving Google consoles from the browser

Google consoles (Play Console, AdMob, Sites) are Angular apps built from Material web components
inside shadow DOM. Plain `find`/accessibility clicks often miss, typing into a background tab is
dropped, and many controls only react to real pointer events. This skill is the toolbox that
made them work end to end; the other store skills rely on it.

## 1. Pick the browser

| Need | Use |
|---|---|
| Read pages, fill text, radios, checkboxes, dialogs | either browser |
| **Upload a file** (icons, screenshots, AAB...) | **Claude in Chrome** (`file_upload`, 10 MB max per call). The in-app browser blocks local files (`ERR_BLOCKED_BY_CLIENT`) and has no upload tool |
| File > 10 MB (an AAB is often 50-150 MB) | ask the user to drag it in: reveal it in Finder (`mcp__ccd_host__reveal_path`) and wait |

If Claude in Chrome is "not connected": `list_connected_browsers`; if empty, the user must open
the Claude side panel in Chrome and sign in with the same account as this app. Then retry.

## 2. Pick the Google account

- The developer account is often NOT the browser's default Google account. Find it:
  `https://play.google.com/console/u/<N>/developers` for N = 0, 1, 2... shows which account owns
  which developer account; or force it with `?authuser=<email>` on any Google URL.
- Gmail ignores dots: `john.doe@gmail.com` == `johndoe@gmail.com` (same tester, same owner).
- A redirect can drop `authuser`; check the account avatar or the page content after navigating.
- Note the developer id and app id from the URL
  (`/developers/<devId>/app/<appId>/...`) and reuse direct URLs instead of clicking through menus.

## 3. Helpers to inject (javascript tool)

Re-inject after every full navigation (window state is lost). The full file is
`references/helpers.js`; the core is:

```js
window.__q = sel => { const all = []; (function walk(r) { r.querySelectorAll('*').forEach(e => {
  if (e.shadowRoot) walk(e.shadowRoot); if (e.matches(sel)) all.push(e); }); })(document); return all; };
window.__vis = e => e.getBoundingClientRect().height > 0;
window.__set = (el, v) => { const p = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(p, 'value').set.call(el, v);
  ['input', 'change', 'blur'].forEach(t => el.dispatchEvent(new Event(t, { bubbles: true }))); };
window.__btn = txt => { const b = __q('button').filter(e => __vis(e) && (e.innerText || '').trim() === txt);
  if (!b.length) return 'no ' + txt; b[b.length - 1].click(); return 'clicked ' + txt; };
```

Rules that matter:
- **Text fields**: always `__set` (native value setter + events). `computer type` silently does
  nothing when the tab is not focused, and Angular ignores `el.value = x`.
- **Pick visible fields only** (`__vis`): hidden copies of the previous language/step stay in the
  DOM and shift indexes. Verify with the character counters on the page (`15/30 79/80 1808/4000`).
- **Radios / checkboxes**: `material-radio` / `material-checkbox` elements accept `.click()`;
  match on `innerText.trim()` (startsWith for long labels). Read state back with
  `el.querySelector('input')?.checked`.
- **Buttons**: `__btn('Enregistrer')`, `__btn('Suivant')`. Several share a label: take the last
  visible one, or scope to the open dialog:
  `const d = __q('[role=dialog],material-dialog').filter(__vis).pop()` then `d.contains(btn)`.
- **Things JS clicks do not open**: dropdowns (`material-dropdown-select`), accordion headers
  ("Afficher le contenu : ..."), language pickers. Use `find` to get a ref, `scroll_to` it, then a
  real `left_click` on the ref. Expanding one accordion section may collapse the others.
- **Waits**: these apps load lazily; wait 3-6 s after navigation and 1-3 s after clicks inside
  the JS (`await new Promise(r => setTimeout(r, 3000))`), then re-query.
- **Verify every save**: look for `Modification enregistrée` / `Vos modifications ont été
  enregistrées` / `Brouillon enregistré` (or the English equivalents) in `document.body.innerText`,
  or a URL change like `?applied=true`. Never assume.
- **Read long pages** with `document.body.innerText.slice(i, i + N)` around a known heading
  rather than screenshots.
- Batch steps (`browser_batch`): navigate + JS + find in one round trip. A `file_upload` needs the
  file-input ref from a previous `find`, so open the picker in one batch and upload in the next.

## 4. File uploads in the Play Console asset library

1. Click the slot's "Ajouter des composants" (real click on a `find` ref; expand the section first,
   e.g. "Éléments pour tablette" is collapsed by default).
2. `find` "file input type=file" -> ref (refs change every time the panel opens).
3. `file_upload` ONE file, wait ~3 s, then click the panel's "Ajouter" button by script:
   ```js
   for (let i = 0; i < 20; i++) { const b = __q('button').filter(e => __vis(e) && /(^|\n)Ajouter$/.test((e.innerText||'').trim()));
     if (b.length) { b[b.length-1].click(); break; } await new Promise(r => setTimeout(r, 500)); }
   ```
   Repeat for the next file with the same ref - this keeps the order. Multi-file uploads land in
   random order and need drag-reordering.
4. Close the panel (X at the top right) before opening another slot, otherwise the panel stays
   bound to the previous slot and fills the wrong one.
5. Never click by coordinates at the panel's bottom bar: when nothing is selected the same spot is
   "Add from Drive" and opens a Drive picker (close it without selecting).
6. "Le composant a été dédupliqué" is fine: the library reused an identical file.

## 5. Safety and consent

- Ask the user before ticking legal declarations (Developer Program Policies, US export laws, IARC
  terms), sending changes for review, publishing a release or promoting a track, deleting
  anything, or saving a "Copier le lien"-style value to their clipboard. Their approval in chat
  for that specific action is required; approval for another app or another day does not carry.
- Never create accounts, pay fees, enter passwords or verify identity for the user.
- Answer questionnaires truthfully from the code and assets (grep the project); when the user
  wants a less accurate answer, explain the consequence (policy rejection / removal) and let them
  decide.
- Reading the clipboard is not possible; to get a value behind a "copy" button, wrap
  `navigator.clipboard.writeText` before clicking (see `references/helpers.js`).

## 6. Known console facts

- Package name of a Play app can never change: a new package = a new app (redo listing and forms).
  An app that had a release cannot be deleted.
- Internal testing link format: `https://play.google.com/apps/internaltest/<trackId>`. The tester
  page with `?authuser=<email>` tells if that account is a tester.
- New app: the store page stays "not found" even for internal testers until the first set of
  changes is sent for review from "Vue d'ensemble de la publication" / Publishing overview.
- Personal developer accounts created after Nov 2023 need a closed test with 12+ testers for
  14 days before production; organization accounts do not.
- AdMob can link an app to a store only once the app is publicly listed; for a new app the
  package search may return nothing while the full Play URL finds it.
- On a published app, the listing's contact details (email, phone, website) go live at once:
  "Enregistrer et publier" + a confirmation dialog, no review.
