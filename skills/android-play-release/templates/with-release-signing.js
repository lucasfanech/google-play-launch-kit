// Expo config plugin: sign Android release builds with the Play upload key instead of the debug key.
// Copy to <project>/plugins/with-release-signing.js, set PREFIX to release.config.json's
// "signingPrefix", and add "./plugins/with-release-signing" to app.json "plugins".
// The key never lives in the repo: path and passwords come from ~/.gradle/gradle.properties
// (<PREFIX>_STORE_FILE, _STORE_PASSWORD, _KEY_ALIAS, _KEY_PASSWORD). Without them, release falls
// back to debug signing (fine for local runs, rejected by `release.mjs build`).
const { withAppBuildGradle } = require('expo/config-plugins');

const PREFIX = 'MYAPP_UPLOAD';
const MARK = '// @release-signing';

const SIGNING = `
        release { ${MARK}
            if (project.hasProperty('${PREFIX}_STORE_FILE')) {
                storeFile file(${PREFIX}_STORE_FILE)
                storePassword ${PREFIX}_STORE_PASSWORD
                keyAlias ${PREFIX}_KEY_ALIAS
                keyPassword ${PREFIX}_KEY_PASSWORD
            }
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, cfg => {
    let src = cfg.modResults.contents;
    if (src.includes(MARK)) return cfg;
    src = src.replace(/(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/, `$1${SIGNING}`);
    src = src.replace(
      /(release\s*\{[^{}]*?)signingConfig signingConfigs\.debug/,
      `$1signingConfig project.hasProperty('${PREFIX}_STORE_FILE') ? signingConfigs.release : signingConfigs.debug`,
    );
    cfg.modResults.contents = src;
    return cfg;
  });
};
