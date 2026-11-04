#!/usr/bin/env node
/**
 * `pnpm audit`: high und critical blockieren, außer sie stehen geprüft in der Allowlist; low und moderate nur melden.
 * Allowlist: JSON-Array `[{ "id": "1234", "reason": "…" }]`.
 *   --allowlist <file>    Default: scripts/audit-reviewed.json (fehlt die Datei, ist sie leer)
 *   --fail-on <list>      blockierende Stufen, kommagetrennt. Default: high,critical
 *   --prod                nur Produktions-Abhängigkeiten (`pnpm audit --prod`)
 */
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

let allowlist = "scripts/audit-reviewed.json";
let failOn = ["high", "critical"];
let prodOnly = false;
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === "--prod") {
    prodOnly = true;
  } else if (flag === "--allowlist" && value) {
    allowlist = value;
    i += 1;
  } else if (flag === "--fail-on" && value) {
    failOn = value.split(",").map((s) => s.trim()).filter(Boolean);
    i += 1;
  } else {
    console.error(`check-audit: unbekannte Option ${flag}`);
    process.exit(1);
  }
}

const allowlistPath = resolve(allowlist);
const reviewed = new Set(
  existsSync(allowlistPath) ? JSON.parse(readFileSync(allowlistPath, "utf8")).map((entry) => String(entry.id)) : [],
);

const args = ["audit", "--json", ...(prodOnly ? ["--prod"] : [])];
// pnpm is a .cmd on Windows and only starts through a shell there; the arguments are fixed, so one string is safe.
const result =
  process.platform === "win32"
    ? spawnSync(`pnpm ${args.join(" ")}`, { encoding: "utf8", shell: true })
    : spawnSync("pnpm", args, { encoding: "utf8" });
if (result.error) {
  console.error(`check-audit: pnpm audit ließ sich nicht starten: ${result.error.message}`);
  process.exit(1);
}
let data;
try {
  data = JSON.parse(result.stdout || "{}");
} catch {
  console.error(`check-audit: Antwort von pnpm audit ist kein JSON:\n${result.stdout}${result.stderr}`);
  process.exit(1);
}
const blocking = [];

for (const [id, advisory] of Object.entries(data.advisories ?? {})) {
  const line = `${advisory.severity} ${id} ${advisory.module_name}: ${advisory.title}`;
  if (!failOn.includes(advisory.severity)) {
    console.log(line);
    continue;
  }
  if (reviewed.has(id)) {
    console.log(`reviewed ${line}`);
    continue;
  }
  blocking.push(line);
}

if (blocking.length > 0) {
  console.error(blocking.join("\n"));
  process.exit(1);
}
