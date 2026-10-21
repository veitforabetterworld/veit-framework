import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const src = process.argv[2] ?? join(import.meta.dirname, "..", "src");
const errors = [];

const tailwind = readFileSync(join(src, "tailwind.css"), "utf8").replace(/\r\n/g, "\n");
const allowedTailwind = [
  '@import "tailwindcss";',
  '@source "./**/*.{tsx,ts}";',
  '@source "../../../veit-framework/packages/react-controls/src";',
  '@source "../../../veit-framework/packages/react-dialog/src";',
  '@import "@veit/react-controls/theme.css";',
  "",
].join("\n");
if (tailwind.trim() !== allowedTailwind.trim()) {
  errors.push("src/tailwind.css darf nur Tailwind, @source und theme.css laden");
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

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    const rel = relative(src, path).replaceAll("\\", "/");
    if (name.endsWith(".css") && rel !== "tailwind.css") {
      errors.push(`${rel}: keine Stylesheet-Datei im Host`);
    }
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const text = readFileSync(path, "utf8");
    if (/style\s*=\s*[{["']/.test(text)) errors.push(`${rel}: kein style-Attribut`);
    if (/<(?:button|input|select|textarea)\b/.test(text)) {
      errors.push(`${rel}: natives Formular-Element, Veit-Baustein nehmen`);
    }
    if (/rounded-xl border border-border bg-card/.test(text)) {
      errors.push(`${rel}: Karte ist VeitPanel, nicht eine eigene Klassenkette`);
    }
    if (rel !== "components/AppShell.tsx" && /\b(?:h-dvh|min-h-dvh|min-h-screen)\b/.test(text)) {
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
      if (trimmed.includes("tailwind.css")) continue;
      if (trimmed.includes("maplibre-gl/dist/maplibre-gl.css")) continue;
      if (/import\s+["'].+\.css["']/.test(trimmed) || /@import\s+["'].+\.css["']/.test(trimmed)) {
        errors.push(`${rel}: CSS-Import nicht erlaubt (${trimmed})`);
      }
    }
  }
}

walk(src);
if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
