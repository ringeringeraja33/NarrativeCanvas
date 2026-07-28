const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const releaseFiles = ["main.js", "manifest.json", "styles.css"];
const sourceFiles = ["app.js", "canvas.css", "plugin.css", "index.html", "versions.json", "RELEASE_NOTES.md"];
const supportFiles = [
  "docs/portable-acceptance-summary.schema.json",
  ".github/workflows/plugin-artifacts.yml",
  ".github/workflows/publish-plugin-release.yml",
  ".github/workflows/verify-release-assets.yml"
];
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

for (const relativePath of [...releaseFiles, ...sourceFiles, ...supportFiles]) {
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
const canvasCss = readUtf8("canvas.css");
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
  ["Shift+Enter for a new line", "AI composer documents its send and newline keys"],
  ['data-ai-config="endpoint"', "AI settings include a generic endpoint field"],
  ['data-ai-config="apiKey"', "AI settings include a generic API key field"],
  ['data-ai-config="model"', "AI settings include a generic model field"],
  ["Cinematic storytelling: express dramatic beats through staging", "AI foundational knowledge includes cinematic staging"],
  ["Editing & sound: cut on decisions", "AI foundational knowledge includes editing and sound"]
];
for (const [token, description] of aiArtifactRequirements) {
  if (!main.includes(token)) fail(`main.js ${description} check failed`);
  else pass(description);
}
if (main.includes('data-ai-config="provider"') || main.includes("AI_PROVIDER_GEMINI") || main.includes("GEMINI_DEFAULT_MODEL")) {
  fail("AI settings still expose provider-specific controls or presets");
} else {
  pass("AI settings remain provider-neutral");
}
if (!canvasCss.includes(".toolbar-button {\n  font-weight: 600;")
  || /\.toolbar-button\.active\s*\{[^}]*font-weight:/s.test(canvasCss)
  || !/\.toolbar-button\.active\s*\{[^}]*background:\s*var\(--interactive-accent\);[^}]*color:\s*var\(--text-on-accent\);/s.test(canvasCss)) {
  fail("toolbar buttons do not use a consistent font weight");
} else {
  pass("toolbar buttons use consistent typography and a solid active accent");
}
if (!canvasCss.includes("--text-faint: #686b72;")
  || !canvasCss.includes('.toolbar-button:not(.primary):not(.danger-button):not(.active)')
  || !/:root\[data-theme="light"\] \.toolbar-button\.active,[\s\S]{0,180}background:\s*var\(--interactive-accent\);/.test(canvasCss)
  || !/:root\[data-theme="light"\] \.nc-file-item\.active,[\s\S]{0,300}background:\s*color-mix\(in srgb, var\(--interactive-accent\) 13%/.test(canvasCss)) {
  fail("light theme active controls or secondary text palette are inconsistent");
} else {
  pass("light theme uses readable secondary text, solid active actions, and tinted selected navigation");
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
if (!main.includes('data-action="split-dialog-turns"') || !main.includes("function splitDialogTurns(index)")) {
  fail("main.js is missing the Dialog turn split feature");
} else {
  pass("main.js contains the Dialog turn split feature");
}
if (!main.includes("searchVaultFiles(query, limit = 40, options = {})")
  || !main.includes('data-vault-file-suggestions')
  || !main.includes("function handleVaultFileSuggestionKeyDown(event)")) {
  fail("main.js is missing the Vault file autocomplete feature");
} else {
  pass("main.js contains Vault file autocomplete with keyboard navigation");
}
if (!main.includes('if (!host?.searchVaultFiles) return "";')) {
  fail("Vault file controls are not gated to the plugin host");
} else if (main.includes("NarrativeCanvasVaultFileSuggestModal")) {
  fail("Vault file selection still uses an external Obsidian modal");
} else {
  pass("Vault file controls stay plugin-only and use the fullscreen-safe internal menu");
}
if (!main.includes("leaveImmersiveFullscreenForVaultNavigation")
  || !main.includes("await exitNativeFullscreen()")) {
  fail("Vault file navigation does not exit native fullscreen safely");
} else if (main.includes("Vault file path or [[wiki link]]")) {
  fail("Vault file input still prompts users to type wiki-link syntax");
} else {
  pass("Vault file navigation exits fullscreen before opening and uses the simplified prompt");
}
if (!main.includes("async readVaultFile(reference)")
  || !main.includes("readVaultFile: (reference) => this.plugin.readVaultFile(reference)")
  || !main.includes("async renderVaultMarkdown(markdown, container, sourcePath)")
  || !main.includes("MarkdownRenderer.render(this.app")
  || !main.includes("renderVaultMarkdown: (markdown, container, sourcePath)")
  || !main.includes('if (!host?.readVaultFile || !references.length) return "";')
  || !main.includes('data-action="toggle-node-vault-preview"')
  || !main.includes('renderNodeSectionToggle("vaultFile", t("Vault file"), expanded)')
  || !main.includes("function hydrateVaultFilePreviews()")
  || !main.includes("normalized.vaultFiles = normalizeNodeVaultFiles")
  || !main.includes("data-node-vault-drag=")
  || !main.includes("function moveNodeVaultFileReference(")
  || !main.includes("function setNodeVaultFile(index, value)")) {
  fail("main.js is missing the plugin-only linked Vault file card preview feature");
} else {
  pass("multiple linked Vault files render on cards with ordered, independently persisted preview switches and a collapsible inspector section");
}
if (!main.includes('DEFAULT_CONTENT_FONT_SETTING = "obsidian"') || !main.includes('.addOption("cascadia", "Cascadia Code")') || !main.includes("--nc-plugin-content-font")) {
  fail("main.js is missing the content font setting");
} else {
  pass("main.js contains Obsidian, system, Cascadia Code, and serif content font options");
}
if (!main.includes('DEFAULT_LIBRARY_FOLDER_NAME = "Library"')
  || !main.includes('LEGACY_CODEX_FOLDER_NAME = "Codex"')
  || !main.includes("getNewProjectLayout(savedStateJson, options = {})")
  || !main.includes("await this.ensureFolder(layout.codexFolder)")
  || !main.includes('setName(text("New project root folder"))')) {
  fail("main.js is missing the per-project Library folder or legacy Codex compatibility");
} else {
  pass("new plugin projects create a Library folder while preserving legacy Codex paths");
}
if (!main.includes('data-codex-category-tabs')
  || !main.includes('data-codex-tag-filters')
  || !main.includes("function normalizeCodexKindFilter(value)")
  || !main.includes("function getCastCharacters()")) {
  fail("main.js is missing Codex category, tag, or cast isolation support");
} else {
  pass("Codex keeps category and tag filters while isolating cast entries");
}
if (!main.includes('data-cast-entry-context="new"')
  || !main.includes("data-cast-entry-input")
  || !main.includes("function handleCastEntryPickerKeyDown(")
  || !main.includes('data-node-cast-drag=')
  || !main.includes("function moveNodeCastReference(")
  || !main.includes("CODEX_RELATIONS_BY_KIND")
  || !main.includes("codexId: codexEntry.id")) {
  fail("main.js is missing generalized, ordered Codex references");
} else {
  pass("nodes support category-aware Codex references with stable exports and reordering");
}
if (!main.includes('data-character-tag-input')
  || !main.includes('data-action="remove-codex-tag"')
  || !main.includes('data-action="select-codex-tag-suggestion"')
  || !main.includes("function handleCodexTagKeyDown(")
  || !main.includes('hasAttribute?.("data-character-tag-input")')
  || !main.includes("function updateCodexTagSuggestions(")) {
  fail("main.js is missing the Codex tag token editor or autocomplete");
} else {
  pass("Codex tags use removable tokens with keyboard entry and autocomplete");
}
if (!main.includes('data-action="toggle-character-backlink-group"')
  || !main.includes("function toggleCharacterBacklinkGroup(")
  || !main.includes("function isCharacterBacklinkGroupExpanded(")
  || !main.includes('class="character-backlink-header nc-collapsible-header"')) {
  fail("main.js is missing independently collapsible Codex backlink groups");
} else {
  pass("Codex backlink relations render as independently collapsible sections");
}
if (!main.includes("async syncCodexFiles(savedStateJson")
  || !main.includes("async loadCodexEntries(projectPath")
  || !main.includes("narrative_canvas_codex: true")
  || !main.includes('data-codex-image-drop')
  || !main.includes('data-character-image-picker-input="true"')
  || !main.includes("async importCodexImage(file, entryName = \"\")")
  || !main.includes("function handleCodexImageDrop(event)")
  || !main.includes("getVaultResourceUrl(reference)")) {
  fail("main.js is missing managed Codex Markdown files or the visual image picker");
} else {
  pass("plugin Codex entries sync to Markdown files and use a visual drag-and-drop image picker");
}
if (!main.includes('`notes: ${JSON.stringify(entry.notes)}`')
  || !main.includes('`images: ${JSON.stringify(entry.images)}`')
  || !main.includes('images: data.images')
  || !main.includes('const hasFrontmatterNotes = Object.prototype.hasOwnProperty.call(data, "notes")')
  || !main.includes('markdownBody: hasFrontmatterNotes ? body : ""')
  || !main.includes('markdownBody: diskEntry?.markdownBody || baseline?.markdownBody || ""')) {
  fail("main.js does not migrate Codex notes into frontmatter while preserving Markdown bodies");
} else {
  pass("Codex structured fields and vision-board images live in frontmatter while free Markdown bodies are preserved");
}
if (!main.includes("async deleteCodexEntryFile(entry)")
  || !main.includes('joinVaultPath(folderPath, "Conflicts")')
  || !main.includes("-unparsed-")
  || !main.includes("this.codexFileCache")
  || main.includes("existingEntries.filter((entry) => !targetIds.has(entry.id))")) {
  fail("main.js is missing explicit library deletion, conflict backups, or incremental Markdown sync");
} else {
  pass("Codex Markdown deletion is explicit and sync uses cached fingerprints with conflict backups");
}
if (!main.includes("const CODEX_EXTRA_FIELD_TYPES")
  || !main.includes("serializeCodexFrontmatterValue(field.value)")
  || !main.includes('data-character-extra-part="type"')) {
  fail("main.js is missing typed custom frontmatter fields");
} else {
  pass("Codex custom fields preserve editable scalar, list, and object types");
}
if (!main.includes("cached?.stamp === stamp && cached.entry")
  || !main.includes("this.projectFileValidationCache")
  || !main.includes("cached?.stamp === stamp) return { file, valid: cached.valid, title: cached.title }")) {
  fail("main.js is missing incremental Library or project-index reads");
} else {
  pass("Library Markdown and ribbon project validation reuse unchanged cached files");
}
if (!main.includes("readNarrativeCanvasProjectDescriptor")
  || !main.includes("narrative-canvas-project-picker-new")
  || !main.includes("project.title")
  || !main.includes('executeCommand?.("new-project")')) {
  fail("main.js is missing title-based project selection or its New project action");
} else {
  pass("the multi-project picker uses project titles and exposes New project");
}
if (!main.includes("DEFAULT_BACKUP_INTERVAL_HOURS = 24")
  || !main.includes("PROJECT_BACKUP_FOLDER_NAME = \"Backups\"")
  || !main.includes('"Enable automatic backups": "启用自动备份"')
  || !main.includes("backupEnabled: Boolean(source.backupEnabled)")
  || !main.includes("if (!this.settings.backupEnabled) return \"\";")
  || !main.includes(".setDisabled(!this.plugin.settings.backupEnabled)")
  || !main.includes("await this.maybeCreateProjectBackup(path)")
  || !main.includes("async restoreProjectBackup(")
  || !main.includes("await this.saveCanvasWithoutAutomaticBackup()")
  || !main.includes("backups.slice(retention)")
  || !main.includes("this.app.vault.trash(file, false)")) {
  fail("main.js is missing scheduled, retained, or restorable project backups");
} else {
  pass("automatic backups require opt-in; manual backup, retention, and safety restore remain available");
}
if (!main.includes("externalProjectChangeProtection: source.externalProjectChangeProtection !== false")
  || !main.includes("scheduleProjectExternalChangeCheck(file)")
  || !main.includes("async preserveConflictingProjectWrite(path, savedStateJson)")
  || !main.includes("NARRATIVE_CANVAS_PROJECT_CONFLICT")
  || !main.includes("handleExternalProjectChange")) {
  fail("main.js is missing external project change detection or conflict-copy protection");
} else {
  pass("shared project files reload safely and preserve conflicting local work");
}
if (!main.includes("DEFAULT_PLAY_HISTORY_LIMIT = 30")
  || !main.includes('data-project-field="playHistoryLimit"')
  || !main.includes("function trimPreviewHistory()")
  || !main.includes("const maximum = limit;")
  || !main.includes("function exportPlaySession()")
  || !main.includes('type: "text/markdown;charset=utf-8"')) {
  fail("main.js is missing configurable bounded Play history or UTF-8 playthrough export");
} else {
  pass("Play history defaults to 30 cards, remains bounded, and exports UTF-8 Markdown");
}
if (!main.includes("snapGridButton")
  || !main.includes("toggle-snap-grid")
  || !main.includes("function snapCanvasValue(value, options = {})")) {
  fail("main.js is missing the optional snap-to-grid controls or geometry helper");
} else {
  pass("snap-to-grid remains optional and is applied through the shared geometry helper");
}
if (!main.includes("toggle-choice-timer")
  || !main.includes("function renderChoiceTimerEditor(node)")
  || !main.includes("function ensurePlayChoiceTimer(node, timer, fallbackLink)")) {
  fail("main.js is missing timed Choice authoring or runtime fallback");
} else {
  pass("Choice nodes expose a timed fallback and Play runs its countdown");
}
if (!main.includes("function parseConditionalEffectBody(body, trigger = \"onVisit\")")
  || !main.includes('op: "ifElse"')
  || !main.includes("effect.thenEffect")
  || !main.includes("effect.elseEffect")) {
  fail("main.js is missing conditional if/else state effects");
} else {
  pass("state effects support validated if/else branches and variable references");
}
if (!main.includes('this.app.vault.getConfig?.("attachmentFolderPath")')
  || !main.includes('const assetFolder = attachmentSubpath')
  || !main.includes('data-codex-local-image-input')
  || !main.includes('function persistVisionBoardPosition(kind, id, index, x, y, w)')) {
  fail("main.js is missing Library-scoped attachment imports or vision-board persistence");
} else {
  pass("local images follow the Vault attachment setting inside Library and vision-board positions persist");
}

const buildScript = readUtf8("scripts/build-plugin-bundle.cjs");
const runtimeMarkers = ["AI_CONFIG", "AI_REQUEST", "CLEAR_STORAGE", "PROJECT_STORAGE"];
if (runtimeMarkers.some((name) => !appSource.includes(`// BEGIN WEB_RUNTIME:${name}`) || !appSource.includes(`// END WEB_RUNTIME:${name}`))
  || !buildScript.includes("function replaceMarkedBlock(source, name, replacement)")
  || !buildScript.includes("must appear exactly once")) {
  fail("plugin bundle rewrites are missing explicit, unique source markers");
} else {
  pass("plugin bundle rewrites use explicit, uniquely validated source markers");
}

const workflowSources = supportFiles
  .filter((file) => file.startsWith(".github/workflows/"))
  .map(readUtf8);
const codexSmokePage = readUtf8("tests/codex-plugin-smoke.html");
if (!codexSmokePage.includes('data-codex-smoke-status="running"')
  || workflowSources.some((source) => !source.includes("tests/codex-plugin-smoke.html codex-smoke"))) {
  fail("a workflow status name does not match the codex-plugin-smoke page");
} else {
  pass("workflow browser tests use the status names emitted by their test pages");
}

// Since the shadow-DOM mount, the app stylesheet ships inside main.js; the checks
// below validate canvas.css in its historically scoped form via the same transform
// the styles build used to apply.
const { scopeCss } = require("./build-plugin-styles.cjs");
const styles = scopeCss(readUtf8("canvas.css"));

const shippedStyles = readUtf8("styles.css");
if (shippedStyles.includes(".app-shell") || !shippedStyles.includes("shadow root")) {
  fail("styles.css should only carry plugin chrome since the shadow-DOM mount");
} else {
  pass("styles.css carries only plugin chrome (app styles live in the shadow root)");
}
if (!main.includes("const CANVAS_STYLE_CSS = [")
  || !main.includes("attachShadow({ mode: \"open\" })")
  || !main.includes("function mountCanvasShadow(")
  || !main.includes(":host")) {
  fail("main.js is missing the shadow-root mount or bundled app stylesheet");
} else {
  pass("main.js mounts the app in a shadow root with its bundled stylesheet");
}

if (!styles.includes("grid-template-columns: repeat(var(--codex-masonry-columns, 1), minmax(0, 1fr));")
  || !styles.includes(".narrative-canvas-plugin-host .codex-overview-card::before")
  || !styles.includes(".narrative-canvas-plugin-host .codex-category-tab::before")
  || !styles.includes(".narrative-canvas-plugin-host .codex-tag-filter::after")) {
  fail("styles.css is missing the responsive Codex overview or isolated controls");
} else {
  pass("Codex overview uses responsive compact columns and resets host pseudo-elements");
}
if (!styles.includes(".narrative-canvas-plugin-host .character-backlink-header")
  || !styles.includes(".narrative-canvas-plugin-host .character-backlink-group > .linked-node-list")) {
  fail("styles.css is missing Codex backlink folding-bar styles");
} else {
  pass("Codex backlink folding bars are styled in the plugin host");
}
if (!styles.includes(".narrative-canvas-plugin-host .vision-board-canvas.is-embedded")
  || !styles.includes(".narrative-canvas-plugin-host .vision-board-canvas.is-focused")
  || !styles.includes(".narrative-canvas-plugin-host .vision-board-tile-actions > button::before")
  || !styles.includes(".narrative-canvas-plugin-host .codex-image-picker .vault-file-suggestions")
  || !styles.includes(".narrative-canvas-plugin-host .vault-file-suggestion.codex-image-suggestion > img")) {
  fail("styles.css is missing the isolated Codex image picker or vision board");
} else {
  pass("Codex image picker and embedded/focused vision boards are scoped to the plugin host");
}
if (!styles.includes(".narrative-canvas-plugin-host .vault-preview-toggle::before")
  || !styles.includes(".narrative-canvas-plugin-host .vault-preview-toggle::after")
  || !styles.includes("-webkit-appearance: none;")
  || !styles.includes(".narrative-canvas-plugin-host .node-vault-preview")
  || !styles.includes(".narrative-canvas-plugin-host .node-vault-preview.is-markdown")) {
  fail("styles.css is missing the isolated Vault preview switch or card preview styles");
} else {
  pass("Vault preview switches reset host appearance and pseudo-elements");
}
if (!styles.includes(".narrative-canvas-plugin-host .cast-drag-handle::before")
  || !styles.includes(".narrative-canvas-plugin-host .cast-drag-handle::after")
  || !styles.includes(".narrative-canvas-plugin-host .cast-row-drop-before::before")
  || !styles.includes('.narrative-canvas-plugin-host .node-cast-chip[data-codex-kind="Location"]')) {
  fail("styles.css is missing isolated Codex reorder controls or category markers");
} else {
  pass("Codex reorder controls and category markers are scoped for the plugin host");
}
if (!styles.includes(".narrative-canvas-plugin-host .codex-tag-chip::before")
  || !styles.includes(".narrative-canvas-plugin-host .codex-tag-chip::after")
  || !styles.includes(".narrative-canvas-plugin-host .codex-tag-suggestion::before")
  || !styles.includes(".narrative-canvas-plugin-host .codex-tag-suggestions")) {
  fail("styles.css is missing isolated Codex tag tokens or suggestions");
} else {
  pass("Codex tag tokens and suggestions reset host pseudo-elements");
}
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
  ".narrative-canvas-plugin-host .app-shell .document-editor-input textarea.document-source-editor",
  ".narrative-canvas-plugin-host .nc-checkbox-box",
  ".narrative-canvas-plugin-host .nc-checkbox-field input[type=\"checkbox\"]:checked + .nc-checkbox-box",
  ".narrative-canvas-plugin-host .node.graph-hover-node",
  ".narrative-canvas-plugin-host .link-path.graph-hover-link",
  ".narrative-canvas-plugin-host .node .node-dialog-speaker-input",
  ".narrative-canvas-plugin-host .node .node-choice-label-input",
  ".narrative-canvas-plugin-host .workspace-toc-button > svg",
  ".narrative-canvas-plugin-host .vault-file-suggestions",
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
