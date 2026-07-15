const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "canvas.css");
const pluginSourcePath = path.join(projectRoot, "plugin.css");
const targetPath = path.join(projectRoot, "styles.css");
const checkOnly = process.argv.includes("--check");
const hostSelector = ".narrative-canvas-plugin-host";
const marker = "/* Narrative Canvas web app styles (scoped; generated from canvas.css) */";

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let inComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (inComment) {
      if (char === "*" && next === "/") {
        inComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function splitSelectorList(selectorText) {
  const selectors = [];
  let current = "";
  let quote = "";
  let escaped = false;
  let inComment = false;
  let bracketDepth = 0;
  let parenDepth = 0;
  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    const next = selectorText[index + 1];
    current += char;
    if (inComment) {
      if (char === "*" && next === "/") {
        current += next;
        index += 1;
        inComment = false;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "*") {
      inComment = true;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === "[") bracketDepth += 1;
    else if (char === "]") bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === "(") parenDepth += 1;
    else if (char === ")") parenDepth = Math.max(0, parenDepth - 1);
    else if (char === "," && bracketDepth === 0 && parenDepth === 0) {
      selectors.push(current.slice(0, -1));
      current = "";
    }
  }
  selectors.push(current);
  return selectors;
}

function scopeSelector(selector) {
  const trimmed = selector.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(hostSelector)) return trimmed;
  if (trimmed === ":root") return hostSelector;
  if (trimmed.startsWith(":root[")) {
    return `${hostSelector} .app-shell${trimmed.slice(":root".length)}`;
  }
  if (trimmed === "html" || trimmed === "body") return hostSelector;
  return `${hostSelector} ${trimmed}`;
}

function scopeSelectorList(selectorText) {
  return splitSelectorList(selectorText)
    .map(scopeSelector)
    .filter(Boolean)
    .join(", ");
}

const selectorScopingFixture = ':is(.alpha, .beta), [data-label="x,y"], .gamma';
const selectorScopingExpected = `${hostSelector} :is(.alpha, .beta), ${hostSelector} [data-label="x,y"], ${hostSelector} .gamma`;
if (scopeSelectorList(selectorScopingFixture) !== selectorScopingExpected) {
  throw new Error("Selector scoping self-test failed.");
}

function scopeCss(source) {
  let output = "";
  let cursor = 0;
  while (cursor < source.length) {
    const openIndex = source.indexOf("{", cursor);
    if (openIndex === -1) {
      output += source.slice(cursor);
      break;
    }
    const prelude = source.slice(cursor, openIndex);
    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex === -1) {
      output += source.slice(cursor);
      break;
    }
    const body = source.slice(openIndex + 1, closeIndex);
    // Keep comments and whitespace outside the selector. Treating a leading
    // comment as selector text makes commas inside the comment split the rule
    // and can leave the first selector unscoped in the generated plugin CSS.
    const triviaMatch = prelude.match(/^(\s*(?:\/\*[\s\S]*?\*\/\s*)*)/);
    const leading = triviaMatch?.[0] || "";
    const trimmedPrelude = prelude.slice(leading.length).trim();
    if (trimmedPrelude.startsWith("@")) {
      if (/^@(media|supports|container|layer)\b/.test(trimmedPrelude)) {
        output += `${leading}${trimmedPrelude} {\n${scopeCss(body).trim()}\n}`;
      } else {
        output += `${prelude}{${body}}`;
      }
    } else {
      output += `${leading}${scopeSelectorList(trimmedPrelude)} {${body}}`;
    }
    cursor = closeIndex + 1;
  }
  return output;
}

const current = fs.readFileSync(targetPath, "utf8").replace(/\r\n/g, "\n");
const pluginSource = fs.readFileSync(pluginSourcePath, "utf8").replace(/\r\n/g, "\n").trim();
const prelude = `${pluginSource}\n${marker}`;
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");
const scoped = scopeCss(source).trim();
const next = `${prelude}\n${scoped}\n`;
if (next === current) process.exit(0);
if (checkOnly) {
  console.error("styles.css is stale. Run: node scripts/build-plugin-styles.cjs");
  process.exit(1);
}
fs.writeFileSync(targetPath, next, "utf8");
