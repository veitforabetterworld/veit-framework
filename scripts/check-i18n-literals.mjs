#!/usr/bin/env node
/**
 * Jeder Text, den ein Mensch liest, kommt aus den Sprachdateien. Schlägt an bei Text in Komponenten:
 * JSX-Text, Text-Props (label, title, placeholder, aria-*, …) und String-Literalen, die wie Wörter aussehen.
 * Ein Literal, das kein Text ist (Id, Format, CSS), wird so geschrieben, dass es nicht wie Text aussieht,
 * oder die Zeile trägt den Ignore-Marker mit Begründung.
 *   --src <dir>              Wurzel, wiederholbar. Default: src (relativ zum Arbeitsverzeichnis)
 *   --skip-dir <name>        Verzeichnisname, der übersprungen wird, wiederholbar. Default: i18n
 *   --ignore-marker <text>   Zeilen mit diesem Text zählen nicht. Default: i18n-ignore
 *   --t-fn <name>            weitere Übersetzungsfunktion, deren Argumente Schlüssel sind (t, tf, tr, … sind dabei)
 *   --code-prop <name>       weitere Prop, deren Wert nie Text ist (className, type, … sind dabei)
 *   --allow-literal <re>     Literal (getrimmt), das nie Text ist, als JS-Regex, wiederholbar
 *   --allow-geojson          GeoJSON-Typen ("Feature", "Polygon", …) sind kein Text
 *   --hint <text>            Ziel in der Fehlermeldung. Default: src/i18n
 * Braucht `typescript` im Projekt (aufgelöst vom Arbeitsverzeichnis aus).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join, relative, resolve } from "node:path";

const roots = [];
const skipDirs = new Set();
const translateFns = ["t", "tf", "tr", "trFormat", "translate"];
const extraCodeProps = [];
const allowLiterals = [];
let ignoreMarker = "i18n-ignore";
let hint = "src/i18n";
for (let i = 2; i < process.argv.length; i += 1) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (flag === "--allow-geojson") {
    allowLiterals.push(/^(Feature|FeatureCollection|Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection)$/);
    continue;
  }
  if (value === undefined) {
    console.error(`check-i18n-literals: ${flag} braucht einen Wert`);
    process.exit(1);
  }
  if (flag === "--src") roots.push(resolve(value));
  else if (flag === "--skip-dir") skipDirs.add(value);
  else if (flag === "--ignore-marker") ignoreMarker = value;
  else if (flag === "--t-fn") translateFns.push(value);
  else if (flag === "--code-prop") extraCodeProps.push(value);
  else if (flag === "--allow-literal") allowLiterals.push(new RegExp(value));
  else if (flag === "--hint") hint = value;
  else {
    console.error(`check-i18n-literals: unbekannte Option ${flag}`);
    process.exit(1);
  }
  i += 1;
}
if (roots.length === 0) roots.push(resolve("src"));
if (skipDirs.size === 0) skipDirs.add("i18n");

function loadTypescript() {
  for (const base of [join(process.cwd(), "package.json"), import.meta.url]) {
    try {
      return createRequire(base)("typescript");
    } catch {
      /* nächster Versuch */
    }
  }
  console.error("check-i18n-literals: typescript nicht gefunden (im Projekt installieren)");
  process.exit(1);
}

