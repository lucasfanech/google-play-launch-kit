#!/usr/bin/env node
// App website on Cloudflare: a static landing page in every store language (Google Play badge,
// phone hero, screenshots, features, privacy and contact) plus the app-ads.txt that AdMob reads on
// the developer website of the Play listing. Run from the project root:
//
//   node ~/.claude/skills/app-website/scripts/site.mjs init [config]
//       draft site.config.json from app.json (or apps/*/app.json), store/listing.json,
//       store/mockups.config.json, store/play and release.config.json; unknown values are "TODO"
//   node ~/.claude/skills/app-website/scripts/site.mjs build [config]
//       write <out>/public/ (generated - edit the config, not these files) and <out>/wrangler.jsonc;
//       refuses to run while the config still contains "TODO"
//   node ~/.claude/skills/app-website/scripts/site.mjs check <host> [--pub pub-XXXX] [--package <id>]
//       public DNS (1.1.1.1, ignores a stale local cache), home page, app-ads.txt over https and http
//       as Google's crawler fetches it, and with --package the website on the public Play page
//
// config default: site.config.json, paths inside are relative to the cwd. Every option:
// ../references/site.config.example.json. Resizing: macOS `sips`, else ImageMagick, else copied.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = process.cwd();
const TPL = join(dirname(fileURLToPath(import.meta.url)), '../templates');
const [cmd, ...args] = process.argv.slice(2);
const P = (p) => resolve(cwd, p);
const readJson = (p) => (p && existsSync(P(p)) ? JSON.parse(readFileSync(P(p), 'utf8')) : null);
const GOOGLE_TAG = 'f08c47fec0942fa0'; // Google's certification authority ID, last field of its app-ads.txt line
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const BADGE = (code) => `https://play.google.com/intl/en_us/badges/static/images/badges/${code}_badge_web_generic.png`;
const BULLET = /^\s*[★☆■◆●▶►✦✓✔]\s*(.+)$/u;

// Built-in interface strings. Another language starts from English: translate it in the config.
const UI = {
  fr: { langLabel: 'Langue', free: 'Gratuit', badgeAlt: 'Disponible sur Google Play', shotsTitle: "L'appli en images", shotsLabel: "Captures d'écran", featTitle: "Dans l'appli", finalTitle: "Prêt à l'essayer ?", privacy: 'Politique de confidentialité', contact: 'Contact :', notFound: 'Page introuvable', home: 'Accueil' },
  en: { langLabel: 'Language', free: 'Free', badgeAlt: 'Get it on Google Play', shotsTitle: 'The app in pictures', shotsLabel: 'Screenshots', featTitle: 'In the app', finalTitle: 'Ready to try it?', privacy: 'Privacy policy', contact: 'Contact:', notFound: 'Page not found', home: 'Home' },
  es: { langLabel: 'Idioma', free: 'Gratis', badgeAlt: 'Disponible en Google Play', shotsTitle: 'La app en imágenes', shotsLabel: 'Capturas de pantalla', featTitle: 'En la app', finalTitle: '¿Listo para probarla?', privacy: 'Política de privacidad', contact: 'Contacto:', notFound: 'Página no encontrada', home: 'Inicio' },
  de: { langLabel: 'Sprache', free: 'Kostenlos', badgeAlt: 'Jetzt bei Google Play', shotsTitle: 'Die App in Bildern', shotsLabel: 'Screenshots', featTitle: 'In der App', finalTitle: 'Bereit zum Ausprobieren?', privacy: 'Datenschutzerklärung', contact: 'Kontakt:', notFound: 'Seite nicht gefunden', home: 'Startseite' },
  it: { langLabel: 'Lingua', free: 'Gratis', badgeAlt: 'Disponibile su Google Play', shotsTitle: "L'app in immagini", shotsLabel: 'Screenshot', featTitle: "Nell'app", finalTitle: 'Pronto a provarla?', privacy: 'Informativa sulla privacy', contact: 'Contatto:', notFound: 'Pagina non trovata', home: 'Home' },
  pt: { langLabel: 'Idioma', free: 'Grátis', badgeAlt: 'Disponível no Google Play', shotsTitle: 'O app em imagens', shotsLabel: 'Capturas de tela', featTitle: 'No app', finalTitle: 'Pronto para experimentar?', privacy: 'Política de privacidade', contact: 'Contato:', notFound: 'Página não encontrada', home: 'Início' },
};
const TEXT_KEYS = ['title', 'description', 'tagline', ...Object.keys(UI.en), 'features', 'note', 'footerNote'];
// The design delivered for MyCoupon; store/mockups.config.json "theme" uses the same keys.
const THEME = { ink: '#10241C', bg1: '#16694F', bg2: '#0E4D3A', bg3: '#0A3A2C', glow: '#2E7A61', accent: '#BDEFC9' };

