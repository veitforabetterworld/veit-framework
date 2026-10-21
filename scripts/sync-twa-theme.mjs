#!/usr/bin/env node
/**
 * Brand-Farben und Host in Vite-, HTML- und TWA-Dateien.
 * Host setzt TWA_ROOT, TWA_HOST, TWA_THEME, TWA_BACKGROUND, TWA_NAV.
 * TWA_CHECK=1 nur prüfen. Pfade relativ zu TWA_ROOT, Defaults = ScanGut-Struktur.
 */
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.env.TWA_ROOT;
const host = process.env.TWA_HOST;
const THEME_HEX = process.env.TWA_THEME;
const BACKGROUND_HEX = process.env.TWA_BACKGROUND;
const NAV_CHROME_HEX = process.env.TWA_NAV;
const checkOnly = process.env.TWA_CHECK === '1';

if (!repoRoot || !host || !THEME_HEX || !BACKGROUND_HEX || !NAV_CHROME_HEX) {
  console.error('sync-twa-theme: TWA_ROOT, TWA_HOST, TWA_THEME, TWA_BACKGROUND, TWA_NAV erforderlich');
  process.exit(1);
}

const TARGETS = {
  viteConfig: path.join(repoRoot, process.env.TWA_PATH_VITE ?? path.join('apps', 'web', 'vite.config.ts')),
  indexHtml: path.join(repoRoot, process.env.TWA_PATH_INDEX ?? path.join('apps', 'web', 'index.html')),
  twaManifest: path.join(repoRoot, process.env.TWA_PATH_TWA ?? path.join('android-twa', 'twa-manifest.json')),
  appBuildGradle: path.join(
    repoRoot,
    process.env.TWA_PATH_GRADLE ?? path.join('android-twa', 'app', 'build.gradle'),
  ),
  assetStatements: path.join(
    repoRoot,
    process.env.TWA_PATH_STRINGS ?? path.join('android-twa', 'app', 'src', 'main', 'res', 'values', 'strings.xml'),
  ),
  webAppManifest: path.join(
    repoRoot,
    process.env.TWA_PATH_WEBMANIFEST ??
      path.join('android-twa', 'app', 'src', 'main', 'res', 'raw', 'web_app_manifest.json'),
  ),
};

