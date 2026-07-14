const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const sourceFiles = ["app.js", "canvas.css", "index.html", "versions.json", "RELEASE_NOTES.md"];
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`[fail] ${message}`);
}

function pass(message) {
  console.log(`[ok] ${message}`);
}

function readUtf8(relativePath) {
  const absolutePath = path.join(projectRoot, relativePath);
  const bytes = fs.readFileSync(absolutePath);
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (text.includes("\uFFFD")) fail(`${relativePath} contains replacement characters`);
    return text;
  } catch (error) {
    fail(`${relativePath} is not valid UTF-8: ${error.message}`);
    return "";
  }
}

function runBuildCheck(scriptName, artifactName) {
  const result = spawnSync(process.execPath, [path.join("scripts", scriptName), "--check"], {
    cwd: projectRoot,
    encoding: "utf8"
  });
  if (result.status === 0) {
    pass(`${artifactName} matches its web source`);
    return;
  }
  fail((result.stderr || result.stdout || `${artifactName} build check failed`).trim());
}

for (const relativePath of [...releaseFiles, ...sourceFiles]) {
  const absolutePath = path.join(projectRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }
  readUtf8(relativePath);
}

runBuildCheck("build-plugin-bundle.cjs", "main.js");
runBuildCheck("build-plugin-styles.cjs", "styles.css");

let manifest = null;
let versions = null;
try {
  manifest = JSON.parse(readUtf8("manifest.json"));
  pass("manifest.json is valid JSON");
} catch (error) {
  fail(`manifest.json is invalid JSON: ${error.message}`);
}
try {
  versions = JSON.parse(readUtf8("versions.json"));
  pass("versions.json is valid JSON");
} catch (error) {
  fail(`versions.json is invalid JSON: ${error.message}`);
}

if (manifest) {
  if (manifest.id !== "narrative-canvas") fail("manifest id must be narrative-canvas");
  else pass("manifest id is narrative-canvas");
  if (!manifest.version || versions?.[manifest.version] !== manifest.minAppVersion) {
    fail("manifest version and minAppVersion must match versions.json");
  } else {
    pass(`manifest version ${manifest.version} matches versions.json`);
  }
  if (/Obsidian/i.test(String(manifest.description || ""))) {
    fail("manifest description contains Obsidian");
  } else {
    pass("manifest description avoids Obsidian");
  }
  const releaseNotes = readUtf8("RELEASE_NOTES.md");
  if (!releaseNotes.startsWith(`# Narrative Canvas ${manifest.version}\n`)) {
    fail("RELEASE_NOTES.md heading must match the manifest version");
  } else if (!releaseNotes.includes("## 中文")) {
    fail("RELEASE_NOTES.md is missing its Chinese section");
  } else {
    pass("RELEASE_NOTES.md matches the manifest version and preserves Chinese content");
  }
}

const main = readUtf8("main.js");
if (!main.includes("// BEGIN bundled app.js") || !main.includes("// END bundled app.js")) {
  fail("main.js is missing bundled app markers");
} else {
  pass("main.js contains the bundled web app");
}
if (!main.includes("对话节点") || !main.includes("选择节点")) {
  fail("main.js is missing expected UTF-8 Chinese content");
} else {
  pass("main.js preserves expected Chinese content");
}

const styles = readUtf8("styles.css");
const unscopedSelectors = styles
  .split("\n")
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => (
    line.endsWith("{")
    && /^[.#\[:A-Za-z_-]/.test(line)
    && !/^(from|to)\s*\{/.test(line)
    && !line.startsWith(".narrative-canvas-plugin-host")
  ));
if (unscopedSelectors.length) {
  fail(`styles.css has unscoped selectors at lines ${unscopedSelectors.slice(0, 8).map((item) => item.number).join(", ")}`);
} else {
  pass("styles.css selectors are scoped to the plugin host");
}
if (/\.narrative-canvas-plugin-host\s*\/\*/.test(styles)) {
  fail("styles.css contains a comment inside a generated selector");
} else {
  pass("styles.css comments are outside generated selectors");
}

const requiredSelectors = [
  ".narrative-canvas-plugin-host .node.graph-hover-node",
  ".narrative-canvas-plugin-host .link-path.graph-hover-link",
  ".narrative-canvas-plugin-host .node .node-dialog-speaker-input",
  ".narrative-canvas-plugin-host .node .node-choice-label-input"
];
for (const selector of requiredSelectors) {
  if (!styles.includes(selector)) fail(`styles.css is missing required rule: ${selector}`);
  else pass(`styles.css contains ${selector}`);
}

if (failures.length) {
  console.error(`\nPlugin artifact verification failed with ${failures.length} error(s).`);
  process.exit(1);
}
console.log("\nPlugin artifact verification passed.");