const short = (code) => code.slice(0, 2).toLowerCase();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const warn = (m) => console.warn(`! ${m}`);

// ---------- init ----------

function findApp() {
  if (existsSync(P('app.json'))) return '.';
  const apps = existsSync(P('apps')) ? readdirSync(P('apps')).map((d) => join('apps', d)) : [];
  return apps.find((d) => readJson(join(d, 'app.json'))?.expo?.android) ?? '.';
}

function features(full = '') {
  const lines = full.split('\n');
  const out = [];
  for (let i = 0; i < lines.length && out.length < 6; i++) {
    const m = lines[i].match(BULLET);
    if (!m) continue;
    const body = [];
    for (let j = i + 1; j < lines.length && lines[j].trim() && !BULLET.test(lines[j]); j++) body.push(lines[j].trim());
    const t = m[1].trim();
    out.push(['TODO', t === t.toUpperCase() ? t[0] + t.slice(1).toLowerCase() : t, body.join(' ') || 'TODO']);
  }
  while (out.length < 3) out.push(['TODO', 'TODO', 'TODO']);
  return out;
}

function sibling(font, weights) {
  if (!font) return null;
  for (const w of weights) {
    const f = font.replace(/-(ExtraBold|SemiBold|Bold|Black|Medium|Regular)(?=\.\w+$)/, `-${w}`);
    if (f !== font && existsSync(P(f))) return f;
  }
  return font;
}

function init(cfgPath) {
  if (existsSync(P(cfgPath))) throw new Error(`${cfgPath} exists: edit it, or delete it to start over`);
  const dir = findApp();
  const app = readJson(join(dir, 'app.json'))?.expo ?? {};
  const release = readJson(join(dir, 'release.config.json'));
  const listing = readJson('store/listing.json');
  const mock = readJson('store/mockups.config.json');
  const ads = (app.plugins || []).find((p) => Array.isArray(p) && p[0] === 'react-native-google-mobile-ads')?.[1];
  const pub = ads?.androidAppId?.match(/^ca-app-pub-(\d+)~/)?.[1];
  const codes = listing ? Object.keys(listing.languages) : ['en-US'];
  const languages = [...new Set(codes.map(short))];
  const name = app.name || listing?.languages?.[codes[0]]?.title || 'TODO';
  const play = mock?.out || 'store/play';
  const screens = mock?.screens?.map((s) => s.file) ?? ['1.jpg', '2.jpg', '3.jpg'];
  const texts = {};
  for (const code of codes) {
    const l = short(code);
    if (texts[l]) continue;
    const L = listing?.languages?.[code] ?? {};
    if (!UI[l]) warn(`no built-in strings for "${l}": English placeholders, translate them`);
    texts[l] = { title: `${name} — ${L.short ?? 'TODO'}`, description: L.short ?? 'TODO', tagline: L.short ?? 'TODO', ...(UI[l] ?? UI.en), features: features(L.full), note: 'TODO', footerNote: '' };
  }
  const C = {
    name,
    slug: app.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    host: 'TODO',
    out: 'site',
    package: app.android?.package || 'TODO',
    publisher: release?.certName || 'TODO',
    year: new Date().getFullYear(),
    contactEmail: listing?.contactEmail || 'TODO',
    privacyPolicy: listing?.privacyPolicy || 'TODO',
    rating: '',
    admobPublisherIds: pub ? [`pub-${pub}`] : [],
    appAdsExtraLines: [],
    // A month back: a local wrangler rejects dates newer than its runtime, and static assets need nothing recent.
    compatibilityDate: new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10),
    defaultLanguage: short(listing?.defaultLanguage || codes[0]),
    languages,
    theme: { ...THEME, ...mock?.theme },
    fonts: { display: mock?.fonts?.display ?? null, body: sibling(mock?.fonts?.body, ['Medium', 'Regular']), bodyBold: sibling(mock?.fonts?.body, ['Bold']) },
    images: {
      icon: `${play}/icon-512.png`,
      hero: `${mock?.raw || 'store/raw'}/phone/{lang}/${screens[0]}`,
      shots: screens.map((f) => `${play}/{lang}/phone/${f}`),
      og: `${play}/{lang}/feature-graphic.jpg`,
    },
    texts,
  };
  delete C.theme.rays;
  delete C.theme.title;
  delete C.theme.pill;
  writeFileSync(P(cfgPath), JSON.stringify(C, null, 2) + '\n');
  console.log(`wrote ${cfgPath} (app in ${dir}, ${languages.length} languages, AdMob ${pub ? `pub-${pub}` : 'not found'})`);
  console.log('Replace every "TODO", shorten the feature texts, then run build.');
}