function readUtf8(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeUtf8(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function applyOrCheck(filePath, source, next, label = filePath) {
  if (checkOnly) {
    if (source !== next) throw new Error(`Drift: ${path.relative(repoRoot, label)} (pnpm sync:twa)`);
    return;
  }
  if (source !== next) {
    writeUtf8(filePath, next);
    console.log(`Synced ${path.relative(repoRoot, filePath)}`);
  }
}

function syncIndexHtml(filePath) {
  const source = readUtf8(filePath);
  const expectedMeta = `<meta name="theme-color" content="${THEME_HEX}" />`;
  const next = source.replace(/<meta name="theme-color" content="[^"]*" \/>/, expectedMeta);
  if (!next.includes(expectedMeta)) {
    throw new Error(`theme-color meta nicht gefunden in ${path.relative(repoRoot, filePath)}`);
  }
  applyOrCheck(filePath, source, next);
}

function syncTwaManifest(filePath) {
  const twa = JSON.parse(readUtf8(filePath));
  if (!twa.appVersionName || typeof twa.appVersionCode !== 'number') {
    throw new Error(
      'twa-manifest.json braucht appVersionName (string) und appVersionCode (number) — einzige Versionsquelle',
    );
  }
  const baseUrl = `https://${host}`;
  const next = {
    ...twa,
    host,
    themeColor: THEME_HEX,
    backgroundColor: BACKGROUND_HEX,
    themeColorDark: NAV_CHROME_HEX,
    navigationColor: NAV_CHROME_HEX,
    navigationColorDark: NAV_CHROME_HEX,
    navigationDividerColor: NAV_CHROME_HEX,
    navigationDividerColorDark: NAV_CHROME_HEX,
    iconUrl: `${baseUrl}/icon-512.png`,
    maskableIconUrl: `${baseUrl}/icon-512.png`,
    webManifestUrl: `${baseUrl}/manifest.webmanifest`,
    fullScopeUrl: `${baseUrl}/`,
    // Bubblewrap-Feld appVersion = Anzeigename; immer aus appVersionName ableiten
    appVersion: twa.appVersionName,
  };
  const serialized = `${JSON.stringify(next, null, 2)}\n`;
  applyOrCheck(filePath, readUtf8(filePath), serialized);
}

function assertGradleUsesManifestVersion(filePath) {
  if (!fs.existsSync(filePath)) return;
  const source = readUtf8(filePath);
  if (!source.includes('twaManifestJson.appVersionCode') || !source.includes('twaManifestJson.appVersionName')) {
    throw new Error(
      'app/build.gradle muss versionCode/versionName aus twa-manifest.json lesen (twaManifestJson.appVersion*)',
    );
  }
  if (/\bversionCode\s+\d+\b/.test(source) || /\bversionName\s+"[^"]+"/.test(source)) {
    throw new Error(
      'Hardcodierte versionCode/versionName in app/build.gradle — nur in twa-manifest.json pflegen',
    );
  }
}

function syncAppBuildGradle(filePath) {
  if (!fs.existsSync(filePath)) return;
  const baseUrl = `https://${host}`;
  const source = readUtf8(filePath);
  const next = source
    .replace(/hostName: '[^']+'/, `hostName: '${host}'`)
    .replace(/themeColor: '[^']+'/, `themeColor: '${THEME_HEX}'`)
    .replace(/themeColorDark: '[^']+'/, `themeColorDark: '${NAV_CHROME_HEX}'`)
    .replace(/navigationColor: '[^']+'/, `navigationColor: '${NAV_CHROME_HEX}'`)
    .replace(/navigationColorDark: '[^']+'/, `navigationColorDark: '${NAV_CHROME_HEX}'`)
    .replace(/navigationDividerColor: '[^']+'/, `navigationDividerColor: '${NAV_CHROME_HEX}'`)
    .replace(/navigationDividerColorDark: '[^']+'/, `navigationDividerColorDark: '${NAV_CHROME_HEX}'`)
    .replace(/backgroundColor: '[^']+'/, `backgroundColor: '${BACKGROUND_HEX}'`)
    .replace(
      /resValue "string", "webManifestUrl", '[^']+'/,
      `resValue "string", "webManifestUrl", '${baseUrl}/manifest.webmanifest'`,
    )
    .replace(
      /resValue "string", "fullScopeUrl", '[^']+'/,
      `resValue "string", "fullScopeUrl", '${baseUrl}/'`,
    );
  applyOrCheck(filePath, source, next);
}

function syncAssetStatements(filePath) {
  if (!fs.existsSync(filePath)) return;
  const baseUrl = `https://${host}`;
  const source = readUtf8(filePath);
  const next = source.replace(
    /\\"site\\": \\"https:\/\/[^\\"]+\\"/,
    `\\"site\\": \\"${baseUrl}\\"`,
  );
  applyOrCheck(filePath, source, next);
}

function syncWebAppManifest(filePath) {
  if (!fs.existsSync(filePath)) return;
  const manifest = JSON.parse(readUtf8(filePath));
  const next = {
    ...manifest,
    theme_color: THEME_HEX,
    background_color: BACKGROUND_HEX.toLowerCase(),
  };
  // Bubblewrap stores this as a single line.
  const serialized = `${JSON.stringify(next)}\n`;
  applyOrCheck(filePath, readUtf8(filePath), serialized);
}

function syncViteConfig(filePath) {
  const source = readUtf8(filePath);
  // vite.config loads brand from scangut.json at runtime — no hardcoded colors to sync.
  // Keep the no-op so --check stays stable when literals appear again.
  const next = source
    .replace(/theme_color: '[^']+'/, `theme_color: '${THEME_HEX}'`)
    .replace(/background_color: '[^']+'/, `background_color: '${BACKGROUND_HEX.toLowerCase()}'`);
  applyOrCheck(filePath, source, next);
}

function main() {
  syncViteConfig(TARGETS.viteConfig);
  syncIndexHtml(TARGETS.indexHtml);
  syncTwaManifest(TARGETS.twaManifest);
  syncAppBuildGradle(TARGETS.appBuildGradle);
  assertGradleUsesManifestVersion(TARGETS.appBuildGradle);
  syncAssetStatements(TARGETS.assetStatements);
  syncWebAppManifest(TARGETS.webAppManifest);
  if (checkOnly) console.log('TWA theme sync check OK.');
}

main();
