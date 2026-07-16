const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const sourceFiles = ["app.js", "canvas.css", "plugin.css", "index.html", "versions.json", "RELEASE_NOTES.md"];
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
const appSource = readUtf8("app.js");
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

const translationStartMarker = "const uiTranslations = ";
const translationEndMarker = "\n};\n\nfunction normalizeUiLanguage";
const translationStart = appSource.indexOf(translationStartMarker);
const translationEnd = appSource.indexOf(translationEndMarker, translationStart);
let zhTranslations = {};
try {
  const translationSource = appSource.slice(translationStart + translationStartMarker.length, translationEnd + 2);
  zhTranslations = Function(`"use strict"; return (${translationSource});`)().zh || {};
} catch (error) {
  fail(`app.js Chinese translation table could not be inspected: ${error.message}`);
}
const missingDialogTranslations = [];
for (const match of appSource.matchAll(/showGeneric(?:Confirm|TextInput)\(\{([\s\S]*?)\n\s*\}\);/g)) {
  for (const property of match[1].matchAll(/^\s*(kicker|title|message|confirmLabel|secondaryLabel|label):\s*"((?:\\.|[^"\\])*)"/gm)) {
    const value = JSON.parse(`"${property[2]}"`);
    if (!zhTranslations[value]) missingDialogTranslations.push(value);
  }
}
if (missingDialogTranslations.length) {
  fail(`app.js dialogs are missing Chinese translations: ${[...new Set(missingDialogTranslations)].join(" | ")}`);
} else {
  pass("all literal confirm and text-dialog copy has Chinese translations");
}
if (!appSource.includes('const title = t("Delete {label} column?"') || !appSource.includes("const message = t('Hide only hides the column")) {
  fail("event column delete dialog bypasses dynamic localization");
} else {
  pass("event column delete dialog localizes its dynamic title and body");
}

const requiredCommandIds = [
  "new-project",
  "undo",
  "redo",
  "add-content-node",
  "add-dialog-node",
  "add-choice-node",
  "add-frame",
  "duplicate-selected-node",
  "delete-selection",
  "zoom-in",
  "zoom-out",
  "fit-canvas-to-view",
  "focus-selected-node",
  "focus-workspace-search",
  "open-characters",
  "open-events",
  "open-playbook",
  "open-document",
  "start-play-preview",
  "toggle-immersive-fullscreen"
];
const fixedEnglishCommands = [
  ["open", "Open canvas"],
  ["save-to-vault", "Save current project"],
  ["create-sample-project", "Create sample project"],
  ["add-content-node", "Add Basic Node"],
  ["add-dialog-node", "Add Dialog"],
  ["add-choice-node", "Add Choice"],
  ["add-frame", "Add Frame"]
];
for (const [commandId, commandName] of fixedEnglishCommands) {
  const commandPattern = new RegExp(`id: "${commandId}",[\\s\\S]{0,120}name: "${commandName}"`);
  if (!commandPattern.test(main)) fail(`main.js does not keep command ${commandId} in English`);
  else pass(`main.js keeps command ${commandId} in English`);
}
for (const commandId of requiredCommandIds) {
  if (!main.includes(`id: "${commandId}"`)) fail(`main.js is missing command: ${commandId}`);
  else pass(`main.js registers command ${commandId}`);
}
if (!main.includes("name: definition.name")) fail("canvas commands are still localized in Obsidian hotkey settings");
else pass("canvas command names remain English in Obsidian hotkey settings");
if (/name: pluginText\(this, (?:definition\.name|"(?:Open canvas|Save current project|Create sample project)")\)/.test(main)) {
  fail("Obsidian command names still pass through interface localization");
} else {
  pass("Obsidian command names bypass interface localization");
}
if (main.includes("hotkeys:")) fail("main.js assigns default command hotkeys");
else pass("main.js leaves command hotkeys user-configurable");

