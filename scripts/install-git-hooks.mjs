#!/usr/bin/env node
/**
 * prepare: kopiert versionierte Git-Hooks in das Hook-Verzeichnis des Repos (auch in Worktrees und Submodulen).
 * Ohne .git (z. B. per rsync deployter Baum) passiert nichts.
 *   "prepare": "node veit-framework/scripts/install-git-hooks.mjs"
 *   --source <dir>   Hook-Quellen relativ zum Repo-Root. Default: .githooks
 *   --hook <name>    Hook, wiederholbar. Default: alle Dateien in --source
 */
import { chmodSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";

let source = ".githooks";
const hooks = [];
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === "--source" && value) {
    source = value;
    i += 1;
  } else if (flag === "--hook" && value) {
    hooks.push(value);
    i += 1;
  } else {
    console.error(`install-git-hooks: unbekannte Option ${flag}`);
    process.exit(1);
  }
}

let root;
try {
  root = execSync("git rev-parse --show-toplevel", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
} catch {
  // A deploy target receives the tree by rsync without .git; there is no hook to install.
  process.exit(0);
}
const hooksPath = execSync("git rev-parse --git-path hooks", { encoding: "utf8" }).trim();
const destDir = path.resolve(root, hooksPath);
const srcDir = path.resolve(root, source);
if (!existsSync(srcDir)) {
  console.error(`install-git-hooks: ${srcDir} fehlt`);
  process.exit(1);
}
const names = hooks.length > 0 ? hooks : readdirSync(srcDir).filter((name) => statSync(path.join(srcDir, name)).isFile());
mkdirSync(destDir, { recursive: true });
for (const name of names) {
  const dest = path.join(destDir, name);
  copyFileSync(path.join(srcDir, name), dest);
  chmodSync(dest, 0o755);
}
