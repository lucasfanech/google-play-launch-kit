#!/usr/bin/env node
// Checks a multilingual store listing JSON against Google Play limits and common policy traps.
//   node ~/.claude/skills/store-listing-i18n/scripts/check-listing.mjs [store/listing.json]
//   node .../check-listing.mjs store/listing.json --export <outdir>   also writes one .txt per field/lang
// Format: { "defaultLanguage": "fr-FR", "languages": { "fr-FR": { "title", "short", "full" }, ... } }
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const file = resolve(process.argv[2] || 'store/listing.json');
const exportDir = process.argv.indexOf('--export') > 0 ? process.argv[process.argv.indexOf('--export') + 1] : null;
const L = JSON.parse(readFileSync(file, 'utf8'));
const LIMITS = { title: 30, short: 80, full: 4000 };
// words Play rejects or flags in metadata (rankings, prices, calls to action, emoji spam...)
const BANNED = [/\b(best|#1|number one|top \d+|free download|download now|install now|sale|discount|meilleur|n°\s?1|gratuit maintenant|télécharge maintenant)\b/i];
let errors = 0, warnings = 0;
const len = s => [...(s || '')].length;

if (!L.languages?.[L.defaultLanguage]) { console.log(`✗ defaultLanguage ${L.defaultLanguage} has no entry`); errors++; }
const titles = new Set();
for (const [lang, v] of Object.entries(L.languages)) {
  const parts = [];
  for (const [k, max] of Object.entries(LIMITS)) {
    const n = len(v[k]);
    if (!n) { console.log(`✗ ${lang}.${k} missing`); errors++; continue; }
    if (n > max) { console.log(`✗ ${lang}.${k} ${n}/${max}`); errors++; }
    parts.push(`${k} ${n}/${max}`);
    for (const re of BANNED) if (re.test(v[k])) { console.log(`! ${lang}.${k} contains "${v[k].match(re)[0]}" (Play metadata policy)`); warnings++; }
    if (/(\p{L}|[!?.])\1{3,}/u.test(v[k]) || (v[k].match(/\p{Emoji_Presentation}/gu) || []).length > 3) { console.log(`! ${lang}.${k}: repeated characters or many emoji`); warnings++; }
  }
  if (v.title && v.title === v.title.toUpperCase() && /[A-Z]{4}/.test(v.title)) { console.log(`! ${lang}.title is all caps`); warnings++; }
  if (v.short && v.title && v.short.toLowerCase().startsWith(v.title.toLowerCase())) { console.log(`! ${lang}.short repeats the title`); warnings++; }
  if (v.full && !/pub|ads|annun|anunc|werbung|anúncios/i.test(v.full) && L.containsAds) { console.log(`! ${lang}.full does not mention ads but containsAds=true`); warnings++; }
  titles.add(v.title);
  console.log(`✓ ${lang}: ${parts.join(', ')}`);
  if (exportDir) {
    mkdirSync(join(exportDir, lang), { recursive: true });
    for (const k of Object.keys(LIMITS)) if (v[k]) writeFileSync(join(exportDir, lang, `${k}.txt`), v[k]);
  }
}
console.log(`${Object.keys(L.languages).length} languages, ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