const aiArtifactRequirements = [
  ["data-floating-window-drag=\\\"ai\\\"", "AI window includes a drag handle"],
  ["data-floating-window=\\\"ai\\\"", "AI window includes resize handles"],
  ["data-action=\"ai-copy-message\"", "AI messages expose copy controls"],
  ["Shift+Enter for a new line", "AI composer documents its send and newline keys"]
];
for (const [token, description] of aiArtifactRequirements) {
  if (!main.includes(token)) fail(`main.js ${description} check failed`);
  else pass(description);
}
if (!main.includes("M5 7h14M5 12h14M5 17h14")) {
  fail("main.js outline toggle does not use the centered SVG icon");
} else {
  pass("outline toggle uses the centered SVG icon");
}
if (!main.includes('class="playbook-end-condition-editor"') || !main.includes('data-runner-rule-field="endCondition" rows="3"')) {
  fail("main.js end condition is not a multiline resizable editor");
} else {
  pass("end condition uses the multiline editor artifact");
}

const styles = readUtf8("styles.css");
const unscopedSelectors = styles
  .split("\n")
  .map((line, index) => ({ line: line.trim(), number: index + 1 }))
  .filter(({ line }) => (
    line.endsWith("{")
    && /^[.#\[:A-Za-z_-]/.test(line)
    && !/^(from|to)\s*\{/.test(line)
    && !line.includes(".narrative-canvas-plugin-host")
    && !line.startsWith(".narrative-canvas-")
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
  ".narrative-canvas-plugin-host .app-shell.app-shell[data-theme=\"light\"]",
  ".narrative-canvas-plugin-host .app-shell.app-shell[data-theme=\"light\"] :is(.ai-title h2, .document-header h2)",
  ".narrative-canvas-plugin-host .nc-checkbox-box",
  ".narrative-canvas-plugin-host .nc-checkbox-field input[type=\"checkbox\"]:checked + .nc-checkbox-box",
  ".narrative-canvas-plugin-host .node.graph-hover-node",
  ".narrative-canvas-plugin-host .link-path.graph-hover-link",
  ".narrative-canvas-plugin-host .node .node-dialog-speaker-input",
  ".narrative-canvas-plugin-host .node .node-choice-label-input",
  ".narrative-canvas-plugin-host .workspace-toc-button > svg",
  ".narrative-canvas-plugin-host .playbook-end-condition-editor",
  ".narrative-canvas-plugin-host .type-dialog-opacity-field .nc-range-track",
  ".narrative-canvas-plugin-host .type-dialog-opacity-field .nc-range-thumb"
];
for (const selector of requiredSelectors) {
  if (!styles.includes(selector)) fail(`styles.css is missing required rule: ${selector}`);
  else pass(`styles.css contains ${selector}`);
}
if (!styles.includes("@media (orientation: portrait) and (max-width: 1200px)")) {
  fail("styles.css is missing the portrait-display layout breakpoint");
} else if (!styles.includes('.narrative-canvas-plugin-host .app-shell[data-play-panel="open"]')) {
  fail("styles.css does not preserve the workspace behind the portrait play overlay");
} else {
  pass("styles.css contains the portrait-display layout constraints");
}
const lightHeadingRule = styles.match(/\.narrative-canvas-plugin-host \.app-shell\.app-shell\[data-theme="light"\] :is\(\.ai-title h2, \.document-header h2\)\s*\{([^}]*)\}/)?.[1] || "";
if (!lightHeadingRule.includes("color: #17181b") || !lightHeadingRule.includes("-webkit-text-fill-color: #17181b") || !lightHeadingRule.includes("opacity: 1")) {
  fail("styles.css does not lock embedded light-theme headings to a readable color");
} else {
  pass("styles.css locks embedded light-theme headings to a readable color");
}
// The custom checkbox must NOT fight the host: the native <input> is neutralized (laid transparent
// over the field) rather than overriding Obsidian's checkbox mark with !important. Guard that the
// input is invisible and that the sibling .nc-checkbox-box carries the checkmark.
const checkboxInputRule = styles.match(/\.narrative-canvas-plugin-host \.nc-checkbox-field input\[type="checkbox"\]\s*\{([^}]*)\}/)?.[1] || "";
const checkboxInputResets = ["opacity: 0", "position: absolute", "appearance: none", "background: transparent", "box-shadow: none", "transform: none"];
if (checkboxInputResets.some((reset) => !checkboxInputRule.includes(reset))) {
  fail("styles.css does not fully neutralize the native checkbox input");
} else {
  pass("styles.css fully neutralizes the native checkbox input");
}
if (styles.includes("input[type=\"checkbox\"]") && /input\[type="checkbox"\][^{]*\{[^}]*!important/.test(styles)) {
  fail("styles.css still uses !important on a checkbox rule");
} else {
  pass("styles.css keeps checkbox rules free of !important");
}
const checkboxMarkRule = styles.match(/input\[type="checkbox"\]:checked \+ \.nc-checkbox-box::before\s*\{([^}]*)\}/)?.[1] || "";
if (!checkboxMarkRule.includes("opacity: 1")) {
  fail("styles.css does not reveal the custom checkbox checkmark when checked");
} else {
  pass("styles.css reveals the custom checkbox checkmark when checked");
}
const checkboxPseudoRule = styles.match(/\.narrative-canvas-plugin-host \.app-shell \.nc-checkbox-field input\[type="checkbox"\]::before,\s*\.narrative-canvas-plugin-host \.app-shell \.nc-checkbox-field input\[type="checkbox"\]::after\s*\{([^}]*)\}/)?.[1] || "";
const checkboxPseudoResets = ["content: none", "display: none", "position: static", "background: transparent", "box-shadow: none", "transform: none"];
if (checkboxPseudoResets.some((reset) => !checkboxPseudoRule.includes(reset))) {
  fail("styles.css does not neutralize the host checkbox pseudo-elements");
} else {
  pass("styles.css neutralizes the host checkbox pseudo-elements");
}
const rangeInputRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field input\[type="range"\]\s*\{([^}]*)\}/)?.[1] || "";
if (!rangeInputRule.includes("opacity: 0") || !rangeInputRule.includes("position: absolute") || !rangeInputRule.includes("appearance: none") || !rangeInputRule.includes("background: transparent") || !rangeInputRule.includes("box-shadow: none")) {
  fail("styles.css does not fully neutralize the native range control");
} else {
  pass("styles.css fully neutralizes the native range control");
}
const rangeWebkitTrackRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field input\[type="range"\]::\-webkit-slider-runnable-track\s*\{([^}]*)\}/)?.[1] || "";
const rangeWebkitThumbRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field input\[type="range"\]::\-webkit-slider-thumb\s*\{([^}]*)\}/)?.[1] || "";
const rangeMozTrackRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field input\[type="range"\]::\-moz-range-track\s*\{([^}]*)\}/)?.[1] || "";
const rangeMozThumbRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field input\[type="range"\]::\-moz-range-thumb\s*\{([^}]*)\}/)?.[1] || "";
const nativeRangeParts = [rangeWebkitTrackRule, rangeWebkitThumbRule, rangeMozTrackRule, rangeMozThumbRule];
if (nativeRangeParts.some((rule) => !rule.includes("background: transparent") || !rule.includes("box-shadow: none") || !rule.includes("border: none"))) {
  fail("styles.css does not neutralize every native range track and thumb pseudo-element");
} else {
  pass("styles.css neutralizes every native range track and thumb pseudo-element");
}
const rangeTrackRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field \.nc-range-track\s*\{([^}]*)\}/)?.[1] || "";
const rangeThumbRule = styles.match(/\.narrative-canvas-plugin-host \.type-dialog-opacity-field \.nc-range-thumb\s*\{([^}]*)\}/)?.[1] || "";
const rangeTrackCentered = rangeTrackRule.includes("inset: 50%") && rangeTrackRule.includes("translateY(-50%)");
const rangeThumbCentered = rangeThumbRule.includes("top: 50%") && rangeThumbRule.includes("translateY(-50%)");
if (!rangeTrackCentered || !rangeThumbCentered) {
  fail("styles.css does not center the custom range track and thumb on the same axis");
} else {
  pass("styles.css centers the custom range track and thumb on the same axis");
}

if (failures.length) {
  console.error(`\nPlugin artifact verification failed with ${failures.length} error(s).`);
  process.exit(1);
}
console.log("\nPlugin artifact verification passed.");