// ---------- build ----------

function todos(v, path = '') {
  if (typeof v === 'string') return v.includes('TODO') ? [path] : [];
  if (v && typeof v === 'object') return Object.entries(v).flatMap(([k, x]) => todos(x, path ? `${path}.${k}` : k));
  return [];
}

function resize(src, dst, width, jpeg) {
  const q = jpeg ? ['-s', 'format', 'jpeg', '-s', 'formatOptions', '80'] : [];
  try {
    return execFileSync('sips', [...q, '--resampleWidth', String(width), src, '--out', dst], { stdio: 'ignore' });
  } catch {}
  try {
    return execFileSync('magick', [src, '-resize', `${width}x`, ...(jpeg ? ['-quality', '80'] : []), dst], { stdio: 'ignore' });
  } catch {}
  warn(`no sips/ImageMagick: ${basename(src)} copied at full size`);
  copyFileSync(src, dst);
}

const mix = (a, b, t) =>
  '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, '0')).join('');

function fill(tpl, map) {
  const out = readFileSync(join(TPL, tpl), 'utf8').replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => {
    if (!(k in map)) throw new Error(`template ${tpl}: no value for ${k}`);
    return map[k];
  });
  return out;
}

async function badge(lang, dst) {
  for (const code of [lang, 'en']) {
    const r = await fetch(BADGE(code)).catch(() => null);
    if (r?.ok && (r.headers.get('content-type') || '').startsWith('image/')) {
      writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
      if (code !== lang) warn(`no Google Play badge for "${lang}": English badge used`);
      return;
    }
  }
  throw new Error(`could not download the Google Play badge (${BADGE(lang)})`);
}

