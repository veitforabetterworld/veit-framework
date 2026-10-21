#!/usr/bin/env node
/**
 * Page-LOC-Ratchet. Host setzt Wurzeln und Schwellen.
 *   --root <file-or-dir>   wiederholbar
 *   --warn <n>             Default 400
 *   --fail <n>             Default 800
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const roots = [];
let warnAt = 400;
let failAt = 800;
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === '--root' && value) {
    roots.push(resolve(value));
    i += 1;
  } else if (flag === '--warn' && value) {
    warnAt = Number(value);
    i += 1;
  } else if (flag === '--fail' && value) {
    failAt = Number(value);
    i += 1;
  }
}

if (roots.length === 0 || !Number.isFinite(warnAt) || !Number.isFinite(failAt)) {
  console.error('check-page-loc: --root, --warn und --fail erforderlich');
  process.exit(1);
}

function collect(path) {
  const stat = statSync(path);
  if (stat.isFile()) return path.endsWith('.tsx') || path.endsWith('.ts') ? [path] : [];
  const out = [];
  for (const name of readdirSync(path)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    out.push(...collect(resolve(path, name)));
  }
  return out;
}

const warnings = [];
const failures = [];
const cwd = process.cwd();

for (const root of roots) {
  for (const file of collect(root)) {
    const lines = readFileSync(file, 'utf8').split('\n').length;
    const label = `${relative(cwd, file)} (${lines})`;
    if (lines >= failAt) failures.push(label);
    else if (lines >= warnAt) warnings.push(label);
  }
}

if (warnings.length > 0) {
  console.warn(`check-page-loc: Warnung ≥ ${warnAt} Zeilen:`);
  for (const line of warnings) console.warn(`  ${line}`);
}

if (failures.length > 0) {
  console.error(`check-page-loc: Fail ≥ ${failAt} Zeilen:`);
  for (const line of failures) console.error(`  ${line}`);
  process.exit(1);
}

console.log(
  `check-page-loc: OK (${warnings.length} Warnung${warnings.length === 1 ? '' : 'en'}, Schwelle ${warnAt}/${failAt})`,
);
