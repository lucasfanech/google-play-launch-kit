#!/usr/bin/env node
// Generic Google Play release helper for Expo (CNG) projects. Run from the project root:
//   node ~/.claude/skills/android-play-release/scripts/release.mjs <command> [arg]
//
//   init                     write release.config.json with guessed values (edit it once)
//   status                   version, versionCode, last v* tag, branch, clean?, commits since tag
//   bump <patch|minor|major|x.y.z|none>   app.json version (+ android.versionCode, except "none")
//   notes-check <file>       release notes: every configured language present, <= 500 chars
//   keystore                 create the upload key (~/.android-keys/<slug>-upload.jks) and its
//                            Gradle properties in ~/.gradle/gradle.properties (passwords never printed)
//   build                    expo prebuild + signed bundleRelease, checks the signer, copies to dist/releases/
//   smoke                    assembleRelease (R8 on) -> install on the running emulator -> launch -> crash check
//
// release.config.json: { "slug", "package", "languages": ["fr-FR", ...], "signingPrefix": "MYAPP_UPLOAD",
//                        "certName": "My Studio", "javaHome"?, "androidHome"?, "abi"? }
import { execFileSync, execSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, appendFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const ROOT = process.cwd();
const APP = join(ROOT, 'app.json');
const CFG_FILE = join(ROOT, 'release.config.json');
const sh = (cmd, opts = {}) => (execSync(cmd, { cwd: ROOT, encoding: 'utf8', ...opts }) ?? '').trim();
const readApp = () => JSON.parse(readFileSync(APP, 'utf8'));
const cfg = () => {
  if (!existsSync(CFG_FILE)) throw new Error('release.config.json missing: run `init` first');
  const c = JSON.parse(readFileSync(CFG_FILE, 'utf8'));
  return {
    javaHome: ['/Applications/Android Studio.app/Contents/jbr/Contents/Home', process.env.JAVA_HOME].find(p => p && existsSync(p)),
    androidHome: process.env.ANDROID_HOME || join(homedir(), 'Library/Android/sdk'),
    abi: 'arm64-v8a', ...c,
  };
};
const env = c => ({ ...process.env, JAVA_HOME: c.javaHome, ANDROID_HOME: c.androidHome, NODE_ENV: 'production' });
const lastTag = () => { try { return sh('git describe --tags --abbrev=0 --match "v*"', { stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };

function init() {
  if (existsSync(CFG_FILE)) return console.log('release.config.json already exists');
  const { expo } = readApp();
  const slug = (expo.slug || expo.name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const c = { slug, package: expo.android?.package, languages: ['en-US'], signingPrefix: slug.replace(/-/g, '_').toUpperCase() + '_UPLOAD', certName: expo.name };
  writeFileSync(CFG_FILE, JSON.stringify(c, null, 2) + '\n');
  console.log('wrote release.config.json - set "languages" to the store listing locales:\n' + JSON.stringify(c, null, 2));
}

function status() {
  const { expo } = readApp(), tag = lastTag();
  console.log(JSON.stringify({
    version: expo.version, versionCode: expo.android?.versionCode, package: expo.android?.package, lastTag: tag,
    branch: sh('git rev-parse --abbrev-ref HEAD'), clean: sh('git status --porcelain') === '',
    commits: sh(`git log ${tag ? `${tag}..HEAD` : 'HEAD'} --no-merges --pretty=format:%h\\ %s`).split('\n').filter(Boolean),
  }, null, 2));
}

function bump(kind) {
  const app = readApp(), cur = app.expo.version.split('.').map(Number);
  const next = kind === 'none' ? cur : /^\d+\.\d+\.\d+$/.test(kind) ? kind.split('.').map(Number)
    : kind === 'major' ? [cur[0] + 1, 0, 0] : kind === 'minor' ? [cur[0], cur[1] + 1, 0]
    : kind === 'patch' ? [cur[0], cur[1], cur[2] + 1] : null;
  if (!next) throw new Error(`unknown bump "${kind}"`);
  app.expo.version = next.join('.');
  app.expo.android = app.expo.android || {};
  // every upload needs a strictly higher versionCode; "none" is only for the very first release
  if (kind !== 'none') app.expo.android.versionCode = (app.expo.android.versionCode || 0) + 1;
  else app.expo.android.versionCode = app.expo.android.versionCode || 1;
  writeFileSync(APP, JSON.stringify(app, null, 2) + '\n');
  console.log(`${app.expo.version} (versionCode ${app.expo.android.versionCode})`);
}

function notesCheck(file) {
  const txt = readFileSync(file, 'utf8');
  let ok = true;
  for (const l of cfg().languages) {
    const m = txt.match(new RegExp(`<${l}>\\n([\\s\\S]*?)\\n</${l}>`));
    const n = m ? [...m[1]].length : -1;
    if (n < 1 || n > 500) ok = false;
    console.log(`${l}: ${m ? `${n} chars` : 'missing'}${n > 500 ? '  <-- over 500' : ''}`);
  }
  if (!ok) process.exit(1);
}

function keystore() {
  const c = cfg();
  const props = join(homedir(), '.gradle/gradle.properties');
  if (existsSync(props) && readFileSync(props, 'utf8').includes(`${c.signingPrefix}_STORE_FILE`)) return console.log('upload key already configured');
  const dir = join(homedir(), '.android-keys'), ks = join(dir, `${c.slug}-upload.jks`);
  if (existsSync(ks)) throw new Error(`${ks} exists but no Gradle properties point to it - restore them instead of creating a new key`);
  mkdirSync(dir, { recursive: true }); chmodSync(dir, 0o700);
  const pw = randomBytes(21).toString('base64').replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  execFileSync(join(c.javaHome, 'bin/keytool'), ['-genkeypair', '-storetype', 'PKCS12', '-keystore', ks, '-alias', 'upload', '-keyalg', 'RSA',
    '-keysize', '4096', '-validity', '10000', '-storepass', pw, '-keypass', pw, '-dname', `CN=${c.certName}, O=${c.certName}`], { stdio: 'ignore' });
  chmodSync(ks, 0o600);
  mkdirSync(dirname(props), { recursive: true });
  appendFileSync(props, `\n# ${c.slug}: Play upload key (back up this block and the .jks)\n${c.signingPrefix}_STORE_FILE=${ks}\n` +
    `${c.signingPrefix}_STORE_PASSWORD=${pw}\n${c.signingPrefix}_KEY_ALIAS=upload\n${c.signingPrefix}_KEY_PASSWORD=${pw}\n`);
  chmodSync(props, 0o600);
  console.log(`upload key created: ${ks} (properties in ~/.gradle/gradle.properties) - tell the user to back both up`);
}

function prebuild(c) { sh('npx expo prebuild --platform android --no-install', { stdio: 'inherit', env: env(c) }); }

function build() {
  const c = cfg();
  const props = join(homedir(), '.gradle/gradle.properties');
  if (!existsSync(props) || !readFileSync(props, 'utf8').includes(`${c.signingPrefix}_STORE_FILE`)) throw new Error('upload key not configured: run `keystore`');
  prebuild(c);
  execFileSync('./gradlew', ['bundleRelease'], { cwd: join(ROOT, 'android'), stdio: 'inherit', env: env(c) });
  const aab = join(ROOT, 'android/app/build/outputs/bundle/release/app-release.aab');
  const cert = execFileSync(join(c.javaHome, 'bin/keytool'), ['-printcert', '-jarfile', aab], { encoding: 'utf8' });
  if (!cert.includes(`CN=${c.certName}`)) throw new Error('AAB is not signed with the upload key (debug key?) - check the signing plugin');
  const { expo } = readApp();
  const out = join(ROOT, 'dist/releases', `${c.slug}-v${expo.version}-${expo.android.versionCode}.aab`);
  mkdirSync(dirname(out), { recursive: true });
  copyFileSync(aab, out);
  console.log(`signed AAB: ${out}`);
}

function smoke() {
  const c = cfg(), adb = join(c.androidHome, 'platform-tools/adb'), pkg = c.package || readApp().expo.android.package;
  prebuild(c);
  execFileSync('./gradlew', ['assembleRelease', `-PreactNativeArchitectures=${c.abi}`], { cwd: join(ROOT, 'android'), stdio: 'inherit', env: env(c) });
  const apk = join(ROOT, 'android/app/build/outputs/apk/release/app-release.apk');
  execFileSync(adb, ['install', '-r', apk], { stdio: 'inherit' });
  execFileSync(adb, ['logcat', '-c']);
  execFileSync(adb, ['shell', 'monkey', '-p', pkg, '-c', 'android.intent.category.LAUNCHER', '1'], { stdio: 'ignore' });
  execSync('sleep 25');
  const pid = execFileSync(adb, ['shell', 'pidof', pkg], { encoding: 'utf8' }).trim();
  const crash = execFileSync(adb, ['logcat', '-d', '-b', 'crash'], { encoding: 'utf8' }).trim();
  console.log(`pid: ${pid || 'NOT RUNNING'}\n${crash || 'crash buffer empty'}`);
  console.log('Now tap through every screen (adb shell input tap / screenshots), then rerun `adb logcat -d -b crash`.');
  if (!pid || crash) process.exit(1);
}

const [cmd, arg] = process.argv.slice(2);
const run = { init, status, bump: () => bump(arg), 'notes-check': () => notesCheck(arg), keystore, build, smoke }[cmd];
if (run) run();
else console.log('usage: init | status | bump <kind> | notes-check <file> | keystore | build | smoke');