function check(C) {
  const errors = todos(C).map((p) => `still TODO: ${p}`);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(C.host || '')) errors.push(`host "${C.host}" is not a hostname (e.g. myapp.example.com)`);
  if (!C.languages?.includes(C.defaultLanguage)) errors.push('defaultLanguage must be one of languages');
  for (const [k, v] of Object.entries(C.theme || {})) if (!/^#[0-9a-f]{6}$/i.test(v)) errors.push(`theme.${k} must be #RRGGBB`);
  for (const p of C.admobPublisherIds || []) if (!/^pub-\d{16}$/.test(p)) errors.push(`admobPublisherIds: "${p}" is not pub-XXXXXXXXXXXXXXXX`);
  for (const l of C.languages || []) {
    const t = C.texts?.[l];
    if (!t) { errors.push(`texts.${l} missing`); continue; }
    for (const k of TEXT_KEYS) if (t[k] === undefined) errors.push(`texts.${l}.${k} missing`);
    if (!Array.isArray(t.features) || t.features.length < 2 || t.features.some((f) => !Array.isArray(f) || f.length !== 3)) errors.push(`texts.${l}.features: 2 to 9 [emoji, title, text]`);
    if ((t.tagline || '').length > 90) warn(`texts.${l}.tagline is long (${t.tagline.length} chars): it sits in a pill under the title`);
    (t.features || []).forEach((f, i) => (f[2] || '').length > 170 && warn(`texts.${l}.features[${i}] is long (${f[2].length} chars): aim for one or two short sentences`));
  }
  for (const f of [C.images?.icon, ...Object.values(C.fonts || {})].filter(Boolean)) if (!existsSync(P(f))) errors.push(`file not found: ${f}`);
  if (errors.length) throw new Error('fix site config:\n  ' + errors.join('\n  '));
}