const ts = loadTypescript();
const errors = [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Props whose value is shown or read aloud. */
const TEXT_PROPS = /^(label|title|subtitle|description|placeholder|alt|caption|message|meta|emptyText|tooltip|aria-[a-z]+|[a-z]+(Label|Text|Title|Message|Placeholder|AriaLabel))$/;
/** Values of these props are never text. */
const CODE_PROPS = new Set(["aria-haspopup", "aria-live", "aria-current", "aria-orientation", "aria-sort", "aria-autocomplete", "aria-controls", "aria-describedby", "aria-labelledby", "aria-owns", "aria-hidden", "className", "type", "variant", "size", "href", "to", "id", "htmlFor", "key", "role", "dataKey", "name", "position", "scale", "layout", "target", "rel", "src", "method", "mode", "density", "align", "side", "as", "fill", "stroke", "d", "viewBox", "xmlns", "strokeDasharray", "lang", "dateTime", "autoComplete", "inputMode", "legendType", ...extraCodeProps]);
/** Calls whose string arguments are keys, selectors, URLs and the like. */
const CODE_CALLS = new RegExp(
  `^(${[...translateFns.map(escapeRe), "require", "import", "fetch", "apiUrl", "get", "navigate", "setSearchParams", "URLSearchParams", "matchMedia", "addEventListener", "removeEventListener", "querySelector\\w*", "getElementById", "getItem", "setItem", "removeItem", "includes", "startsWith", "endsWith", "split", "replace\\w*", "indexOf", "has", "set", "delete", "join", "padStart", "padEnd", "localeCompare", "createElement", "setAttribute", "getAttribute", "removeAttribute", "getPropertyValue", "setProperty"].join("|")})$`,
);

const LETTERS = /[A-Za-zÄÖÜäöüß]/;
const WORD = /[A-Za-zÄÖÜäöüß]{2,}/g;

/** A literal reads like text when it holds words and is not a CSS class list, a path or an identifier. */
function readsLikeText(value) {
  const text = value.trim();
  if (!LETTERS.test(text)) return false;
  if (allowLiterals.some((re) => re.test(text))) return false;
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return false; // identifier, key, enum value
  if (/^[A-Z0-9_]+$/.test(text)) return false; // constant
  if (!/\s/.test(text) && /^0?(https?:|mailto:|\/|\.\/|#|data:|blob:)/.test(text) || !/\s/.test(text) && /^[a-z][a-z0-9+.-]*:\/\//.test(text)) return false; // URL or path
  if (/var\(--|color-mix\(|rgba?\(|^#[0-9a-f]{3,8}$/i.test(text)) return false; // CSS value
  if (!/\s/.test(text) && text.length > 40) return false; // base64, hash, token
  if (/^[\w.-]+\.(json|png|tif|mjs|js|ts|tsx|css|svg|geojson|webmanifest)$/.test(text)) return false;
  const tokens = text.split(/\s+/);
  const cssLike = tokens.every((token) => /^[!a-z0-9:\-/[\].%()&_#,>*~=@'"]+$/.test(token));
  if (cssLike && !/[äöüß]/.test(text) && !/[.?!]\s|,\s/.test(text)) return false; // class list or CSS value
  const words = text.match(WORD) ?? [];
  if (words.length >= 2) return true;
  // One capitalised word around a value: "Abfluss: 0", "Abfluss Q (0)".
  if (words.length === 1 && tokens.length > 1 && /^[A-ZÄÖÜ][a-zäöüß]{3,}$/.test(words[0]) && /[:(]/.test(text)) return true;
  if (words.length !== 1 || tokens.length !== 1 || text !== words[0]) return false;
  // One word: text when it starts upper-case like a label ("Status") or carries an umlaut ("läuft").
  return /^[A-ZÄÖÜ][a-zäöüß]{2,}/.test(text) || /[äöüß]/.test(text);
}

function ignored(sourceFile, node) {
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const lineText = sourceFile.text.split("\n")[line] ?? "";
  return lineText.includes(ignoreMarker);
}

function report(root, sourceFile, node, kind, text) {
  if (ignored(sourceFile, node)) return;
  const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
  const rel = relative(root, sourceFile.fileName).replaceAll("\\", "/");
  errors.push(`${rel}:${line + 1}: ${kind} „${text.trim().slice(0, 70)}“`);
}

function attributeName(node) {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (ts.isJsxAttribute(parent)) return parent.name.getText();
    if (ts.isJsxElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isBlock(parent)) return null;
  }
  return null;
}

/** Literals that are passed on without being shown: imports, type positions, comparisons, object keys. */
function isCodePosition(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent) || ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent) || ts.isPropertyAssignment(parent) && parent.name === node) return true;
  // Object values under a code-like key: { type: "FeatureCollection" }, { position: "insideTop" }.
  if (ts.isPropertyAssignment(parent) && CODE_PROPS.has(parent.name.getText().replace(/["']/g, ""))) return true;
  // Developer errors; what the user sees is mapped to i18n where the error is shown.
  if (ts.isNewExpression(parent) && /^(\w*Error)$/.test(parent.expression.getText())) return true;
  if (ts.isElementAccessExpression(parent) || ts.isPropertySignature(parent)) return true;
  if (ts.isBinaryExpression(parent) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(parent.operatorToken.kind)) return true;
  if (ts.isCaseClause(parent)) return true;
  if (ts.isCallExpression(parent)) {
    const callee = parent.expression.getText();
    if (CODE_CALLS.test(callee.split(".").pop() ?? callee) || /^console\./.test(callee)) return true;
  }
  if (ts.isNewExpression(parent) && /^(URL|URLSearchParams|RegExp|Date|Map|Set|Intl\.\w+)$/.test(parent.expression.getText())) return true;
  return false;
}

function visit(root, sourceFile, node) {
  if (ts.isJsxText(node)) {
    if (readsLikeText(node.text) || (LETTERS.test(node.text) && node.text.trim().length > 0 && /[A-Za-zÄÖÜäöüß]{2,}/.test(node.text))) {
      report(root, sourceFile, node, "JSX-Text", node.text);
    }
  } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const attr = attributeName(node);
    if (attr && CODE_PROPS.has(attr)) {
      // never text
    } else if (isCodePosition(node)) {
      // key passed to t(), comparison, import, …
    } else if (attr && TEXT_PROPS.test(attr)) {
      if (LETTERS.test(node.text) && /[A-Za-zÄÖÜäöüß]{2,}/.test(node.text)) report(root, sourceFile, node, `Prop ${attr}`, node.text);
    } else if (readsLikeText(node.text)) {
      report(root, sourceFile, node, "String", node.text);
    }
  } else if (ts.isTemplateExpression(node)) {
    // Substitutions count as one token, so `/v1/x/${id}` stays a path and `${n} Messwerte` stays text.
    const parts = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join("0");
    const attr = attributeName(node);
    if (!(attr && CODE_PROPS.has(attr)) && !isCodePosition(node) && readsLikeText(parts)) report(root, sourceFile, node, "Template", parts);
  }
  ts.forEachChild(node, (child) => visit(root, sourceFile, child));
}

function walk(root, dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (!skipDirs.has(name) && name !== "node_modules" && !name.startsWith(".")) walk(root, path);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(name) || /\.(test|spec)\.tsx?$/.test(name) || name.endsWith(".d.ts")) continue;
    const text = readFileSync(path, "utf8");
    const sourceFile = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    visit(root, sourceFile, sourceFile);
  }
}

for (const root of roots) walk(root, root);
if (errors.length) {
  console.error(`Texte gehören nach ${hint}, ${errors.length} Fundstellen:\n${errors.join("\n")}`);
  process.exit(1);
}
