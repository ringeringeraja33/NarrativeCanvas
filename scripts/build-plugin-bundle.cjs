const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const projectRoot = path.resolve(__dirname, "..");
const mainPath = path.join(projectRoot, "main.js");
const indexPath = path.join(projectRoot, "index.html");
const appPath = path.join(projectRoot, "app.js");
const canvasCssPath = path.join(projectRoot, "canvas.css");
const manifestPath = path.join(projectRoot, "manifest.json");
const checkOnly = process.argv.includes("--check");

// The web app's asset URLs carry a ?v= cache-buster. Derive it deterministically from the
// manifest version plus a content hash of app.js and canvas.css, so it changes exactly when
// the assets change and no one has to bump it by hand.
function computeAssetVersionToken() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const hash = crypto.createHash("sha256");
  // Git may check text files out with CRLF on Windows and LF in CI. Hash the
  // normalized source so the committed cache token is platform-independent.
  hash.update(fs.readFileSync(appPath, "utf8").replace(/\r\n?/g, "\n"));
  hash.update(fs.readFileSync(canvasCssPath, "utf8").replace(/\r\n?/g, "\n"));
  return `${manifest.version}-${hash.digest("hex").slice(0, 8)}`;
}

function syncIndexAssetVersion(html) {
  const token = computeAssetVersionToken();
  const next = html.replace(/(\.\/(?:app\.js|canvas\.css))\?v=[^"]*/g, `$1?v=${token}`);
  if (next === html) return html;
  if (checkOnly) {
    console.error("index.html asset ?v= token is stale. Run: node scripts/build-plugin-bundle.cjs");
    process.exit(1);
  }
  fs.writeFileSync(indexPath, next, "utf8");
  return next;
}

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

// canvas.css is injected into the view's shadow root. `:root`/`html`/`body` selectors
// become `:host` so the shadow host carries the page-level styling and theme/lang
// attributes set on it keep matching.
function buildStyleConstant(css) {
  const source = css.replace(/\r\n/g, "\n");
  const converted = source
    .replace(/^html,\s*\nbody\b/m, ":host")
    .replace(/^body\b/gm, ":host")
    .replace(/^html\b/gm, ":host")
    .replace(/:root(\[[^\]]+\])/g, ":host($1)")
    .replace(/:root\b/g, ":host");
  const lines = converted.trimEnd().split("\n");
  return [
    "const CANVAS_STYLE_CSS = [",
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

function replaceMarkedBlock(source, name, replacement) {
  const startMarker = `// BEGIN WEB_RUNTIME:${name}`;
  const endMarker = `// END WEB_RUNTIME:${name}`;
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) {
    throw new Error(`Plugin-bundle marker ${name} is missing or incomplete.`);
  }
  if (source.indexOf(startMarker, start + startMarker.length) !== -1
      || source.indexOf(endMarker, end + endMarker.length) !== -1) {
    throw new Error(`Plugin-bundle marker ${name} must appear exactly once.`);
  }
  return `${source.slice(0, start)}${replacement.trim()}${source.slice(end + endMarker.length)}`;
}

const main = fs.readFileSync(mainPath, "utf8").replace(/\r\n/g, "\n");
const html = syncIndexAssetVersion(fs.readFileSync(indexPath, "utf8"));
const rawApp = fs.readFileSync(appPath, "utf8");

// Strip the web-only localStorage branch out of getWebProjectStorage when bundling
// into the Obsidian plugin entry, so main.js doesn't ship any localStorage references.
// The standalone app.js keeps the real implementation for the browser build.
let app = rawApp.replace(/^const WEB_STORAGE_KEY = .*\r?\n/m, "");
const pluginOnlyRewrites = {
  PROJECT_STORAGE: `function loadWebState() {
  return null;
}

function saveWebState(_savedState) {
  return;
}

function getWebProjectStorage() {
  // Obsidian-plugin bundle: persistence runs through NarrativeCanvasHost, no browser storage.
  return null;
}`,
  CLEAR_STORAGE: `async function clearBrowserStorageFromUi() {
  return;
}

async function clearBrowserStorageConfirmed() {
  return;
}`,
  // AI is web-only inside Obsidian (requests go through NarrativeCanvasHost.aiChat).
  // Strip the localStorage config and direct browser fetch. Plugin requests are routed
  // through NarrativeCanvasHost.aiChat and Obsidian's requestUrl implementation.
  AI_CONFIG: `function getWebAiConfig() {
  return { endpoint: "", apiKey: "", model: "" };
}

function saveWebAiConfig() {
  return;
}`,
  AI_REQUEST: `async function requestWebAiCompletion(_payload, _options) {
  throw new Error("AI networking is only available through the Narrative Canvas host in Obsidian.");
}`
};
for (const [name, replacement] of Object.entries(pluginOnlyRewrites)) {
  app = replaceMarkedBlock(app, name, replacement);
}

let next = main.replace(
  /const CANVAS_INDEX_HTML = \[[\s\S]*?\]\.join\("\\n"\);/,
  buildIndexConstant(html)
);

next = next.replace(
  /const CANVAS_STYLE_CSS = \[[\s\S]*?\]\.join\("\\n"\);/,
  buildStyleConstant(fs.readFileSync(canvasCssPath, "utf8"))
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

if (checkOnly) {
  console.error("main.js is stale. Run: node scripts/build-plugin-bundle.cjs");
  process.exit(1);
}

fs.writeFileSync(mainPath, `${next.trimEnd()}\n`, "utf8");