async function build(cfgPath) {
  const C = readJson(cfgPath);
  if (!C) throw new Error(`${cfgPath} not found: run init first`);
  check(C);
  const def = C.defaultLanguage;
  const T = C.texts[def];
  const out = P(C.out || 'site');
  const pub = join(out, 'public');
  rmSync(pub, { recursive: true, force: true });
  mkdirSync(join(pub, 'img'), { recursive: true });

  const perLang = (tpl, l) => {
    const p = tpl.replaceAll('{lang}', l);
    if (existsSync(P(p))) return P(p);
    const d = tpl.replaceAll('{lang}', def);
    if (existsSync(P(d))) return warn(`${p} missing: ${def} image used`), P(d);
    throw new Error(`image not found: ${p}`);
  };
  copyFileSync(P(C.images.icon), join(pub, 'img/icon-512.png'));
  resize(P(C.images.icon), join(pub, 'img/icon-192.png'), 192, false);
  resize(perLang(C.images.og, def), join(pub, 'img/og.jpg'), 1024, true);
  for (const l of C.languages) {
    resize(perLang(C.images.hero, l), join(pub, `img/hero-${l}.jpg`), 560, true);
    C.images.shots.forEach((s, i) => resize(perLang(s, l), join(pub, `img/${l}-${i + 1}.jpg`), 500, true));
    await badge(l, join(pub, `img/badge-${l}.png`));
  }

  const faces = [];
  const fonts = { display: ['Site Display', 800], body: ['Site Body', 500], bodyBold: ['Site Body', 700] };
  for (const [k, [family, weight]] of Object.entries(fonts)) {
    const src = C.fonts?.[k];
    if (!src) continue;
    mkdirSync(join(pub, 'fonts'), { recursive: true });
    const ext = extname(src).toLowerCase();
    copyFileSync(P(src), join(pub, `fonts/${k}${ext}`));
    const format = { '.ttf': 'truetype', '.otf': 'opentype', '.woff': 'woff', '.woff2': 'woff2' }[ext];
    faces.push(`@font-face {\n  font-family: '${family}';\n  src: url('/fonts/${k}${ext}') format('${format}');\n  font-weight: ${weight};\n  font-display: swap;\n}`);
    const licence = readdirSync(dirname(P(src))).find((f) => /^(OFL|LICEN[CS]E)/i.test(f));
    if (licence) copyFileSync(join(dirname(P(src)), licence), join(pub, 'fonts', licence));
  }
  const th = { ...THEME, ...C.theme };
  const vars = {
    ink: th.ink, deep: th.bg3, primary: th.bg2, top: th.bg1, glow: th.glow, 'glow-fade': th.glow + '55', accent: th.accent,
    'accent-soft': mix(th.accent, '#ffffff', 0.55), wash: mix(th.accent, '#ffffff', 0.8), muted: mix(th.ink, '#ffffff', 0.3), 'footer-text': mix(th.ink, '#ffffff', 0.78),
    display: `${C.fonts?.display ? "'Site Display', " : ''}'Arial Black', system-ui, sans-serif`,
    body: `${C.fonts?.body ? "'Site Body', " : ''}system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif`,
  };
  writeFileSync(join(pub, 'style.css'), fill('style.css', { FONT_FACES: faces.join('\n'), VARS: Object.entries(vars).map(([k, v]) => `  --${k}: ${v};`).join('\n') }));

  const url = `https://${C.host}/`;
  const card = ([ic, h, p]) => `<article class="card"><div class="ic" aria-hidden="true">${esc(ic)}</div><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`;
  const langs = C.languages.length > 1
    ? `<div class="langs" role="group" aria-label="${esc(T.langLabel)}">${C.languages.map((l) => `<button data-lang="${l}">${l.toUpperCase()}</button>`).join('')}</div>`
    : '';
  const shots = C.images.shots.map((_, i) => `<img data-shot="${i + 1}" src="/img/${def}-${i + 1}.jpg" alt="" loading="lazy" />`).join('');
  writeFileSync(join(pub, 'index.html'), fill('index.html', {
    LANG: def, TITLE: esc(T.title), DESCRIPTION: esc(T.description), THEME_COLOR: th.bg2, URL: url, NAME: esc(C.name),
    LANG_BUTTONS: langs, TAGLINE: esc(T.tagline), PLAY_URL: `https://play.google.com/store/apps/details?id=${C.package}`,
    BADGE_ALT: esc(T.badgeAlt), FREE: esc(T.free), RATING: C.rating ? `<span class="fact">${esc(C.rating)}</span>` : '',
    SHOTS_TITLE: esc(T.shotsTitle), SHOTS_LABEL: esc(T.shotsLabel), SHOTS: shots, FEAT_TITLE: esc(T.featTitle),
    FEATURES: T.features.map(card).join(''), NOTE: esc(T.note), FINAL_TITLE: esc(T.finalTitle), YEAR: String(C.year),
    PUBLISHER: esc(C.publisher), FOOTER_NOTE: esc(T.footerNote), PRIVACY_URL: esc(C.privacyPolicy), PRIVACY: esc(T.privacy),
    CONTACT: esc(T.contact), EMAIL: esc(C.contactEmail),
  }));
  writeFileSync(join(pub, '404.html'), fill('404.html', { LANG: def, NAME: esc(C.name), NOT_FOUND: esc(T.notFound), HOME: esc(T.home) }));
  const texts = Object.fromEntries(C.languages.map((l) => [l, C.texts[l]]));
  writeFileSync(join(pub, 'app.js'), fill('app.js', { TEXTS: JSON.stringify(texts, null, 2) }));
  copyFileSync(join(TPL, '_headers'), join(pub, '_headers'));
  writeFileSync(join(pub, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  const adsLines = [...(C.admobPublisherIds || []).map((p) => `google.com, ${p}, DIRECT, ${GOOGLE_TAG}`), ...(C.appAdsExtraLines || [])];
  if (adsLines.length) writeFileSync(join(pub, 'app-ads.txt'), adsLines.join('\n') + '\n');
  else warn('no admobPublisherIds: app-ads.txt not written');

  writeFileSync(join(out, 'wrangler.jsonc'), `// Generated by app-website (site.mjs build). Static files only: no Worker code runs, so the
// requests are free and unlimited on the Workers Free plan. The custom domain also creates the
// DNS record and the certificate.
${JSON.stringify({
  name: `${C.slug}-site`,
  ...(C.cloudflareAccountId ? { account_id: C.cloudflareAccountId } : {}),
  compatibility_date: C.compatibilityDate,
  assets: { directory: './public', not_found_handling: '404-page' },
  routes: [{ pattern: C.host, custom_domain: true }],
  workers_dev: false,
  preview_urls: false,
}, null, 2)}\n`);

  const files = [];
  (function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : files.push(statSync(p).size); } })(pub);
  console.log(`built ${files.length} files (${(files.reduce((a, b) => a + b, 0) / 1e6).toFixed(1)} MB) in ${C.out || 'site'}/public for https://${C.host}`);
  console.log(`preview: cd ${C.out || 'site'} && npx wrangler dev --port 8790   deploy: npx wrangler deploy`);
}

