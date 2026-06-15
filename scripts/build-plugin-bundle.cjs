const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const mainPath = path.join(projectRoot, "main.js");
const indexPath = path.join(projectRoot, "index.html");
const appPath = path.join(projectRoot, "app.js");

function jsStringLine(line) {
  return JSON.stringify(line)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

function buildIndexConstant(html) {
  const lines = html.replace(/\r\n/g, "\n").trimEnd().split("\n");
  return [
    "const CANVAS_INDEX_HTML = [",
    ...lines.map((line) => `  ${jsStringLine(line)},`),
    "].join(\"\\n\");"
  ].join("\n");
}

function indentAppSource(source) {
  return source
    .replace(/\r\n/g, "\n")
    .trimEnd()
    .split("\n")
    .map((line) => (line ? `  ${line}` : ""))
    .join("\n");
}

function replaceFunctionBlock(source, signaturePattern, replacement) {
  const match = source.match(signaturePattern);
  if (!match || match.index == null) return { source, changed: false };
  const start = match.index;
  const openIndex = source.indexOf("{", start);
  if (openIndex === -1) return { source, changed: false };
  let depth = 0;
  let inString = "";
  let escaped = false;
  let inLineComment = false;
  let inBlockComment = false;
  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1] || "";
    if (inLineComment) {
      if (char === "\n") inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        index += 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === inString) {
        inString = "";
      }
      continue;
    }
    if (char === "/" && next === "/") {
      inLineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      inBlockComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      inString = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return {
          source: `${source.slice(0, start)}${replacement}${source.slice(index + 1)}`,
          changed: true
        };
      }
    }
  }
  return { source, changed: false };
}

const main = fs.readFileSync(mainPath, "utf8").replace(/\r\n/g, "\n");
const html = fs.readFileSync(indexPath, "utf8");
const rawApp = fs.readFileSync(appPath, "utf8");

// Strip the web-only localStorage branch out of getWebProjectStorage when bundling
// into the Obsidian plugin entry, so main.js doesn't ship any localStorage references.
// The standalone app.js keeps the real implementation for the browser build.
let app = rawApp.replace(/^const WEB_STORAGE_KEY = .*\r?\n/m, "");
const pluginOnlyRewrites = [
  [
    /function loadWebState\(\) \{/,
    `function loadWebState() {
  return null;
}`
  ],
  [
    /function saveWebState\(savedState\) \{/,
    `function saveWebState(_savedState) {
  return;
}`
  ],
  [
    /function getWebProjectStorage\(\) \{/,
    `function getWebProjectStorage() {
  // Obsidian-plugin bundle: persistence runs through NarrativeCanvasHost, no browser storage.
  return null;
}`
  ],
  [
    /async function clearBrowserStorageFromUi\(\) \{/,
    `async function clearBrowserStorageFromUi() {
  return;
}`
  ],
  [
    /async function clearBrowserStorageConfirmed\(\) \{/,
    `async function clearBrowserStorageConfirmed() {
  return;
}`
  ]
];
for (const [pattern, replacement] of pluginOnlyRewrites) {
  const result = replaceFunctionBlock(app, pattern, replacement);
  if (!result.changed) {
    throw new Error(`Plugin-bundle rewrite failed for ${pattern}.`);
  }
  app = result.source;
}

let next = main.replace(
  /const CANVAS_INDEX_HTML = \[[\s\S]*?\]\.join\("\\n"\);/,
  buildIndexConstant(html)
);

const appStartMarker = "function installNarrativeCanvasApp() {\n  // BEGIN bundled app.js\n";
const appEndMarker = "\n  // END bundled app.js\n}";
const appStart = next.indexOf(appStartMarker);
if (appStart === -1) {
  throw new Error("Could not find bundled app start marker.");
}
const appBodyStart = appStart + appStartMarker.length;
const appEnd = next.indexOf(appEndMarker, appBodyStart);
if (appEnd === -1) {
  throw new Error("Could not find bundled app end marker.");
}
next = `${next.slice(0, appBodyStart)}${indentAppSource(app)}${next.slice(appEnd)}`;

if (next === main) {
  process.exit(0);
}

fs.writeFileSync(mainPath, `${next.trimEnd()}\n`, "utf8");
