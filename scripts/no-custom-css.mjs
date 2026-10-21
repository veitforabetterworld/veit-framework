/**
 * Host-CSS-Disziplin für Tailwind-4-Apps.
 * Ohne Flags: Hochwasser-Pfad (ein Positionsargument = src).
 *   --src <dir>
 *   --source <glob>          @source-Zeile, wiederholbar. Default: Controls + Dialog.
 *   --allow-import <line>    zusätzliche Zeile in tailwind.css, wiederholbar
 *   --allow-css <rel>        weitere CSS-Datei unter src (nur Brand-Tokens)
 *   --allow-style <rel>      style= bleibt erlaubt
 *   --allow-shell <rel>      Viewport-Höhe bleibt erlaubt (AppShell ist Default)
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DEFAULT_SOURCES = [
  './**/*.{tsx,ts}',
  '../../../veit-framework/packages/react-controls/src',
  '../../../veit-framework/packages/react-dialog/src',
];

function parseArgs(argv) {
  const sources = [];
  const allowImports = [];
  const allowCss = new Set();
  const allowStyle = new Set();
  const allowShell = new Set(["components/AppShell.tsx"]);
  let src;
  const positionals = [];
  for (let i = 2; i < argv.length; i += 1) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--src" && value) {
      src = value;
      i += 1;
    } else if (flag === "--source" && value) {
      sources.push(value);
      i += 1;
    } else if (flag === "--allow-import" && value) {
      allowImports.push(value);
      i += 1;
    } else if (flag === "--allow-css" && value) {
      allowCss.add(value.replaceAll("\\", "/"));
      i += 1;
    } else if (flag === "--allow-style" && value) {
      allowStyle.add(value.replaceAll("\\", "/"));
      i += 1;
    } else if (flag === "--allow-shell" && value) {
      allowShell.add(value.replaceAll("\\", "/"));
      i += 1;
    } else if (!flag.startsWith("--")) {
      positionals.push(flag);
    }
  }
  return {
    src: src ?? positionals[0] ?? join(import.meta.dirname, "..", "src"),
    sources: sources.length > 0 ? sources : DEFAULT_SOURCES,
    allowImports,
    allowCss,
    allowStyle,
    allowShell,
  };
}

const { src, sources, allowImports, allowCss, allowStyle, allowShell } = parseArgs(process.argv);
const errors = [];

const tailwind = readFileSync(join(src, "tailwind.css"), "utf8").replace(/\r\n/g, "\n");
const allowedTailwind = [
  '@import "tailwindcss";',
  ...sources.map((glob) => `@source "${glob}";`),
  '@import "@veit/react-controls/theme.css";',
  ...allowImports,
  "",
].join("\n");
if (tailwind.trim() !== allowedTailwind.trim()) {
  errors.push("src/tailwind.css darf nur Tailwind, @source, theme.css und erlaubte Extra-Imports laden");
}

function readBalanced(text, open) {
  let depth = 0;
  let quote = "";
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (quote === "`" && ch === "$" && text[i + 1] === "{") {
        const inner = readBalanced(text, i + 1);
        i += inner.length;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(open, i + 1);
    }
  }
  return text.slice(open);
}

function stringsIn(expr) {
  const found = [];
  let quote = "";
  let start = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (quote) {
      if (ch === "\\") {
        i += 1;
        continue;
      }
      if (quote === "`" && ch === "$" && expr[i + 1] === "{") {
        const inner = readBalanced(expr, i + 1);
        i += inner.length - 1;
        continue;
      }
      if (ch === quote) {
        found.push(expr.slice(start, i).replace(/\$\{[\s\S]*?\}/g, " "));
        quote = "";
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      start = i + 1;
    }
  }
  return found;
}

function classStrings(text) {
  const found = [];
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf("className", i);
    if (idx < 0) break;
    let j = idx + "className".length;
    while (text[j] === " " || text[j] === "\n") j += 1;
    if (text[j] !== "=") {
      i = idx + "className".length;
      continue;
    }
    j += 1;
    while (text[j] === " " || text[j] === "\n") j += 1;
    if (text[j] === '"' || text[j] === "'") {
      const end = text.indexOf(text[j], j + 1);
      found.push(text.slice(j + 1, end));
      i = end + 1;
    } else if (text[j] === "{") {
      found.push(...stringsIn(readBalanced(text, j)));
      i = j + 1;
    } else {
      i = j;
    }
  }
  return found;
}

function cssImportAllowed(trimmed) {
  if (trimmed.includes("tailwind.css")) return true;
  if (trimmed.includes("maplibre-gl/dist/maplibre-gl.css")) return true;
  return allowImports.some((line) => trimmed.includes(line.replace(/['"]/g, "").trim()) || trimmed === line);
}

function assertBrandFile(rel) {
  const text = readFileSync(join(src, rel), "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  let rest = text;
  while (true) {
    const at = rest.search(/@font-face\s*\{/);
    if (at < 0) break;
    const open = rest.indexOf("{", at);
    const block = readBalanced(rest, open);
    rest = rest.slice(0, at) + rest.slice(open + block.length);
  }
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRe.exec(rest))) {
    for (const decl of match[2].split(";")) {
      const trimmed = decl.trim();
      if (!trimmed) continue;
      if (!trimmed.startsWith("--")) {
        errors.push(`${rel}: Brand-Datei darf nur Variablen und @font-face enthalten (${trimmed})`);
      }
    }
  }
  const leftover = rest.replace(ruleRe, "").replace(/\s+/g, "");
  if (leftover) {
    errors.push(`${rel}: Brand-Datei darf nur Variablen und @font-face enthalten`);
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const rel = relative(src, path).replaceAll("\\", "/");
    if (name.endsWith(".css") && rel !== "tailwind.css" && !allowCss.has(rel)) {
      errors.push(`${rel}: keine Stylesheet-Datei im Host`);
    }
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const text = readFileSync(path, "utf8");
    if (!allowStyle.has(rel) && /style\s*=\s*[{["']/.test(text)) errors.push(`${rel}: kein style-Attribut`);
    if (/<(?:button|input|select|textarea)\b/.test(text)) {
      errors.push(`${rel}: natives Formular-Element, Veit-Baustein nehmen`);
    }
    if (/rounded-xl border border-border bg-card/.test(text)) {
      errors.push(`${rel}: Karte ist VeitPanel, nicht eine eigene Klassenkette`);
    }
    if (!allowShell.has(rel) && /\b(?:h-dvh|min-h-dvh|min-h-screen)\b/.test(text)) {
      errors.push(`${rel}: Seitenhülle nur über AppShell`);
    }
    for (const raw of classStrings(text)) {
      for (const token of raw.split(/\s+/)) {
        if (!token) continue;
        if (/(?:^|:)\[&[^\]]*\]/.test(token) || /[a-zA-Z0-9]-?\[[^\s\]]+\]/.test(token)) {
          errors.push(`${rel}: kein Arbitrary-Value (${token})`);
        }
        if (/^(?:[a-z-]+:)*(?:bg|text|border|from|via|to|ring|fill|stroke|outline)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\d+)?(?:\/\d+)?$/.test(token)) {
          errors.push(`${rel}: keine Palettenfarbe (${token})`);
        }
      }
    }
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.includes(".css")) continue;
      if (cssImportAllowed(trimmed)) continue;
      if (/import\s+["'].+\.css["']/.test(trimmed) || /@import\s+["'].+\.css["']/.test(trimmed)) {
        errors.push(`${rel}: CSS-Import nicht erlaubt (${trimmed})`);
      }
    }
  }
}

walk(src);
for (const rel of allowCss) assertBrandFile(rel);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
