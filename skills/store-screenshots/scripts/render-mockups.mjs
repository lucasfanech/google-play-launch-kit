#!/usr/bin/env node
// Store marketing visuals from raw captures: captioned phone/tablet screenshots (9:16),
// feature graphic (1024x500) and 512 px icon - all driven by a JSON config.
//
//   node ~/.claude/skills/store-screenshots/scripts/render-mockups.mjs [config] [filter]
//     config  default: store/mockups.config.json (paths inside it are relative to the cwd)
//     filter  optional: "phone-fr", "tablet-en", "feature-it" to render a subset
//
// Needs Google Chrome (headless screenshot). JPEG conversion: macOS `sips` or ImageMagick.
// See ../references/mockups.config.example.json for every option.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const cwd = process.cwd();
const cfgPath = resolve(cwd, process.argv[2] || 'store/mockups.config.json');
const only = process.argv[3];
const C = JSON.parse(readFileSync(cfgPath, 'utf8'));
const P = p => resolve(cwd, p);
const url = p => 'file://' + P(p);

const CHROME = [process.env.CHROME, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find(p => p && existsSync(p));
if (!CHROME) throw new Error('Google Chrome not found (set CHROME=/path/to/chrome)');

const OUT = P(C.out || 'store/play'), RAW = C.raw || 'store/raw', TMP = P(join(C.out || 'store/play', '../.tmp-mockups'));
const T = { ink: '#1B2140', bg1: '#FF9B1F', bg2: '#F78502', bg3: '#E86F00', glow: '#FFD27A', accent: '#FFC531', title: '#FFFFFF', pill: '#FFFFFF', ...C.theme };
const RAYS = C.theme?.rays !== false;
// capture sizes of the raw screenshots and canvas sizes accepted by Play (9:16)
const DEVICES = {
  phone: { w: 1080, h: 1920, frameW: 760, top: 500, title: 118, sub: 40, radius: 70, bezel: 22, captureW: 1080, captureH: 2400, crop: 0, ...C.devices?.phone },
  tablet: { w: 1440, h: 2560, frameW: 1110, top: 640, title: 150, sub: 52, radius: 60, bezel: 26, captureW: 1600, captureH: 2560, crop: 125, ...C.devices?.tablet },
};
const devices = C.devicesToRender || Object.keys(DEVICES);

const font = (name, f, weight = 400) => f ? `@font-face { font-family: ${name}; font-weight: ${weight}; src: url('${url(f)}'); }` : '';
const BASE_CSS = `
${font('Display', C.fonts?.display)} ${font('Body', C.fonts?.body, 700)}
* { box-sizing: border-box; margin: 0; }
html, body { width: 100%; height: 100%; overflow: hidden; background: ${T.bg2}; }
.bg { position: absolute; inset: 0; background:
  radial-gradient(circle at 50% 38%, ${T.glow}cc 0, ${T.glow}55 22%, transparent 60%),
  ${RAYS ? `repeating-conic-gradient(from 0deg at 50% 38%, #ffffff1f 0 7deg, transparent 7deg 18deg),` : ''}
  linear-gradient(${T.bg1}, ${T.bg2} 55%, ${T.bg3}); }
.out { font-family: Display, 'Arial Black', sans-serif; color: ${T.title}; -webkit-text-stroke: var(--stroke) ${T.ink}; paint-order: stroke fill;
  text-shadow: 0 var(--drop) 0 ${T.ink}; letter-spacing: .01em; line-height: .98; }
.pill { font-family: Body, 'Helvetica Neue', Arial, sans-serif; font-weight: 700; color: ${T.ink}; background: ${T.pill}; border-style: solid; border-color: ${T.ink}; border-radius: 999px; }
`;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function screenHtml(dev, lang, s) {
  const d = DEVICES[dev], [l1, l2, sub] = C.copy[lang][s.key];
  const img = url(`${RAW}/${dev}/${lang}/${s.file}`);
  const capH = d.captureH - d.crop;
  const innerW = d.frameW - d.bezel * 2, innerH = Math.round(innerW * capH / d.captureW);
  const tilt = s.side === 'left' ? 2.5 : s.side === 'right' ? -2.5 : 0;
  const fit = (t, base) => Math.min(base, Math.floor(base * 11 / Math.max(11, [...t].length)));
  const hero = s.hero ? `<img class="hero ${s.side || 'right'}" src="${url(s.hero)}">` : '';
  const burst = s.burst ? `<div class="burst"><span class="out">${esc(s.burst)}</span></div>` : '';
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
  body { width: ${d.w}px; height: ${d.h}px; position: relative; }
  .cap { position: absolute; top: ${Math.round(d.h * .045)}px; left: 0; right: 0; display: flex; flex-direction: column; align-items: center; gap: ${Math.round(d.sub * .5)}px; text-align: center; }
  .t1 { font-size: ${fit(l1, d.title)}px; --stroke: ${Math.round(d.title / 7)}px; --drop: ${Math.round(d.title / 14)}px; }
  .t2 { font-size: ${fit(l2 || '', d.title * 1.12)}px; --stroke: ${Math.round(d.title / 6.5)}px; --drop: ${Math.round(d.title / 12)}px; color: ${T.accent}; }
  .sub { font-size: ${d.sub}px; border-width: ${Math.round(d.sub / 9)}px; padding: ${Math.round(d.sub * .28)}px ${Math.round(d.sub * .8)}px; box-shadow: 0 ${Math.round(d.sub / 7)}px 0 ${T.ink}; margin-top: ${Math.round(d.sub * .3)}px; }
  .frame { position: absolute; left: 50%; top: ${d.top}px; width: ${d.frameW}px; padding: ${d.bezel}px; background: ${T.ink}; border-radius: ${d.radius}px;
    transform: translateX(-50%) rotate(${tilt}deg); box-shadow: 0 30px 0 ${T.ink}33, 0 0 0 ${Math.round(d.bezel / 3)}px #ffffff55; }
  .screen { width: ${innerW}px; height: ${innerH}px; border-radius: ${d.radius - d.bezel}px; overflow: hidden; background: url('${img}') top / 100% auto no-repeat; }
  .hero { position: absolute; width: ${Math.round(d.w * .54)}px; bottom: ${Math.round(d.h * .02)}px; filter: drop-shadow(0 18px 0 ${T.ink}40) drop-shadow(0 0 2px ${T.ink}); }
  .hero.right { right: -${Math.round(d.w * .06)}px; } .hero.left { left: -${Math.round(d.w * .06)}px; transform: scaleX(-1); }
  .burst { position: absolute; left: ${Math.round(d.w * .02)}px; top: ${d.top + Math.round(d.h * .1)}px; width: ${Math.round(d.w * .3)}px; aspect-ratio: 1;
    display: grid; place-items: center; transform: rotate(-12deg); background: ${T.accent};
    clip-path: polygon(50% 0,61% 22%,85% 10%,79% 36%,100% 50%,79% 63%,86% 90%,61% 78%,50% 100%,39% 78%,14% 90%,21% 63%,0 50%,21% 37%,15% 10%,39% 22%); }
  .burst span { font-size: ${Math.round(d.w * .075)}px; --stroke: ${Math.round(d.w * .012)}px; --drop: ${Math.round(d.w * .006)}px; }
  </style><div class="bg"></div>
  <div class="frame"><div class="screen"></div></div>${hero}${burst}
  <div class="cap"><div class="out t1">${esc(l1)}</div>${l2 ? `<div class="out t2">${esc(l2)}</div>` : ''}${sub ? `<div class="pill sub">${esc(sub)}</div>` : ''}</div>`;
}

