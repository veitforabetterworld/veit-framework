#!/usr/bin/env node
/**
 * Kopiert ein Web-Manifest in die Android-TWA-Rohdatei und filtert Icons.
 * Host setzt TWA_MANIFEST_SOURCE, TWA_MANIFEST_TARGET, TWA_NAME,
 * TWA_FALLBACK_THEME, TWA_FALLBACK_BACKGROUND.
 */
import fs from 'node:fs';
import path from 'node:path';

const sourcePath = process.env.TWA_MANIFEST_SOURCE;
const targetPath = process.env.TWA_MANIFEST_TARGET;
const appName = process.env.TWA_NAME ?? 'App';
const fallbackTheme = process.env.TWA_FALLBACK_THEME ?? '#000000';
const fallbackBackground = process.env.TWA_FALLBACK_BACKGROUND ?? '#ffffff';

if (!sourcePath || !targetPath) {
  console.error('sync-android-web-manifest: TWA_MANIFEST_SOURCE und TWA_MANIFEST_TARGET erforderlich');
  process.exit(1);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function pickAndroidManifest(webManifest) {
  const icons = Array.isArray(webManifest.icons)
    ? webManifest.icons.filter((icon) => typeof icon?.src === 'string' && icon.src.toLowerCase().includes('icon'))
    : [];
  const svgIcon = icons.find((icon) => String(icon.type ?? '').toLowerCase() === 'image/svg+xml');
  const androidIcons = svgIcon
    ? [{ src: svgIcon.src, type: 'image/svg+xml', sizes: svgIcon.sizes ?? 'any', purpose: svgIcon.purpose ?? 'any' }]
    : [{ src: 'icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' }];

  return {
    name: webManifest.name ?? appName,
    short_name: webManifest.short_name ?? webManifest.name ?? appName,
    description: webManifest.description ?? '',
    start_url: webManifest.start_url ?? process.env.TWA_FALLBACK_START_URL ?? '/',
    display: webManifest.display ?? 'standalone',
    orientation: webManifest.orientation ?? 'portrait-primary',
    background_color: webManifest.background_color ?? fallbackBackground,
    theme_color: webManifest.theme_color ?? fallbackTheme,
    icons: androidIcons,
  };
}

if (!fs.existsSync(sourcePath)) {
  throw new Error(`Source manifest missing: ${sourcePath}`);
}
const androidManifest = pickAndroidManifest(readJson(sourcePath));
fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, `${JSON.stringify(androidManifest)}\n`, 'utf8');
console.log(`Synced Android web manifest: ${targetPath}`);
