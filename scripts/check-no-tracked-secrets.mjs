#!/usr/bin/env node
/**
 * Blockt versionierte Secret-Dateien und offensichtliche Private-Key-Muster.
 *   node check-no-tracked-secrets.mjs --forbid path [--allow path]
 *   --name-re <js-regex>  Dateiname (Beispiel-Dateien *.example ausgenommen)
 *   --skip-content        keine Inhaltsmuster
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const forbidden = [];
const allowed = [];
const nameRes = [];
let skipContent = false;
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === '--forbid' && value) {
    forbidden.push(value);
    i += 1;
  } else if (flag === '--allow' && value) {
    allowed.push(value);
    i += 1;
  } else if (flag === '--name-re' && value) {
    nameRes.push(new RegExp(value, 'i'));
    i += 1;
  } else if (flag === '--skip-content') {
    skipContent = true;
  }
}

const SENSITIVE_PATTERNS = [
  /DATA_ENCRYPTION_KEY=[0-9a-f]{64}/i,
  /api_key\s*=\s*['"][0-9a-f]{20,}['"]/i,
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/,
];

function listTrackedFiles() {
  return execSync('git ls-files', { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

let failed = false;
const tracked = listTrackedFiles();

for (const rel of forbidden) {
  if (tracked.includes(rel.replace(/\\/g, '/'))) {
    failed = true;
    console.error(`check-no-tracked-secrets: "${rel}" darf nicht versioniert sein.`);
  }
}

for (const rel of tracked) {
  if (rel.endsWith('.example')) continue;
  if (nameRes.some((pattern) => pattern.test(rel))) {
    failed = true;
    console.error(`check-no-tracked-secrets: "${rel}" darf nicht versioniert sein.`);
  }
}

if (!skipContent) {
  for (const rel of tracked) {
    if (!/\.(ts|tsx|js|mjs|json|md)$/.test(rel)) continue;
    if (allowed.includes(rel)) continue;
    const abs = path.resolve(rel);
    if (!fs.existsSync(abs) || fs.statSync(abs).size > 512_000) continue;
    const text = fs.readFileSync(abs, 'utf8');
    for (const pattern of SENSITIVE_PATTERNS) {
      if (pattern.test(text)) {
        failed = true;
        console.error(`check-no-tracked-secrets: Verdächtiges Muster in ${rel}`);
      }
    }
  }
}

if (failed) process.exit(1);
console.log('check-no-tracked-secrets: OK');
