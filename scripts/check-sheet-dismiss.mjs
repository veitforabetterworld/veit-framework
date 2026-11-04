#!/usr/bin/env node
/**
 * Jedes Sheet bekommt einen Schließ-Ref, damit Zurück-Taste und Wischen es über den Verlauf schließen.
 *   --src <dir>          Wurzel, wiederholbar. Default: src (relativ zum Arbeitsverzeichnis)
 *   --component <name>   JSX-Tag, wiederholbar. Default: VeitSheetDialog
 *   --prop <name>        Pflicht-Prop. Default: dismissRef
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const roots = [];
const components = [];
let prop = "dismissRef";
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (value === undefined) {
    console.error(`check-sheet-dismiss: ${flag} braucht einen Wert`);
    process.exit(1);
  }
  if (flag === "--src") roots.push(resolve(value));
  else if (flag === "--component") components.push(value);
  else if (flag === "--prop") prop = value;
  else {
    console.error(`check-sheet-dismiss: unbekannte Option ${flag}`);
    process.exit(1);
  }
  i += 1;
}
if (roots.length === 0) roots.push(resolve("src"));
if (components.length === 0) components.push("VeitSheetDialog");

const errors = [];

/** The opening tag from `<Name` to its closing `>`; `=>` inside props does not end it. */
function openingTag(text, start) {
  for (let i = start; i < text.length; i++) {
    if (text[i] === "=" && text[i + 1] === ">") {
      i += 1;
      continue;
    }
    if (text[i] === ">") return text.slice(start, i);
  }
  return text.slice(start);
}

function walk(root, dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "node_modules" && !name.startsWith(".")) walk(root, path);
      continue;
    }
    if (!name.endsWith(".tsx")) continue;
    const text = readFileSync(path, "utf8");
    const rel = relative(root, path).replaceAll("\\", "/");
    for (const component of components) {
      const tagRe = new RegExp(`<${component}(?![\\w.])`, "g");
      for (const match of text.matchAll(tagRe)) {
        if (!new RegExp(`\\b${prop}\\b`).test(openingTag(text, match.index))) {
          errors.push(`${rel}: ${component} braucht ${prop}`);
        }
      }
    }
  }
}

for (const root of roots) walk(root, root);
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
