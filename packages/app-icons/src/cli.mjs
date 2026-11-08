#!/usr/bin/env node
/**
 * veit-app-icons [--config branding/app-icons.json] [--only web|android]
 * Writes every icon the config names from the one logo SVG. The outputs are build artefacts: the host ignores them in
 * Git and runs this before its web build and before Gradle.
 */
import path from 'node:path';
import { generateAppIcons } from './index.mjs';

const args = process.argv.slice(2);
const value = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const configPath = value('--config') ?? path.join('branding', 'app-icons.json');
const only = value('--only');
if (only && only !== 'web' && only !== 'android') {
  console.error('veit-app-icons: --only web|android');
  process.exit(1);
}

try {
  const written = generateAppIcons(configPath, { only });
  console.log(`app-icons: ${written.length} files from ${configPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
