#!/usr/bin/env node
/**
 * Ein react-router-Kontext im Produktionsbundle.
 *   --assets <dir>
 *   --react-major <n>   optional, prüft die installierte React-Major
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const assetsArg = arg('--assets');
const reactMajorArg = arg('--react-major');
if (!assetsArg) {
  console.error('check-react-singleton: --assets fehlt');
  process.exit(1);
}

if (reactMajorArg) {
  const expected = Number(reactMajorArg);
  const require = createRequire(path.resolve('package.json'));
  const reactPkg = require('react/package.json');
  const reactMajor = Number(String(reactPkg.version).split('.')[0]);
  if (reactMajor !== expected) {
    console.error(`check-react-singleton: react ${reactPkg.version} — expected major ${expected}`);
    process.exit(1);
  }
  console.log(`check-react-singleton: react ${reactPkg.version}`);
}

const assetsDir = path.resolve(assetsArg);
if (!fs.existsSync(assetsDir)) {
  console.error(`check-react-singleton: ${assetsArg} missing — run the web build first`);
  process.exit(1);
}

const hits = [];
for (const name of fs.readdirSync(assetsDir)) {
  if (!name.endsWith('.js')) continue;
  const source = fs.readFileSync(path.join(assetsDir, name), 'utf8');
  const count = (source.match(/outlet:null/g) || []).length;
  if (count > 0) hits.push({ name, count });
}

console.log('react-router context markers:', hits);

if (hits.length > 1) {
  console.error(
    `check-react-singleton: react-router appears in ${hits.length} chunks — duplicate Router context risk.`,
  );
  process.exit(1);
}

if (reactMajorArg && hits.reduce((sum, hit) => sum + hit.count, 0) === 0) {
  console.warn('check-react-singleton: no outlet:null markers found (router may be unused or renamed)');
}

console.log('check-react-singleton: ok');