// ---------- check ----------

function get(url, ip, ua = 'Mozilla/5.0') {
  const lib = url.startsWith('https:') ? https : http;
  const lookup = (h, o, cb) => (o?.all ? cb(null, [{ address: ip, family: 4 }]) : cb(null, ip, 4));
  return new Promise((ok, ko) => {
    const req = lib.get(url, { headers: { 'user-agent': ua }, lookup, timeout: 10000 }, (r) => {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', (c) => (body += c));
      r.on('end', () => ok({ status: r.statusCode, type: r.headers['content-type'] || '', location: r.headers.location, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', ko);
  });
}

async function verify(host, opts) {
  host = host.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  let ok = true;
  const say = (good, msg) => { if (!good) ok = false; console.log(`${good ? '✓' : '✗'} ${msg}`); };
  const dns = await (await fetch(`https://cloudflare-dns.com/dns-query?name=${host}&type=A`, { headers: { accept: 'application/dns-json' } })).json();
  const ips = (dns.Answer || []).filter((a) => a.type === 1).map((a) => a.data);
  say(ips.length > 0, `public DNS ${host}: ${ips.join(', ') || 'no A record (not deployed, or the zone is not on Cloudflare yet)'}`);
  if (!ips.length) return false;
  const home = await get(`https://${host}/`, ips[0]);
  say(home.status === 200, `https://${host}/ -> ${home.status}`);
  const r = await get(`https://${host}/app-ads.txt`, ips[0], GOOGLEBOT);
  say(r.status === 200 && r.type.startsWith('text/plain'), `https://${host}/app-ads.txt as Googlebot -> ${r.status} ${r.type}`);
  const plain = await get(`http://${host}/app-ads.txt`, ips[0], GOOGLEBOT).catch((e) => ({ status: e.message }));
  console.log(`  (http -> ${plain.status}${plain.location ? ` ${plain.location}` : ''}; AdMob tries https first)`);
  if (r.status === 200) {
    const lines = r.body.split(/\r?\n/).map((l) => l.replace(/#.*/, '').trim()).filter(Boolean);
    const bad = lines.filter((l) => !/^[a-z]+=/i.test(l) && !/^[a-z0-9.-]+\s*,\s*[^,\s]+\s*,\s*(DIRECT|RESELLER)\s*(,\s*[a-z0-9]+)?$/i.test(l));
    say(lines.length > 0 && !bad.length, `app-ads.txt: ${lines.length} line(s)${bad.length ? `, malformed: ${bad.join(' | ')}` : ''}`);
    if (opts.pub) {
      const want = `google.com, ${opts.pub}, DIRECT, ${GOOGLE_TAG}`;
      say(lines.some((l) => l.replace(/\s*,\s*/g, ', ') === want), `contains "${want}"`);
    }
  }
  if (opts.package) {
    const page = await fetch(`https://play.google.com/store/apps/details?id=${opts.package}&hl=en`, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = page.ok ? await page.text() : '';
    say(page.ok && html.includes(host), page.ok ? `Play listing of ${opts.package} ${html.includes(host) ? 'shows' : 'does not show (yet)'} ${host}` : `Play listing of ${opts.package} -> ${page.status} (not public yet)`);
  }
  return ok;
}

// ---------- main ----------

const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
try {
  if (cmd === 'init') init(args[0] || 'site.config.json');
  else if (cmd === 'build') await build(args[0] || 'site.config.json');
  else if (cmd === 'check' && args[0] && !args[0].startsWith('--')) process.exit((await verify(args[0], { pub: flag('--pub'), package: flag('--package') })) ? 0 : 1);
  else {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    process.exit(cmd ? 1 : 0);
  }
} catch (e) {
  console.error(`✗ ${e.message}`);
  process.exit(1);
}
