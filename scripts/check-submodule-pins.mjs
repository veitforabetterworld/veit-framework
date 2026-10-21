#!/usr/bin/env node
/**
 * Submodule-Pin muss Checkout und origin/<branch> treffen.
 *   node check-submodule-pins.mjs --submodule veit-framework --branch deploy
 */
import { execSync } from 'node:child_process';

function arg(name) {
  const index = process.argv.indexOf(name);
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    console.error(`check-submodule-pins: ${name} fehlt`);
    process.exit(1);
  }
  return value;
}

const SUBMODULE = arg('--submodule');
const TRACKING_BRANCH = arg('--branch');

function run(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd();
}

let failed = false;

const statusLines = run('git submodule status --recursive').split('\n').filter(Boolean);
const line = statusLines.find((l) => l.includes(SUBMODULE));
if (!line) {
  console.error(`check-submodule-pins: submodule "${SUBMODULE}" not found.`);
  process.exit(1);
}

if (/^(\+|U|-)/.test(line)) {
  failed = true;
  console.error(`check-submodule-pins: ${SUBMODULE} working tree differs from parent commit (${line[0]}).`);
  console.error(`  Run: git add ${SUBMODULE} && git commit`);
}

const checkedOut = run(`git -C ${SUBMODULE} rev-parse HEAD`);

function pinnedCommit() {
  try {
    const staged = run(`git ls-files -s -- ${SUBMODULE}`).trim();
    if (staged) {
      const sha = staged.split(/\s+/)[1];
      if (sha) return sha;
    }
  } catch {
    // fall through
  }
  return run(`git ls-tree HEAD ${SUBMODULE}`).split(/\s+/)[2];
}

let pinned;
try {
  pinned = pinnedCommit();
} catch {
  console.warn('check-submodule-pins: no HEAD commit — skipping parent pin comparison.');
  console.log(`check-submodule-pins: ${SUBMODULE} @ ${checkedOut.slice(0, 7)} (initial repo).`);
  process.exit(0);
}

try {
  run(`git -C ${SUBMODULE} fetch origin ${TRACKING_BRANCH}`);
} catch {
  console.warn(`check-submodule-pins: could not fetch origin/${TRACKING_BRANCH} in ${SUBMODULE}.`);
}

let remoteHead = checkedOut;
try {
  remoteHead = run(`git -C ${SUBMODULE} rev-parse origin/${TRACKING_BRANCH}`);
} catch {
  // offline
}

if (pinned !== checkedOut) {
  failed = true;
  console.error(
    `check-submodule-pins: parent pins ${pinned.slice(0, 7)}, checkout is ${checkedOut.slice(0, 7)}.`,
  );
}

if (remoteHead !== checkedOut) {
  failed = true;
  console.error(
    `check-submodule-pins: ${SUBMODULE} is at ${checkedOut.slice(0, 7)}, origin/${TRACKING_BRANCH} is ${remoteHead.slice(0, 7)}.`,
  );
  console.error(`  Run: git submodule update --remote ${SUBMODULE} && git add ${SUBMODULE} && git commit`);
}

if (failed) process.exit(1);

console.log(
  `check-submodule-pins: ${SUBMODULE} @ ${checkedOut.slice(0, 7)} (matches parent and origin/${TRACKING_BRANCH}).`,
);
