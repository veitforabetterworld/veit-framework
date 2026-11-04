#!/usr/bin/env node
/**
 * preinstall: Installation nur mit dem vorgesehenen Paketmanager, sonst entstehen fremde Lockfiles.
 *   "preinstall": "node veit-framework/scripts/only-pnpm.cjs"
 *   --pm <name>   erwarteter Paketmanager. Default: pnpm
 */
let pm = "pnpm";
for (let i = 2; i < process.argv.length; i += 1) {
  if (process.argv[i] === "--pm" && process.argv[i + 1]) {
    pm = process.argv[i + 1];
    i += 1;
  }
}

const ua = process.env.npm_config_user_agent ?? "";
if (!ua.includes(pm)) {
  console.error(`This repo uses ${pm}. Run: ${pm} install`);
  process.exit(1);
}