function featureHtml(lang) {
  const F = C.feature || {}, [a, b] = C.copy[lang].feature || ['', ''], [n1, n2] = F.title || [C.name || '', ''];
  return `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
  body { width: 1024px; height: 500px; position: relative; }
  .bg { background: radial-gradient(circle at 78% 50%, ${T.glow}cc 0, transparent 55%), ${RAYS ? `repeating-conic-gradient(from 0deg at 78% 50%, #ffffff1f 0 7deg, transparent 7deg 18deg),` : ''} linear-gradient(${T.bg1}, ${T.bg2} 60%, ${T.bg3}); }
  .art { position: absolute; right: -40px; top: -40px; width: 580px; height: 580px; background: url('${url(F.art || C.icon)}') center / cover;
    -webkit-mask-image: radial-gradient(circle at 55% 52%, #000 52%, transparent 70%); }
  .txt { position: absolute; left: 56px; top: 0; bottom: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; width: 520px; }
  .l1 { font-size: ${F.size1 || 92}px; --stroke: 14px; --drop: 7px; } .l2 { font-size: ${F.size2 || 104}px; --stroke: 15px; --drop: 8px; color: ${T.accent}; }
  .tag { font-size: 25px; border-width: 4px; padding: 8px 20px; box-shadow: 0 5px 0 ${T.ink}; align-self: flex-start; margin-top: 18px; line-height: 1.15; }
  </style><div class="bg"></div><div class="art"></div>
  <div class="txt"><div class="out l1">${esc(n1)}</div>${n2 ? `<div class="out l2">${esc(n2)}</div>` : ''}${a ? `<div class="pill tag">${esc(a)}${b ? '<br>' + esc(b) : ''}</div>` : ''}</div>`;
}

function shoot(html, name, w, h) {
  const page = join(TMP, name + '.html'), png = join(TMP, name + '.png');
  writeFileSync(page, html);
  execFileSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1',
    `--window-size=${w},${h}`, '--virtual-time-budget=4000', `--screenshot=${png}`, 'file://' + page], { stdio: 'ignore' });
  return png;
}
/** Play wants JPEG or 24-bit PNG without alpha */
function toJpeg(png, out) {
  mkdirSync(dirname(out), { recursive: true });
  try { execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '92', png, '--out', out], { stdio: 'ignore' }); }
  catch { execFileSync('magick', [png, '-background', 'white', '-flatten', '-quality', '92', out], { stdio: 'ignore' }); }
}

rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true });
let n = 0;
for (const lang of C.languages) {
  for (const dev of devices) {
    if (only && only !== `${dev}-${lang}`) continue;
    C.screens.forEach((s, i) => {
      const d = DEVICES[dev];
      toJpeg(shoot(screenHtml(dev, lang, s), `${dev}-${lang}-${i}`, d.w, d.h), join(OUT, lang, dev, `${i + 1}-${s.key}.jpg`)); n++;
    });
  }
  if ((!only || only === `feature-${lang}`) && C.copy[lang].feature !== undefined) {
    toJpeg(shoot(featureHtml(lang), `feature-${lang}`, 1024, 500), join(OUT, lang, 'feature-graphic.jpg')); n++;
  }
}
if (!only && C.icon) {
  const out = join(OUT, 'icon-512.png');
  try { execFileSync('sips', ['-z', '512', '512', P(C.icon), '--out', out], { stdio: 'ignore' }); }
  catch { execFileSync('magick', [P(C.icon), '-resize', '512x512!', out], { stdio: 'ignore' }); }
  n++;
}
rmSync(TMP, { recursive: true, force: true });
console.log(`${n} visuals written to ${OUT}`);
