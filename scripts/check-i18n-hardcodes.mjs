#!/usr/bin/env node
/**
 * Kein fest verdrahtetes Locale im Code, gleiche Schlüssel in allen Sprachdateien.
 *   --src <dir>            Wurzel, wiederholbar. Default: src (relativ zum Arbeitsverzeichnis)
 *   --locale-dir <dir>     Sprachdateien `<locale>.ts`, wird beim Locale-Scan übersprungen. Default: <erste src>/i18n
 *   --locale <code>        Sprachdatei, wiederholbar. Default: de, en
 *   --forbid <literal>     verbotenes Locale-Literal, wiederholbar. Default: de-DE
 *   --key-re <js-regex>    Schlüssel einer Sprachdatei (Gruppe 1, Flag m). Default: ^\s{2}(\w+):
 *   --skip-keys            nur Locale-Literale prüfen
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const roots = [];
const locales = [];
const forbidden = [];
let localeDir;
let keyRe = /^\s{2}(\w+):/gm;
let skipKeys = false;
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === "--skip-keys") {
    skipKeys = true;
    continue;
  }
  if (value === undefined) {
    console.error(`check-i18n-hardcodes: ${flag} braucht einen Wert`);
    process.exit(1);
  }
  if (flag === "--src") roots.push(resolve(value));
  else if (flag === "--locale-dir") localeDir = resolve(value);
  else if (flag === "--locale") locales.push(value);
  else if (flag === "--forbid") forbidden.push(value);
  else if (flag === "--key-re") keyRe = new RegExp(value, "gm");
  else {
    console.error(`check-i18n-hardcodes: unbekannte Option ${flag}`);
    process.exit(1);
  }
  i += 1;
}
if (roots.length === 0) roots.push(resolve("src"));
if (locales.length === 0) locales.push("de", "en");
if (forbidden.length === 0) forbidden.push("de-DE");
localeDir ??= join(roots[0], "i18n");

const errors = [];

function walk(root, dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (resolve(path) !== localeDir && name !== "node_modules" && !name.startsWith(".")) walk(root, path);
      continue;
    }
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const text = readFileSync(path, "utf8");
    const rel = relative(root, path).replaceAll("\\", "/");
    for (const literal of forbidden) {
      if (text.includes(`"${literal}"`) || text.includes(`'${literal}'`)) {
        errors.push(`${rel}: Locale über @veit/intl, nicht hart ${literal}`);
      }
    }
  }
}

for (const root of roots) walk(root, root);

if (!skipKeys) {
  const keysOf = (locale) => {
    const file = join(localeDir, `${locale}.ts`);
    if (!existsSync(file)) {
      errors.push(`i18n: ${relative(process.cwd(), file).replaceAll("\\", "/")} fehlt`);
      return null;
    }
    return [...readFileSync(file, "utf8").matchAll(keyRe)].map((match) => match[1]).sort();
  };
  const [first, ...rest] = locales;
  const base = keysOf(first);
  for (const locale of rest) {
    const keys = keysOf(locale);
    if (!base || !keys) continue;
    if (base.join() !== keys.join()) {
      const missing = base.filter((key) => !keys.includes(key));
      const extra = keys.filter((key) => !base.includes(key));
      errors.push(
        `i18n: ${first} und ${locale} haben unterschiedliche Schlüssel` +
          (missing.length ? `; fehlt in ${locale}: ${missing.join(", ")}` : "") +
          (extra.length ? `; nur in ${locale}: ${extra.join(", ")}` : ""),
      );
    }
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
