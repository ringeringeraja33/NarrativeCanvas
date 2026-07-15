const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const projectRoot = path.resolve(__dirname, "..");
const defaultFixture = path.join(projectRoot, "tests", "fixtures", "state-runtime-key-play.ncanvas");
const defaultStoryFixture = path.join(projectRoot, "tests", "fixtures", "story-source-acceptance.story.md");
const defaultStoryLayoutFixture = path.join(projectRoot, "tests", "fixtures", "story-source-acceptance.layout.json");
const defaultStoryStateFixture = path.join(projectRoot, "tests", "fixtures", "story-source-acceptance.state.schema.json");
const defaultToolCache = path.join(os.homedir(), ".cache", "narrative-canvas-export-tools");

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printUsage();
  process.exit(0);
}
const useStoryFixture = Boolean(args["story-fixture"]);
const autoSidecars = Boolean(args["auto-sidecars"]);
const decisionGate = Boolean(args["decision-gate"]);
const requireLayout = Boolean(args["require-layout"]);
const requireState = Boolean(args["require-state"]);
const fixturePath = path.resolve(args.fixture || defaultFixture);
const storySourcePath = args.story ? path.resolve(args.story) : useStoryFixture ? defaultStoryFixture : "";
let layoutSourcePath = args.layout ? path.resolve(args.layout) : useStoryFixture ? defaultStoryLayoutFixture : "";
let stateSourcePath = args.state ? path.resolve(args.state) : useStoryFixture ? defaultStoryStateFixture : "";
let routeCasesPath = args["route-cases"] ? path.resolve(args["route-cases"]) : "";
if (autoSidecars && storySourcePath) {
  const detectedSidecars = detectStorySidecars(storySourcePath);
  if (!layoutSourcePath && detectedSidecars.layout) layoutSourcePath = detectedSidecars.layout;
  if (!stateSourcePath && detectedSidecars.state) stateSourcePath = detectedSidecars.state;
  if (!routeCasesPath && detectedSidecars.routeCases) routeCasesPath = detectedSidecars.routeCases;
}
const sourceMode = storySourcePath ? "story" : "fixture";
const keepOutput = Boolean(args["keep-output"]);
const summaryPath = args.summary ? path.resolve(args.summary) : "";
const reportPath = args.report ? path.resolve(args.report) : "";
const requestedOutputDir = args["output-dir"] ? path.resolve(args["output-dir"]) : "";
const cleanOutputDir = Boolean(args["clean-output"]);
const routeTemplatePath = args["write-route-template"] ? path.resolve(args["write-route-template"]) : "";
const maxExportWarnings = normalizeOptionalNonNegativeInteger(args["max-warnings"], "--max-warnings");
const minRouteCases = normalizeOptionalPositiveInteger(args["min-route-cases"], "--min-route-cases");
const allowedWarningCodes = normalizeListArg(args["allow-warning-code"]);
const timeoutMs = Number(args.timeout || 45000);
const storyRouteOptions = {
  choiceLabels: withStoryFixtureDefaultList(args["choice-label"], ["Board the train", "Take left door"]),
  minVisits: normalizePositiveInteger(args["min-visits"] || (useStoryFixture ? "4" : "")),
  expectText: withStoryFixtureDefaultList(args["expect-text"], ["Route: left"]),
  expectNode: withStoryFixtureDefaultList(args["expect-node"], ["Aboard"]),
  expectState: withStoryFixtureDefaultState(args["expect-state"], ["route=left"])
};
const storyRouteCases = routeCasesPath ? loadRouteCases(routeCasesPath) : [createRouteCase("default", storyRouteOptions)];
const chromePath = findChrome();
const tools = {
  ysc: resolveExecutable("YSC", [
    path.join(defaultToolCache, "ysc-3.2.2", "ysc")
  ]),
  inklecate: resolveExecutable("INKLECATE", [
    path.join(defaultToolCache, "inklecate-1.2.1", "inklecate")
  ]),
  tweego: resolveExecutable("TWEEGO", [
    path.join(defaultToolCache, "tweego-2.1.1", "tweego")
  ])
};

main().catch((error) => {
  console.error(`[fail] ${error.message || error}`);
  process.exit(1);
});

async function main() {
  validateRouteCaseThreshold();
  validateLayoutRequirement();
  validateStateRequirement();
  validateDecisionGateInputs();
  if (sourceMode === "story") {
    assertFileExists(storySourcePath, "story");
    if (layoutSourcePath) assertFileExists(layoutSourcePath, "layout");
    if (stateSourcePath) assertFileExists(stateSourcePath, "state");
  } else {
    assertFileExists(fixturePath, "fixture");
  }
  Object.entries(tools).forEach(([name, toolPath]) => assertFileExists(toolPath, name));

  const outputContext = prepareOutputDirectory();
  const outputDir = outputContext.path;
  const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), "narrative-canvas-acceptance-"));
  try {
    console.log(sourceMode === "story"
      ? `[info] story: ${path.relative(process.cwd(), storySourcePath)}`
      : `[info] fixture: ${path.relative(projectRoot, fixturePath)}`);
    if (layoutSourcePath) console.log(`[info] layout: ${path.relative(process.cwd(), layoutSourcePath)}`);
    if (stateSourcePath) console.log(`[info] state: ${path.relative(process.cwd(), stateSourcePath)}`);
    if (routeCasesPath) console.log(`[info] route cases: ${path.relative(process.cwd(), routeCasesPath)}`);
    console.log(`[info] output: ${outputDir}`);
    console.log(`[info] chrome: ${chromePath}`);

    const exported = exportFixtureWithChrome({
      outputDir,
      scratchDir,
      fixturePath,
      storySourcePath,
      layoutSourcePath,
      stateSourcePath,
      sourceMode,
      timeoutMs
    });
    writeExportedFiles(outputDir, exported);

    let routeSummary = null;
    let routeCasesSummary = [];
    let exportWarnings = [];
    if (sourceMode === "story") {
      const storySummary = validateStorySourceExport(outputDir, scratchDir);
      routeSummary = storySummary.route;
      routeCasesSummary = storySummary.routeCases;
      exportWarnings = storySummary.warnings;
    } else {
      const storyPath = path.join(outputDir, "state-runtime-key-play-story.md");
      const layoutPath = path.join(outputDir, "state-runtime-key-play-layout.json");
      const stateSchemaPath = path.join(outputDir, "state-runtime-key-play-state.schema.json");
      const exportProfilePath = path.join(outputDir, "state-runtime-key-play-export.profile.json");
      const runtimePath = path.join(outputDir, "state-runtime-key-play-runtime.json");
      const yarnPath = path.join(outputDir, "state-runtime-key-play.yarn");
      const inkPath = path.join(outputDir, "state-runtime-key-play.ink");
      const tweePath = path.join(outputDir, "state-runtime-key-play.twee");

      validateStoryMarkdown(storyPath);
      validateStoryLayout(layoutPath);
      validateStateSchema(stateSchemaPath);
      const profile = validateExportProfile(exportProfilePath);
      exportWarnings = validateExportWarningLimit(profile);
      validateRuntimeJson(runtimePath);
      if (routeTemplatePath) writeRouteCaseTemplate(routeTemplatePath, runtimePath);
      validateYarn(yarnPath, scratchDir);
      validateYarnPlaythrough(yarnPath);
      validateInk(inkPath, scratchDir);
      validateInkPlaythrough(inkPath);
      validateTwee(tweePath, scratchDir);
    }

    if (summaryPath || reportPath) {
      const acceptanceSummary = buildAcceptanceSummary({ exported, outputDir, routeSummary, routeCasesSummary, exportWarnings });
      validateAcceptanceSummary(acceptanceSummary);
      if (summaryPath) writeAcceptanceSummary(summaryPath, acceptanceSummary);
      if (reportPath) writeAcceptanceReport(reportPath, acceptanceSummary);
    }
    console.log("[ok] portable export acceptance passed");
  } finally {
    if (fs.existsSync(scratchDir)) fs.rmSync(scratchDir, { recursive: true, force: true });
    if (outputContext.temporary && !keepOutput && fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    } else {
      console.log(`[info] kept output: ${outputDir}`);
    }
  }
}

function parseArgs(items) {
  const result = {};
  const repeatable = new Set(["allow-warning-code", "choice-label", "expect-text", "expect-node", "expect-state"]);
  const booleanFlags = new Set(["auto-sidecars", "clean-output", "decision-gate", "help", "keep-output", "require-layout", "require-state", "story-fixture"]);
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    if (booleanFlags.has(key)) {
      result[key] = true;
      continue;
    }
    const value = items[index + 1] || "";
    if (repeatable.has(key)) {
      if (!Array.isArray(result[key])) result[key] = [];
      result[key].push(value);
    } else {
      result[key] = value;
    }
    index += 1;
  }
  return result;
}

function printUsage() {
  console.log(`Usage:
  node scripts/portable-export-acceptance.cjs [options]

Fixture checks:
  --fixture path/to/project.ncanvas       Use a .ncanvas fixture instead of the default

Story source checks:
  --story path/to/story.md                Import Story Markdown, then export portable targets
  --layout path/to/story-layout.json      Apply a Layout JSON sidecar before export
  --state path/to/state.schema.json       Apply a State Schema sidecar before export
  --auto-sidecars                         Find matching layout/state/route sidecars beside --story
  --require-layout                        Require a Layout JSON sidecar and verify it re-exports
  --require-state                         Require a State Schema sidecar
  --story-fixture                         Run the built-in Story Markdown regression fixture

Route assertions:
  --choice-label label                    Select a route choice; repeat for multiple choice nodes
  --min-route-cases count                 Require at least count route cases
  --min-visits count                      Require route runners to visit at least count nodes/passages
  --expect-node title-or-id               Require a visited node; repeatable
  --expect-text text                      Require output text; repeatable
  --expect-state key=value                Require final state; repeatable
  --route-cases path/to/routes.json       Run multiple named route assertion cases
  --write-route-template path/to/routes.json
                                          Write editable route cases from Runtime JSON

Other:
  --allow-warning-code code               Exclude reviewed Export Profile warning codes from --max-warnings; repeatable
  --clean-output                          Empty --output-dir before writing acceptance artifacts
  --decision-gate                         Require a real story source, layout sidecar, route cases, fixed output, summary, report, and warning threshold
  --keep-output                           Keep exported files in the temp output directory
  --max-warnings count                    Fail if Export Profile warnings exceed count
  --output-dir path                       Write exported artifacts to a fixed empty directory
  --report path                           Write a Markdown acceptance report
  --summary path                          Write a JSON acceptance summary
  --timeout ms                            Chrome export and virtual-time timeout, default 45000
  --help                                  Show this help`);
}

function detectStorySidecars(storyPath) {
  return {
    layout: findFirstExisting(getStorySidecarCandidates(storyPath, "layout")),
    state: findFirstExisting(getStorySidecarCandidates(storyPath, "state")),
    routeCases: findFirstExisting(getStorySidecarCandidates(storyPath, "routeCases"))
  };
}

function prepareOutputDirectory() {
  if (!requestedOutputDir) {
    if (cleanOutputDir) throw new Error("--clean-output requires --output-dir.");
    return {
      path: fs.mkdtempSync(path.join(os.tmpdir(), "narrative-canvas-portable-export-")),
      temporary: true
    };
  }
  if (fs.existsSync(requestedOutputDir)) {
    const stats = fs.statSync(requestedOutputDir);
    if (!stats.isDirectory()) throw new Error(`--output-dir is not a directory: ${requestedOutputDir}`);
    const entries = fs.readdirSync(requestedOutputDir);
    if (entries.length) {
      if (!cleanOutputDir) {
        throw new Error(`--output-dir must be empty to avoid stale acceptance artifacts: ${requestedOutputDir}. Pass --clean-output to remove existing contents.`);
      }
      fs.rmSync(requestedOutputDir, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(requestedOutputDir, { recursive: true });
  return {
    path: requestedOutputDir,
    temporary: false
  };
}

function getStorySidecarCandidates(storyPath, kind) {
  const directory = path.dirname(storyPath);
  const extensionless = path.basename(storyPath, path.extname(storyPath));
  const roots = unique([extensionless, extensionless.replace(/(?:[-_.])story$/i, "")]).filter(Boolean);
  const suffixes = kind === "layout"
    ? ["-layout.json", ".layout.json", "-story-layout.json", ".story-layout.json"]
    : kind === "routeCases"
      ? ["-routes.json", ".routes.json", "-route-cases.json", ".route-cases.json"]
      : ["-state.schema.json", ".state.schema.json", "-state.json", ".state.json"];
  const candidates = roots.flatMap((root) => suffixes.map((suffix) => path.join(directory, `${root}${suffix}`)));
  if (kind === "layout") candidates.push(path.join(directory, "layout.json"));
  if (kind === "state") candidates.push(path.join(directory, "state.schema.json"));
  if (kind === "routeCases") candidates.push(path.join(directory, "routes.json"));
  return unique(candidates);
}

function findFirstExisting(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || "";
}

function unique(items) {
  return [...new Set(items)];
}

function validateDecisionGateInputs() {
  if (!decisionGate) return;
  assert(sourceMode === "story" && storySourcePath && !useStoryFixture, "--decision-gate requires --story path/to/story.md and cannot use --story-fixture.");
  assertFileExists(storySourcePath, "story");
  assert(path.resolve(storySourcePath) !== path.resolve(defaultStoryFixture), "--decision-gate cannot use the built-in story fixture; pass a real story source.");
  assert(!isBuiltInStoryFixtureContent(storySourcePath), "--decision-gate cannot use a copy of the built-in story fixture; pass a real story source.");
  assert(layoutSourcePath, "--decision-gate requires --layout path/to/story-layout.json or a matching layout sidecar found by --auto-sidecars.");
  assert(routeCasesPath, "--decision-gate requires --route-cases path/to/routes.json or a matching route sidecar found by --auto-sidecars.");
  assert(storyRouteCases.length >= getRequiredRouteCaseCount(), `--decision-gate requires at least ${getRequiredRouteCaseCount()} route case(s).`);
  const emptyAssertionCases = storyRouteCases.filter((routeCase) => !hasRouteCaseAssertions(routeCase)).map((routeCase) => routeCase.name);
  assert(emptyAssertionCases.length === 0, `--decision-gate route cases need at least one expectNode, expectText, or expectState assertion: ${emptyAssertionCases.join(", ")}`);
  assert(summaryPath, "--decision-gate requires --summary path/to/acceptance-summary.json.");
  assert(reportPath, "--decision-gate requires --report path/to/acceptance-report.md.");
  assert(requestedOutputDir, "--decision-gate requires --output-dir path/to/acceptance-output.");
  assert(maxExportWarnings !== null, "--decision-gate requires --max-warnings count so warning tolerance is explicit.");
}

function validateLayoutRequirement() {
  if (!isLayoutRequired()) return;
  if (decisionGate && sourceMode !== "story") return;
  assert(sourceMode === "story", "--require-layout requires --story or --story-fixture.");
  assert(layoutSourcePath, decisionGate
    ? "--decision-gate requires --layout path/to/story-layout.json or a matching layout sidecar found by --auto-sidecars."
    : "--require-layout requires --layout path/to/story-layout.json or a matching layout sidecar found by --auto-sidecars.");
}

function isLayoutRequired() {
  return requireLayout || decisionGate;
}

function isRealStorySource() {
  return sourceMode === "story"
    && Boolean(storySourcePath)
    && !useStoryFixture
    && path.resolve(storySourcePath) !== path.resolve(defaultStoryFixture)
    && !isBuiltInStoryFixtureContent(storySourcePath);
}

function isBuiltInStoryFixtureContent(filePath) {
  if (!filePath || !fs.existsSync(filePath) || !fs.existsSync(defaultStoryFixture)) return false;
  return getFileSha256(filePath) === getFileSha256(defaultStoryFixture);
}

function validateStateRequirement() {
  if (!requireState) return;
  assert(sourceMode === "story", "--require-state requires --story or --story-fixture.");
  assert(stateSourcePath, "--require-state requires --state path/to/state.schema.json or a matching state sidecar found by --auto-sidecars.");
}

function validateRouteCaseThreshold() {
  if (minRouteCases === null) return;
  assert(sourceMode === "story", "--min-route-cases requires --story or --story-fixture.");
  assert(storyRouteCases.length >= minRouteCases, `Route case count ${storyRouteCases.length} is below --min-route-cases ${minRouteCases}.`);
}

function getRequiredRouteCaseCount() {
  return minRouteCases || (decisionGate ? 1 : 0);
}

function hasRouteCaseAssertions(routeCase) {
  return normalizeListArg(routeCase?.expectNode).length > 0
    || normalizeListArg(routeCase?.expectText).length > 0
    || (Array.isArray(routeCase?.expectState) && routeCase.expectState.length > 0);
}

function normalizeStringArg(value) {
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

function normalizeListArg(value) {
  return (Array.isArray(value) ? value : value ? [value] : [])
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function withStoryFixtureDefaultList(value, defaults) {
  const items = normalizeListArg(value);
  return items.length || !useStoryFixture ? items : [...defaults];
}

function withStoryFixtureDefaultState(value, defaults) {
  const items = normalizeListArg(value);
  return parseExpectedStateArgs(items.length || !useStoryFixture ? items : defaults);
}

function loadRouteCases(filePath) {
  assertFileExists(filePath, "route cases");
  const document = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "portable-route-cases.schema.json"), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(document, schema);
  assert(schemaErrors.length === 0, `Route cases match schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  const cases = Array.isArray(document.cases) ? document.cases : [];
  assert(cases.length > 0, "Route cases file must contain at least one case.");
  console.log(`[ok] Route cases match schema (${cases.length})`);
  return cases.map((item, index) => createRouteCase(normalizeStringArg(item.name) || `case-${index + 1}`, {
    choiceLabels: normalizeListArg(item.choiceLabels),
    minVisits: normalizePositiveInteger(item.minVisits),
    expectText: normalizeListArg(item.expectText),
    expectNode: normalizeListArg(item.expectNode),
    expectState: normalizeRouteCaseExpectedState(item.expectState)
  }));
}

function createRouteCase(name, options = {}) {
  return {
    name: normalizeStringArg(name) || "default",
    choiceLabels: normalizeListArg(options.choiceLabels),
    minVisits: normalizePositiveInteger(options.minVisits),
    expectText: normalizeListArg(options.expectText),
    expectNode: normalizeListArg(options.expectNode),
    expectState: Array.isArray(options.expectState) ? options.expectState.map((item) => ({ key: item.key, value: item.value })) : []
  };
}

function normalizeRouteCaseExpectedState(value) {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === "string") return parseExpectedStateArgs([item])[0];
      if (isPlainObject(item)) {
        const key = normalizeStringArg(item.key);
        if (!key) throw new Error("Route case expectState item is missing key.");
        return { key, value: item.value };
      }
      throw new Error(`Unsupported route case expectState item: ${JSON.stringify(item)}`);
    });
  }
  if (isPlainObject(value)) {
    return Object.entries(value).map(([key, itemValue]) => ({ key, value: itemValue }));
  }
  return [];
}

function normalizePositiveInteger(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeOptionalNonNegativeInteger(value, label) {
  const text = normalizeStringArg(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer.`);
  return number;
}

function normalizeOptionalPositiveInteger(value, label) {
  const text = normalizeStringArg(value);
  if (!text) return null;
  const number = Number(text);
  if (!Number.isInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer.`);
  return number;
}

function parseExpectedStateArgs(value) {
  return normalizeListArg(value).map((item) => {
    const index = item.indexOf("=");
    if (index <= 0) throw new Error(`Expected state assertion as key=value: ${item}`);
    return {
      key: item.slice(0, index).trim(),
      value: parseExpectedStateValue(item.slice(index + 1).trim())
    };
  });
}

function parseExpectedStateValue(source) {
  const text = String(source || "").trim();
  if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("{") && text.endsWith("}"))) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text;
    }
  }
  return parseLiteral(text);
}

function resolveExecutable(envName, candidates) {
  const explicit = process.env[envName];
  if (explicit) return path.resolve(explicit);
  const toolCache = process.env.NARRATIVE_CANVAS_TOOL_CACHE || defaultToolCache;
  const normalized = candidates.map((candidate) => {
    return candidate.startsWith(defaultToolCache)
      ? path.join(toolCache, path.relative(defaultToolCache, candidate))
      : candidate;
  });
  const found = normalized.find((candidate) => fs.existsSync(candidate));
  return found || normalized[0];
}

function findChrome() {
  if (process.env.NARRATIVE_CANVAS_CHROME) return path.resolve(process.env.NARRATIVE_CANVAS_CHROME);
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    localAppData ? path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe") : "",
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    localAppData ? path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe") : ""
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (found) return found;
  const commandFound = findExecutableOnPath(["chrome.exe", "chrome", "chromium", "chromium-browser", "msedge.exe", "msedge"]);
  if (!commandFound) {
    throw new Error("Chrome, Chromium, or Edge was not found. Set NARRATIVE_CANVAS_CHROME to a Chromium-based browser.");
  }
  return commandFound;
}

function findExecutableOnPath(commandNames) {
  const lookup = process.platform === "win32" ? "where.exe" : "which";
  for (const commandName of commandNames) {
    const result = childProcess.spawnSync(lookup, [commandName], { encoding: "utf8", windowsHide: true });
    if (result.status !== 0) continue;
    const candidate = String(result.stdout || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line && fs.existsSync(line));
    if (candidate) return candidate;
  }
  return "";
}

function assertFileExists(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`);
}

function writeRouteCaseTemplate(filePath, runtimePath) {
  const document = validateDocumentSchema(runtimePath, "docs/runtime-json.schema.json", "Runtime JSON route template source");
  const routeCases = buildRouteCaseTemplate(document);
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "portable-route-cases.schema.json"), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(routeCases, schema);
  assert(schemaErrors.length === 0, `Route case template matches schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(routeCases, null, 2)}\n`, "utf8");
  console.log(`[ok] route case template written: ${formatLocalPath(filePath)} (${routeCases.cases.length} case(s))`);
}

function buildRouteCaseTemplate(document) {
  const terminals = discoverRuntimeRouteTerminals(document);
  return {
    format: "narrative-canvas-route-cases",
    version: 1,
    cases: terminals.map((terminal, index) => buildRouteCaseFromTerminal(terminal, index))
  };
}

function discoverRuntimeRouteTerminals(document) {
  const maxCases = 24;
  const stack = [{ choiceLabels: [] }];
  const terminalCases = [];
  const expanded = new Set();
  while (stack.length && terminalCases.length < maxCases) {
    const current = stack.shift();
    const key = JSON.stringify(current.choiceLabels);
    if (expanded.has(key)) continue;
    expanded.add(key);
    const result = probeRuntimeRoute(document, current.choiceLabels);
    if (result.kind === "choice") {
      result.choices.forEach((choice) => {
        stack.push({ choiceLabels: [...current.choiceLabels, choice.label || choice.id] });
      });
    } else {
      terminalCases.push(result);
    }
  }
  return terminalCases.length ? terminalCases : [probeRuntimeRoute(document, [])];
}

function probeRuntimeRoute(document, choiceLabels) {
  const session = createRuntimeSession(document);
  const remainingChoices = [...choiceLabels];
  const visited = [];
  const seen = new Set();
  const output = [];
  let finalState = {};
  for (let index = 0; index < 50; index += 1) {
    const page = session.current();
    visited.push({ id: page.node.id, slug: page.node.slug, title: page.node.title });
    seen.add(page.node.id);
    finalState = page.state || {};
    output.push(page.body);
    Object.values(page.customFields || {}).forEach((value) => output.push(String(value || "")));
    if (page.choices.length) {
      if (!remainingChoices.length) {
        return {
          kind: "choice",
          choiceLabels,
          choices: page.choices,
          visited,
          output: output.filter(Boolean).join("\n"),
          state: finalState
        };
      }
      const label = remainingChoices.shift();
      const choice = page.choices.find((item) => item.id === label || item.label === label);
      if (!choice || !session.choose(choice.id)) break;
    } else if (!session.advance()) {
      return {
        kind: "terminal",
        choiceLabels,
        visited,
        output: output.filter(Boolean).join("\n"),
        state: finalState
      };
    }
    const next = session.currentNodeId();
    if (!next || seen.has(next)) break;
  }
  return {
    kind: "terminal",
    choiceLabels,
    visited,
    output: output.filter(Boolean).join("\n"),
    state: finalState
  };
}

function buildRouteCaseFromTerminal(terminal, index) {
  const lastVisit = terminal.visited[terminal.visited.length - 1] || {};
  return {
    name: createRouteTemplateCaseName(terminal, index),
    choiceLabels: terminal.choiceLabels,
    minVisits: terminal.visited.length,
    expectNode: [lastVisit.slug || lastVisit.title || lastVisit.id || ""].filter(Boolean),
    expectText: getRouteTemplateExpectedText(terminal.output),
    expectState: Object.entries(terminal.state || {}).map(([key, value]) => ({ key, value }))
  };
}

function createRouteTemplateCaseName(terminal, index) {
  const lastVisit = terminal.visited[terminal.visited.length - 1] || {};
  const source = terminal.choiceLabels.length
    ? terminal.choiceLabels.join("-")
    : lastVisit.slug || lastVisit.title || lastVisit.id || `route-${index + 1}`;
  return slugifyRouteCaseName(source) || `route-${index + 1}`;
}

function slugifyRouteCaseName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getRouteTemplateExpectedText(output) {
  const lines = String(output || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? [lines[lines.length - 1]] : [];
}

function buildAcceptanceSummary({ exported, outputDir, routeSummary, routeCasesSummary, exportWarnings }) {
  const gate = buildDecisionGateSummary(routeCasesSummary, exportWarnings);
  const fileEvidence = buildFileEvidence(exported, outputDir);
  return {
    format: "narrative-canvas-portable-acceptance",
    version: 1,
    status: "pass",
    sourceMode,
    inputs: {
      fixture: sourceMode === "fixture" ? formatLocalPath(fixturePath) : "",
      story: storySourcePath ? formatLocalPath(storySourcePath) : "",
      layout: layoutSourcePath ? formatLocalPath(layoutSourcePath) : "",
      state: stateSourcePath ? formatLocalPath(stateSourcePath) : "",
      routeCases: routeCasesPath ? formatLocalPath(routeCasesPath) : "",
      routeTemplate: routeTemplatePath ? formatLocalPath(routeTemplatePath) : "",
      report: reportPath ? formatLocalPath(reportPath) : ""
    },
    options: {
      autoSidecars,
      allowedWarningCodes: [...allowedWarningCodes],
      cleanOutput: cleanOutputDir,
      keepOutput,
      maxWarnings: maxExportWarnings,
      minRouteCases,
      requireLayout: isLayoutRequired(),
      requireState,
      timeoutMs,
      route: {
        choiceLabels: [...storyRouteOptions.choiceLabels],
        minVisits: storyRouteOptions.minVisits,
        expectNode: [...storyRouteOptions.expectNode],
        expectText: [...storyRouteOptions.expectText],
        expectState: storyRouteOptions.expectState.map((item) => ({ key: item.key, value: item.value }))
      }
    },
    exportedFiles: exported
      .map((item) => item.filename)
      .filter(Boolean)
      .sort(),
    consumers: {
      runtimeJson: "pass",
      yarn: "pass",
      ink: "pass",
      twee: "pass"
    },
    warnings: {
      count: exportWarnings.length,
      allowedCount: exportWarnings.filter((warning) => isAllowedWarning(warning)).length,
      unreviewedCount: getUnreviewedWarnings(exportWarnings).length,
      items: exportWarnings
    },
    gate,
    fileEvidence,
    route: routeSummary || null,
    routeCases: routeCasesSummary || [],
    outputDir: keepOutput || requestedOutputDir ? formatLocalPath(outputDir) : ""
  };
}

function buildFileEvidence(exported, outputDir) {
  const inputFiles = [];
  if (sourceMode === "fixture") inputFiles.push({ role: "fixture", filePath: fixturePath });
  if (storySourcePath) inputFiles.push({ role: "story", filePath: storySourcePath });
  if (layoutSourcePath) inputFiles.push({ role: "layout", filePath: layoutSourcePath });
  if (stateSourcePath) inputFiles.push({ role: "state", filePath: stateSourcePath });
  if (routeCasesPath) inputFiles.push({ role: "route-cases", filePath: routeCasesPath });
  const artifactFiles = exported
    .map((item) => item.filename)
    .filter(Boolean)
    .sort()
    .map((filename) => ({ role: "export", filePath: path.join(outputDir, filename), pathLabel: filename }));
  return {
    inputs: inputFiles.filter((item) => fs.existsSync(item.filePath)).map(toFileEvidenceItem),
    artifacts: artifactFiles.filter((item) => fs.existsSync(item.filePath)).map(toFileEvidenceItem)
  };
}

function toFileEvidenceItem({ role, filePath, pathLabel }) {
  const buffer = fs.readFileSync(filePath);
  return {
    role,
    path: pathLabel || formatLocalPath(filePath),
    bytes: buffer.length,
    sha256: hashBuffer(buffer)
  };
}

function getFileSha256(filePath) {
  return hashBuffer(fs.readFileSync(filePath));
}

function hashBuffer(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function buildDecisionGateSummary(routeCasesSummary, exportWarnings) {
  const realStorySource = isRealStorySource();
  const routeCases = Array.isArray(routeCasesSummary) ? routeCasesSummary : [];
  const routeConsumers = [];
  if (routeCases.some((routeCase) => routeCase.runtimeJson)) routeConsumers.push("runtime-json");
  if (routeCases.some((routeCase) => routeCase.yarn)) routeConsumers.push("yarn");
  if (routeCases.some((routeCase) => routeCase.ink)) routeConsumers.push("ink");
  if (routeCases.some((routeCase) => routeCase.twee)) routeConsumers.push("twee");
  const routeAssertionsReady = routeCases.length > 0 && routeCases.every((routeCase) => hasRouteCaseAssertions(routeCase.options || routeCase));
  const requiredRouteCaseCount = getRequiredRouteCaseCount();
  const routeCaseCountReady = routeCases.length >= requiredRouteCaseCount;
  const layoutProvided = Boolean(layoutSourcePath);
  const layoutRequired = isLayoutRequired();
  const layoutReady = !layoutRequired || layoutProvided;
  const stateProvided = Boolean(stateSourcePath);
  const stateReady = !requireState || stateProvided;
  const unreviewedWarnings = getUnreviewedWarnings(exportWarnings);
  const warningThresholdExplicit = maxExportWarnings !== null;
  const warningsWithinThreshold = warningThresholdExplicit ? unreviewedWarnings.length <= maxExportWarnings : null;
  return {
    decisionGate,
    realStorySource,
    routeCaseCount: routeCases.length,
    requiredRouteCaseCount,
    routeCaseCountReady,
    routeConsumers,
    routeAssertionsReady,
    layoutRequired,
    layoutProvided,
    layoutReady,
    stateRequired: requireState,
    stateProvided,
    stateReady,
    warningThresholdExplicit,
    warningsWithinThreshold,
    decisionReady: realStorySource
      && routeCases.length > 0
      && routeCaseCountReady
      && routeAssertionsReady
      && layoutReady
      && stateReady
      && routeConsumers.length >= 2
      && warningThresholdExplicit
      && warningsWithinThreshold === true
  };
}

function writeAcceptanceSummary(summaryPath, summary) {
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  console.log(`[ok] acceptance summary written: ${formatLocalPath(summaryPath)}`);
}

function writeAcceptanceReport(filePath, summary) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, renderAcceptanceReport(summary), "utf8");
  console.log(`[ok] acceptance report written: ${formatLocalPath(filePath)}`);
}

function renderAcceptanceReport(summary) {
  const lines = [
    "# Narrative Canvas Portable Acceptance Report",
    "",
    `Status: ${summary.status}`,
    `Source mode: ${summary.sourceMode}`,
    `Output directory: ${summary.outputDir || "(temporary, removed)"}`,
    "",
    "## Inputs",
    "",
    renderReportList(summary.inputs),
    "",
    "## Story Source Gate",
    "",
    renderReportList({
      decisionGate: summary.gate.decisionGate ? "yes" : "no",
      realStorySource: summary.gate.realStorySource ? "yes" : "no",
      routeCaseCount: summary.gate.routeCaseCount,
      requiredRouteCaseCount: summary.gate.requiredRouteCaseCount,
      routeCaseCountReady: summary.gate.routeCaseCountReady ? "yes" : "no",
      routeConsumers: summary.gate.routeConsumers,
      routeAssertionsReady: summary.gate.routeAssertionsReady ? "yes" : "no",
      layoutRequired: summary.gate.layoutRequired ? "yes" : "no",
      layoutProvided: summary.gate.layoutProvided ? "yes" : "no",
      layoutReady: summary.gate.layoutReady ? "yes" : "no",
      stateRequired: summary.gate.stateRequired ? "yes" : "no",
      stateProvided: summary.gate.stateProvided ? "yes" : "no",
      stateReady: summary.gate.stateReady ? "yes" : "no",
      warningThresholdExplicit: summary.gate.warningThresholdExplicit ? "yes" : "no",
      warningsWithinThreshold: summary.gate.warningsWithinThreshold === null ? "not checked" : summary.gate.warningsWithinThreshold ? "yes" : "no",
      decisionReady: summary.gate.decisionReady ? "yes" : "no"
    }),
    "",
    "## File Evidence",
    "",
    "### Inputs",
    "",
    renderFileEvidence(summary.fileEvidence.inputs),
    "",
    "### Exported Artifacts",
    "",
    renderFileEvidence(summary.fileEvidence.artifacts),
    "",
    "## Consumers",
    "",
    renderReportList(summary.consumers),
    "",
    "## Warnings",
    "",
    `Total: ${summary.warnings.count}`,
    `Allowed: ${summary.warnings.allowedCount}`,
    `Unreviewed: ${summary.warnings.unreviewedCount}`,
    ""
  ];
  if (summary.warnings.items.length) {
    summary.warnings.items.forEach((warning) => {
      lines.push(`- ${warning.code}: ${warning.message}`);
    });
  } else {
    lines.push("- None");
  }
  lines.push("", "## Route Cases", "");
  if (summary.routeCases.length) {
    summary.routeCases.forEach((routeCase) => {
      lines.push(`### ${routeCase.name}`, "");
      lines.push(`Choices: ${routeCase.options.choiceLabels.join(" -> ") || "(default path)"}`);
      lines.push(`Runtime JSON: ${formatVisited(routeCase.runtimeJson.visited)}`);
      lines.push(`Yarn: ${formatVisited(routeCase.yarn.visited)}`);
      lines.push(`Ink choices: ${formatInkChoices(routeCase.ink.selectedChoices)}`);
      lines.push(`Twee: ${formatVisited(routeCase.twee.visited)}`);
      lines.push(`Final state: ${JSON.stringify(routeCase.runtimeJson.finalState)}`);
      lines.push("");
    });
  } else if (summary.route) {
    lines.push("### default", "");
    lines.push(`Runtime JSON: ${formatVisited(summary.route.runtimeJson.visited)}`);
    lines.push(`Yarn: ${formatVisited(summary.route.yarn.visited)}`);
    lines.push(`Ink choices: ${formatInkChoices(summary.route.ink.selectedChoices)}`);
    lines.push(`Twee: ${formatVisited(summary.route.twee.visited)}`);
    lines.push(`Final state: ${JSON.stringify(summary.route.runtimeJson.finalState)}`);
    lines.push("");
  } else {
    lines.push("- No route cases were recorded.", "");
  }
  lines.push("## Exported Files", "");
  summary.exportedFiles.forEach((file) => lines.push(`- ${file}`));
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderReportList(value) {
  return Object.entries(value)
    .map(([key, item]) => `- ${key}: ${Array.isArray(item) ? item.join(", ") : item}`)
    .join("\n") || "- None";
}

function formatInkChoices(choices) {
  const items = Array.isArray(choices) ? choices : [];
  if (!items.length) return "(none)";
  return items.map((choice) => `${choice.index}:${choice.label || choice.id || "choice"}`).join(" -> ");
}

function renderFileEvidence(items) {
  const entries = Array.isArray(items) ? items : [];
  if (!entries.length) return "- None";
  return entries
    .map((item) => `- ${item.role}: ${item.path} (${item.bytes} bytes, sha256 ${item.sha256})`)
    .join("\n");
}

function validateAcceptanceSummary(summary) {
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "portable-acceptance-summary.schema.json"), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(summary, schema);
  assert(schemaErrors.length === 0, `Acceptance summary matches schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  console.log("[ok] Acceptance summary matches schema");
}

function formatLocalPath(filePath) {
  return path.relative(process.cwd(), filePath) || ".";
}

function exportFixtureWithChrome({ outputDir, scratchDir, fixturePath, storySourcePath, layoutSourcePath, stateSourcePath, sourceMode, timeoutMs }) {
  const runnerPath = path.join(scratchDir, "portable-export-runner.html");
  const projectRootUrl = pathToFileURL(projectRoot + path.sep).href;
  const fixtureUrl = pathToFileURL(fixturePath).href;
  const storyUrl = storySourcePath ? pathToFileURL(storySourcePath).href : "";
  const layoutUrl = layoutSourcePath ? pathToFileURL(layoutSourcePath).href : "";
  const stateUrl = stateSourcePath ? pathToFileURL(stateSourcePath).href : "";
  fs.writeFileSync(runnerPath, buildRunnerHtml({
    projectRootUrl,
    fixtureUrl,
    storyUrl,
    layoutUrl,
    stateUrl,
    sourceMode
  }), "utf8");

  const chromeArgs = [
    "--headless=new",
    "--disable-gpu",
    "--disable-background-networking",
    "--disable-component-update",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--no-sandbox",
    "--allow-file-access-from-files",
    `--user-data-dir=${path.join(scratchDir, "chrome-profile")}`,
    `--virtual-time-budget=${getChromeVirtualTimeBudget(timeoutMs)}`,
    "--dump-dom",
    pathToFileURL(runnerPath).href
  ];
  const run = spawnWithTimeout(chromePath, chromeArgs, { timeoutMs });
  if (!run.stdout) {
    throw new Error(`Chrome produced no DOM output.${run.stderr ? `\n${run.stderr}` : ""}`);
  }
  const match = run.stdout.match(/<pre id="export-output">([\s\S]*?)<\/pre>/);
  if (!match) {
    fs.writeFileSync(path.join(scratchDir, "portable-export-runner-dom.html"), run.stdout, "utf8");
    throw new Error(`Export runner did not produce an output block.${run.stderr ? `\n${run.stderr}` : ""}`);
  }
  const outputText = decodeHtml(match[1]);
  let result;
  try {
    result = JSON.parse(outputText);
  } catch (error) {
    fs.writeFileSync(path.join(scratchDir, "portable-export-runner-dom.html"), run.stdout, "utf8");
    throw new Error(`Export runner output was not JSON (${JSON.stringify(outputText.slice(0, 80))}). The page may not have finished before Chrome returned DOM output.`);
  }
  if (result.status !== "pass") throw new Error(result.error || "Export runner failed.");
  console.log(`[ok] exported ${result.exported.length} files from ${sourceMode === "story" ? "story source" : "fixture"}`);
  return result.exported;
}

function getChromeVirtualTimeBudget(timeoutMs) {
  const normalized = Number(timeoutMs || 0);
  if (!Number.isFinite(normalized) || normalized <= 0) return 25000;
  return Math.max(25000, Math.min(Math.floor(normalized), 120000));
}

function spawnWithTimeout(command, commandArgs, { timeoutMs }) {
  const result = childProcess.spawnSync(command, commandArgs, {
    cwd: projectRoot,
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
    timeout: timeoutMs,
    killSignal: "SIGTERM"
  });
  if (result.error && result.error.code !== "ETIMEDOUT") throw result.error;
  if (result.error?.code === "ETIMEDOUT" && !result.stdout) {
    throw new Error(`Process timed out after ${timeoutMs}ms: ${command}`);
  }
  return { stdout: result.stdout || "", stderr: result.stderr || "", timedOut: result.error?.code === "ETIMEDOUT" };
}

function writeExportedFiles(outputDir, exported) {
  const names = new Set();
  for (const item of exported) {
    if (!item.filename || names.has(item.filename)) continue;
    names.add(item.filename);
    fs.writeFileSync(path.join(outputDir, item.filename), Buffer.from(item.base64, "base64"));
  }
}

function buildRunnerHtml({ projectRootUrl, fixtureUrl, storyUrl, layoutUrl, stateUrl, sourceMode }) {
  return `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>Narrative Canvas Portable Export Runner</title></head>
  <body data-export-status="running"><pre id="export-output">running</pre>
    <script>
      const projectRootUrl = ${JSON.stringify(projectRootUrl)};
      const fixtureUrl = ${JSON.stringify(fixtureUrl)};
      const storyUrl = ${JSON.stringify(storyUrl)};
      const layoutUrl = ${JSON.stringify(layoutUrl)};
      const stateUrl = ${JSON.stringify(stateUrl)};
      const sourceMode = ${JSON.stringify(sourceMode)};
      const actions = ["export-story-md", "export-story-layout", "export-state-schema", "export-profile", "export-runtime-json", "export-yarn", "export-ink", "export-twee"];
      const output = document.querySelector("#export-output");
      function assetUrl(path) { return new URL(path, projectRootUrl).href; }
      function extractBodyHtml(html) {
        const match = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
        return match ? match[1].replace(/<script[\\s\\S]*?<\\/script>/gi, "") : html;
      }
      function scopeCss(css) {
        return css
          .replace(/:root/g, ".narrative-canvas-plugin-host")
          .replace(/(^|})\\s*html\\s*,\\s*body\\s*{/g, "$1\\n.narrative-canvas-plugin-host {")
          .replace(/(^|})\\s*body\\s*{/g, "$1\\n.narrative-canvas-plugin-host {");
      }
      async function waitFor(name, predicate, timeout = 8000) {
        const started = performance.now();
        while (performance.now() - started < timeout) {
          if (predicate()) return true;
          await new Promise((resolve) => setTimeout(resolve, 40));
        }
        throw new Error(name + " timed out");
      }
      function clickElement(element) {
        if (!element) throw new Error("missing click target");
        element.dispatchEvent(new element.ownerDocument.defaultView.MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: element.ownerDocument.defaultView
        }));
      }
      async function blobToBase64(blob) {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary);
      }
      async function run() {
        try {
          const [html, css, appJs, fixtureText, storyText, layoutText, stateText] = await Promise.all([
            fetch(assetUrl("index.html")).then((response) => response.text()),
            fetch(assetUrl("canvas.css")).then((response) => response.text()),
            fetch(assetUrl("app.js")).then((response) => response.text()),
            fetch(fixtureUrl).then((response) => response.text()),
            storyUrl ? fetch(storyUrl).then((response) => response.text()) : Promise.resolve(""),
            layoutUrl ? fetch(layoutUrl).then((response) => response.text()) : Promise.resolve(""),
            stateUrl ? fetch(stateUrl).then((response) => response.text()) : Promise.resolve("")
          ]);
          const frame = document.createElement("iframe");
          document.body.append(frame);
          const win = frame.contentWindow;
          const doc = win.document;
          doc.open();
          doc.write("<!doctype html><html><head><meta charset='utf-8'></head><body></body></html>");
          doc.close();
          const style = doc.createElement("style");
          style.textContent = scopeCss(css);
          doc.head.append(style);
          const host = doc.createElement("div");
          host.className = "narrative-canvas-plugin-host";
          host.innerHTML = extractBodyHtml(html);
          doc.body.append(host);

          const downloads = [];
          const originalCreateObjectURL = win.URL.createObjectURL.bind(win.URL);
          const originalClick = win.HTMLAnchorElement.prototype.click;
          win.URL.createObjectURL = (blob) => {
            const url = originalCreateObjectURL(blob);
            downloads.push({ blob, url, filename: "" });
            return url;
          };
          win.HTMLAnchorElement.prototype.click = function click() {
            const item = downloads.find((entry) => entry.url === this.href) || downloads[downloads.length - 1];
            if (item) item.filename = this.download || "";
          };

          let savedText = "";
          win.NarrativeCanvasHost = {
            pluginId: "portable-export-runner",
            root: host,
            loadProject: async () => savedText || fixtureText,
            saveProject: async (text) => { savedText = text; return "tests/fixtures/state-runtime-key-play.ncanvas"; },
            ensureProjectFile: async () => "",
            createProjectFile: async (text) => { savedText = text; return "tests/fixtures/state-runtime-key-play.ncanvas"; },
            previewNewProjectFile: async () => "tests/fixtures/state-runtime-key-play.ncanvas",
            chooseProjectFile: async () => "tests/fixtures/state-runtime-key-play.ncanvas",
            getProjectFile: () => "tests/fixtures/state-runtime-key-play.ncanvas"
          };

          const script = doc.createElement("script");
          script.textContent = appJs;
          doc.body.append(script);
          await win.NarrativeCanvasApp.init();
          await waitFor("app ready", () => Boolean(doc.querySelector(".app-shell[data-theme]")));
          if (sourceMode === "story") {
            win.NarrativeCanvasApp.importStoryMarkdownText(storyText);
            if (layoutText) win.NarrativeCanvasApp.importStoryLayoutText(layoutText);
            if (stateText) win.NarrativeCanvasApp.importStateSchemaText(stateText);
            await win.NarrativeCanvasApp.save();
          } else {
            await win.NarrativeCanvasApp.save();
            await win.NarrativeCanvasApp.loadVaultProject();
            await win.NarrativeCanvasApp.save();
          }

          for (const action of actions) {
            const before = downloads.length;
            clickElement(doc.querySelector('[data-action="' + action + '"]'));
            await waitFor(action + " download", () => downloads.length > before && downloads[downloads.length - 1].filename);
            const dialog = doc.querySelector("#exportReportDialog");
            if (dialog && dialog.open) dialog.close();
          }

          const exported = [];
          for (const item of downloads.filter((entry) => /\\.(md|json|yarn|ink|twee)$/.test(entry.filename))) {
            exported.push({ filename: item.filename, base64: await blobToBase64(item.blob) });
          }
          output.textContent = JSON.stringify({ status: "pass", exported }, null, 2);
          document.body.setAttribute("data-export-status", "pass");
          win.URL.createObjectURL = originalCreateObjectURL;
          win.HTMLAnchorElement.prototype.click = originalClick;
        } catch (error) {
          output.textContent = JSON.stringify({ status: "fail", error: error && (error.stack || error.message || String(error)) }, null, 2);
          document.body.setAttribute("data-export-status", "fail");
        }
      }
      window.addEventListener("load", run, { once: true });
    </script>
  </body>
</html>`;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function validateJsonSchemaSubset(value, schema, location = "$", root = schema) {
  if (schema === true || !schema) return [];
  if (schema.$ref) {
    const target = resolveLocalSchemaRef(schema.$ref, root);
    return target ? validateJsonSchemaSubset(value, target, location, root) : [`${location}: unresolved schema ref ${schema.$ref}`];
  }
  const errors = [];
  if (Object.prototype.hasOwnProperty.call(schema, "const") && value !== schema.const) {
    errors.push(`${location}: expected const ${JSON.stringify(schema.const)}`);
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    errors.push(`${location}: expected one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
  }
  if (schema.type && !schemaTypeMatches(value, schema.type)) {
    errors.push(`${location}: expected type ${Array.isArray(schema.type) ? schema.type.join("|") : schema.type}`);
    return errors;
  }
  if (schema.format === "date-time" && typeof value === "string" && Number.isNaN(Date.parse(value))) {
    errors.push(`${location}: expected date-time string`);
  }
  if (schema.required && isPlainObject(value)) {
    schema.required.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(`${location}: missing ${key}`);
    });
  }
  if (schema.properties && isPlainObject(value)) {
    Object.entries(schema.properties).forEach(([key, childSchema]) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        errors.push(...validateJsonSchemaSubset(value[key], childSchema, `${location}.${key}`, root));
      }
    });
  }
  if (schema.additionalProperties === false && isPlainObject(value)) {
    const allowed = new Set(Object.keys(schema.properties || {}));
    Object.keys(value).forEach((key) => {
      if (!allowed.has(key)) errors.push(`${location}: unexpected ${key}`);
    });
  } else if (schema.additionalProperties && schema.additionalProperties !== true && isPlainObject(value)) {
    const allowed = new Set(Object.keys(schema.properties || {}));
    Object.entries(value).forEach(([key, childValue]) => {
      if (!allowed.has(key)) {
        errors.push(...validateJsonSchemaSubset(childValue, schema.additionalProperties, `${location}.${key}`, root));
      }
    });
  }
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...validateJsonSchemaSubset(item, schema.items, `${location}[${index}]`, root));
    });
  }
  return errors;
}

function resolveLocalSchemaRef(ref, root) {
  if (!ref.startsWith("#/")) return null;
  return ref.slice(2).split("/").reduce((current, segment) => {
    const key = segment.replace(/~1/g, "/").replace(/~0/g, "~");
    return current && Object.prototype.hasOwnProperty.call(current, key) ? current[key] : null;
  }, root);
}

function schemaTypeMatches(value, expected) {
  const types = Array.isArray(expected) ? expected : [expected];
  return types.some((type) => {
    if (type === "null") return value === null;
    if (type === "array") return Array.isArray(value);
    if (type === "object") return isPlainObject(value);
    if (type === "integer") return Number.isInteger(value);
    return typeof value === type;
  });
}

function isPlainObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validateStorySourceExport(outputDir, scratchDir) {
  const profilePath = findExportFile(outputDir, "-export.profile.json");
  const profile = validateExportProfileGeneric(profilePath);
  const warnings = validateExportWarningLimit(profile);
  const storyPath = getProfileFilePath(outputDir, profile, "story-md");
  const layoutPath = getProfileFilePath(outputDir, profile, "layout-json");
  const stateSchemaPath = getProfileFilePath(outputDir, profile, "state-schema");
  const runtimePath = getProfileFilePath(outputDir, profile, "runtime-json");
  const yarnPath = getProfileFilePath(outputDir, profile, "yarn");
  const inkPath = getProfileFilePath(outputDir, profile, "ink");
  const tweePath = getProfileFilePath(outputDir, profile, "twee");

  validateStoryMarkdownGeneric(storyPath);
  const layoutDocument = validateDocumentSchema(layoutPath, "docs/story-layout.schema.json", "Story layout");
  validateStoryLayoutSourceApplied(layoutDocument);
  validateDocumentSchema(stateSchemaPath, "docs/state-schema.schema.json", "State schema");
  if (routeTemplatePath) writeRouteCaseTemplate(routeTemplatePath, runtimePath);
  validateYarn(yarnPath, scratchDir);
  const routeCases = storyRouteCases.map((routeCase) => validateStoryRouteCase(routeCase, runtimePath, yarnPath, inkPath, tweePath));
  validateInk(inkPath, scratchDir);
  validateTwee(tweePath, scratchDir);
  console.log(`[ok] Story source acceptance exported and ran ${routeCases.length} Runtime JSON + Yarn + ink + Twee route case(s)`);
  return {
    warnings,
    route: routeCases[0] ? { runtimeJson: routeCases[0].runtimeJson, yarn: routeCases[0].yarn, ink: routeCases[0].ink, twee: routeCases[0].twee } : null,
    routeCases
  };
}

function validateStoryLayoutSourceApplied(exportedDocument) {
  if (!layoutSourcePath) return;
  const sourceDocument = validateDocumentSchema(layoutSourcePath, "docs/story-layout.schema.json", "Input story layout");
  const exportedNodes = new Map((exportedDocument.nodes || []).map((node) => [String(node.id || ""), node]));
  (sourceDocument.nodes || []).forEach((sourceNode) => {
    if (!sourceNode?.id) return;
    const exportedNode = exportedNodes.get(String(sourceNode.id));
    assert(exportedNode, `Story layout export is missing source node ${sourceNode.id}`);
    assertNumberFieldMatches(exportedNode, sourceNode, "x", `node ${sourceNode.id}`);
    assertNumberFieldMatches(exportedNode, sourceNode, "y", `node ${sourceNode.id}`);
    ["width", "height"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(sourceNode, field)) {
        assertNumberFieldMatches(exportedNode, sourceNode, field, `node ${sourceNode.id}`);
      }
    });
    ["frameId", "collapsed"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(sourceNode, field)) {
        assert(JSON.stringify(exportedNode[field]) === JSON.stringify(sourceNode[field]), `Story layout ${field} did not round-trip for node ${sourceNode.id}`);
      }
    });
    if (Object.prototype.hasOwnProperty.call(sourceNode, "portPositions")) {
      assert(JSON.stringify(exportedNode.portPositions) === JSON.stringify(sourceNode.portPositions), `Story layout portPositions did not round-trip for node ${sourceNode.id}`);
    }
  });

  (sourceDocument.links || []).forEach((sourceLink) => {
    const exportedLink = findExportedLayoutLink(sourceLink, exportedDocument.links || []);
    assert(exportedLink, `Story layout export is missing source link ${sourceLink.id || `${sourceLink.from}->${sourceLink.to}`}`);
    ["label", "choiceIndex", "choiceOptionId", "requirements"].forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(sourceLink, field)) {
        assert(JSON.stringify(exportedLink[field]) === JSON.stringify(sourceLink[field]), `Story layout ${field} did not round-trip for link ${sourceLink.id || `${sourceLink.from}->${sourceLink.to}`}`);
      }
    });
  });

  if (sourceDocument.view) {
    assertNumberFieldMatches(exportedDocument.view || {}, sourceDocument.view, "scale", "view");
  }
  console.log("[ok] Story layout sidecar was applied and re-exported");
}

function findExportedLayoutLink(sourceLink, exportedLinks) {
  if (!sourceLink) return null;
  const sourceId = String(sourceLink.id || "");
  if (sourceId) {
    const byId = exportedLinks.find((link) => link.id === sourceId && link.from === sourceLink.from && link.to === sourceLink.to);
    if (byId) return byId;
  }
  return exportedLinks.find((link) => {
    if (link.from !== sourceLink.from || link.to !== sourceLink.to) return false;
    if (sourceLink.choiceOptionId && link.choiceOptionId) return sourceLink.choiceOptionId === link.choiceOptionId;
    if (sourceLink.choiceIndex != null && link.choiceIndex != null) return Number(sourceLink.choiceIndex) === Number(link.choiceIndex);
    return String(sourceLink.label || "") === String(link.label || "");
  }) || null;
}

function assertNumberFieldMatches(actualObject, expectedObject, field, label) {
  const actual = Number(actualObject[field]);
  const expected = Number(expectedObject[field]);
  assert(Number.isFinite(actual), `Story layout ${label}.${field} is not finite`);
  assert(Number.isFinite(expected), `Input story layout ${label}.${field} is not finite`);
  assert(Math.abs(actual - expected) < 0.0001, `Story layout ${label}.${field} expected ${expected}, got ${actual}`);
}

function validateStoryRouteCase(routeCase, runtimePath, yarnPath, inkPath, tweePath) {
  const runtimeResult = validateRuntimeJsonGeneric(runtimePath, routeCase);
  const yarnResult = validateYarnGenericPlaythrough(yarnPath, routeCase);
  const inkResult = validateInkGenericPlaythrough(inkPath, routeCase, runtimeResult);
  const tweeResult = validateTweeGenericPlaythrough(tweePath, routeCase);
  return {
    name: routeCase.name,
    options: summarizeRouteOptions(routeCase),
    runtimeJson: summarizeRouteResult(runtimeResult),
    yarn: summarizeRouteResult(yarnResult),
    ink: summarizeInkRouteResult(inkResult),
    twee: summarizeRouteResult(tweeResult)
  };
}

function summarizeRouteOptions(routeCase) {
  return {
    choiceLabels: [...routeCase.choiceLabels],
    minVisits: routeCase.minVisits,
    expectNode: [...routeCase.expectNode],
    expectText: [...routeCase.expectText],
    expectState: routeCase.expectState.map((item) => ({ key: item.key, value: item.value }))
  };
}

function findExportFile(outputDir, suffix) {
  const matches = fs.readdirSync(outputDir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => path.join(outputDir, name));
  if (matches.length !== 1) throw new Error(`Expected one *${suffix} export, found ${matches.length}.`);
  return matches[0];
}

function getProfileFilePath(outputDir, profile, fileId) {
  const entry = (profile.files || []).find((file) => file.id === fileId);
  if (!entry?.name) throw new Error(`Export profile is missing file id: ${fileId}`);
  const filePath = path.join(outputDir, entry.name);
  assertFileExists(filePath, fileId);
  return filePath;
}

function validateDocumentSchema(documentPath, schemaRelativePath, label) {
  const document = JSON.parse(fs.readFileSync(documentPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, schemaRelativePath), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(document, schema);
  assert(schemaErrors.length === 0, `${label} matches schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  console.log(`[ok] ${label} matches schema`);
  return document;
}

function validateStoryMarkdownGeneric(storyPath) {
  const text = fs.readFileSync(storyPath, "utf8");
  assert(text.includes("<!-- narrative-canvas-story-md: v1 -->"), "Story Markdown includes format marker");
  assert(/^##\s+.+$/m.test(text), "Story Markdown includes at least one node");
  console.log("[ok] Story Markdown export is readable");
}

function validateExportProfileGeneric(profilePath) {
  const document = validateDocumentSchema(profilePath, "docs/export-profile.schema.json", "Export profile");
  ["story-md", "layout-json", "state-schema", "export-profile", "runtime-json", "yarn", "ink", "twee"].forEach((fileId) => {
    assert(document.files.some((file) => file.id === fileId), `Export profile lists ${fileId}`);
  });
  ["runtime-json", "yarn", "ink", "twee"].forEach((targetId) => {
    assert(document.targets.some((target) => target.id === targetId), `Export profile lists ${targetId} target`);
  });
  console.log("[ok] Export profile sidecar lists portable files and targets");
  return document;
}

function validateExportWarningLimit(profile) {
  const warnings = summarizeExportWarnings(profile?.warnings);
  const unreviewedWarnings = getUnreviewedWarnings(warnings);
  if (maxExportWarnings !== null) {
    assert(unreviewedWarnings.length <= maxExportWarnings, `Export Profile unreviewed warning count ${unreviewedWarnings.length} exceeds --max-warnings ${maxExportWarnings}`);
    console.log(`[ok] Export Profile warnings within limit (${unreviewedWarnings.length}/${maxExportWarnings} unreviewed, ${warnings.length} total)`);
  }
  return warnings;
}

function summarizeExportWarnings(warnings) {
  return (Array.isArray(warnings) ? warnings : []).map((warning) => ({ ...warning }));
}

function getUnreviewedWarnings(warnings) {
  return warnings.filter((warning) => !isAllowedWarning(warning));
}

function isAllowedWarning(warning) {
  return allowedWarningCodes.includes(String(warning?.code || ""));
}

function validateRuntimeJsonGeneric(runtimePath, options = {}) {
  const document = validateDocumentSchema(runtimePath, "docs/runtime-json.schema.json", "Runtime JSON");
  const routeLabel = options.name ? ` (${options.name})` : "";
  assert(document.format === "narrative-canvas-runtime", "Runtime JSON has format marker");
  assert(Array.isArray(document.nodes) && document.nodes.length > 0, "Runtime JSON has at least one node");
  assert(document.startNodeId || document.nodes[0]?.id, "Runtime JSON has a start node");
  const walk = walkRuntimeJsonDefaultPath(document, options);
  assert(walk.visited.length > 0, "Runtime JSON default path visits at least one node");
  if (document.nodes.length > 1) assert(walk.visited.length > 1, "Runtime JSON default path reaches beyond the first node");
  validateRouteExpectations(`Runtime JSON${routeLabel}`, walk, options);
  console.log(`[ok] Runtime JSON${routeLabel} visited ${walk.visited.length} node(s)`);
  return walk;
}

function walkRuntimeJsonDefaultPath(document, options = {}) {
  const session = createRuntimeSession(document);
  const visited = [];
  const seen = new Set();
  const output = [];
  const choiceLabels = normalizeChoiceLabels(options);
  const selectedChoices = [];
  let finalState = {};
  for (let index = 0; index < 50; index += 1) {
    const page = session.current();
    visited.push({ id: page.node.id, slug: page.node.slug, title: page.node.title });
    seen.add(page.node.id);
    finalState = page.state || {};
    output.push(page.body);
    Object.values(page.customFields || {}).forEach((value) => output.push(String(value || "")));
    const choiceEntry = pickRuntimeChoiceEntry(page.choices, choiceLabels);
    if (choiceEntry) {
      selectedChoices.push({
        index: choiceEntry.index + 1,
        id: choiceEntry.choice.id,
        label: choiceEntry.choice.label
      });
      if (!session.choose(choiceEntry.choice.id)) break;
    } else if (!session.advance()) {
      break;
    }
    const next = session.currentNodeId();
    if (!next || seen.has(next)) break;
  }
  return { visited, output: output.filter(Boolean).join("\n"), state: finalState, selectedChoices };
}

function normalizeChoiceLabels(options = {}) {
  if (Array.isArray(options.choiceLabels)) return [...options.choiceLabels];
  return options.choiceLabel ? [String(options.choiceLabel)] : [];
}

function nextChoiceLabel(choiceLabels) {
  return Array.isArray(choiceLabels) && choiceLabels.length ? choiceLabels.shift() : "";
}

function pickRuntimeChoiceEntry(choices, choiceLabels) {
  const available = Array.isArray(choices) ? choices : [];
  if (!available.length) return null;
  const label = String(nextChoiceLabel(choiceLabels) || "").trim();
  if (!label) return { choice: available[0], index: 0 };
  const index = available.findIndex((choice) => choice.id === label || choice.label === label);
  const matched = index >= 0 ? available[index] : null;
  if (!matched) throw new Error(`Runtime JSON choice not found: ${label}`);
  return { choice: matched, index };
}

function validateRouteExpectations(label, result, options = {}) {
  const minVisits = Number(options.minVisits || 0);
  if (minVisits > 0) {
    assert(result.visited.length >= minVisits, `${label} visited ${result.visited.length} node(s), expected at least ${minVisits}`);
  }
  (options.expectNode || []).forEach((expected) => {
    assert(result.visited.some((item) => visitMatches(item, expected)), `${label} did not visit expected node ${expected}; visited ${formatVisited(result.visited)}`);
  });
  (options.expectText || []).forEach((expected) => {
    assert(String(result.output || "").includes(expected), `${label} output did not include expected text: ${expected}`);
  });
  (options.expectState || []).forEach((expected) => {
    assert(Object.prototype.hasOwnProperty.call(result.state || {}, expected.key), `${label} state is missing ${expected.key}`);
    const actual = (result.state || {})[expected.key];
    assert(valuesMatch(actual, expected.value), `${label} state ${expected.key} expected ${JSON.stringify(expected.value)}, got ${JSON.stringify(actual)}`);
  });
}

function summarizeRouteResult(result) {
  return {
    visitedCount: result.visited.length,
    visited: result.visited,
    finalState: result.state || {}
  };
}

function summarizeInkRouteResult(result) {
  return {
    selectedChoices: result.selectedChoices.map((choice) => ({ ...choice })),
    outputText: abbreviateText(result.output, 4000)
  };
}

function abbreviateText(value, limit) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  return text.length > limit ? `${text.slice(0, limit)}\n...[truncated]` : text;
}

function visitMatches(item, expected) {
  const text = String(expected || "");
  if (!text) return false;
  if (typeof item === "string") return item === text;
  return [item.id, item.slug, item.title].some((value) => value === text);
}

function formatVisited(visited) {
  return visited.map((item) => {
    if (typeof item === "string") return item;
    return item.slug || item.title || item.id || "?";
  }).join(", ");
}

function valuesMatch(actual, expected) {
  if (actual === expected) return true;
  if (typeof actual === "number" || typeof expected === "number") return Number(actual) === Number(expected);
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function validateStoryMarkdown(storyPath) {
  const text = fs.readFileSync(storyPath, "utf8");
  assert(text.includes("# State Runtime Key Play"), "Story Markdown includes title");
  assert(text.includes("<!-- narrative-canvas-story-md: v1 -->"), "Story Markdown includes format marker");
  assert(text.includes("## Start"), "Story Markdown includes Start node");
  assert(text.includes("Nested coins: {nested_inventory_coins}."), "Story Markdown includes nested path template");
  assert(
    text.includes("requires:")
      && (text.includes("flag_tokens.includes(\"boarding\")") || text.includes("has(flag_tokens, \"boarding\")")),
    "Story Markdown includes choice condition"
  );
  assert(text.includes("effect: onChoose subtract inventory_coins 2"), "Story Markdown includes choice effect");
  assert(text.includes("goto: Bribe_accepted"), "Story Markdown includes choice target");
  console.log("[ok] Story Markdown export contains readable route");
}

function validateStoryLayout(layoutPath) {
  const document = JSON.parse(fs.readFileSync(layoutPath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "story-layout.schema.json"), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(document, schema);
  assert(schemaErrors.length === 0, `Story layout matches schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  assert(document.format === "narrative-canvas-story-layout", "Story layout has format marker");
  assert(document.version === 1, "Story layout has version 1");
  assert(document.nodes.some((node) => node.id === "n1" && node.title === "Bribe check" && Number.isFinite(node.x)), "Story layout keeps node coordinates by id");
  assert(document.links.some((link) => link.choiceOptionId === "opt_bribe" && link.from === "n1" && link.to === "n2"), "Story layout keeps choice link identity");
  console.log("[ok] Story layout sidecar matches schema and keeps node/link identity");
}

function validateStateSchema(schemaPath) {
  const document = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const variables = Array.isArray(document.variables) ? document.variables : [];
  const coin = variables.find((variable) => variable.key === "inventory_coins");
  const nestedCoin = variables.find((variable) => variable.key === "nested_inventory.coins");
  assert(document.format === "narrative-canvas-state-schema", "State schema has format marker");
  assert(document.version === 1, "State schema has version 1");
  assert(document.summary?.variableCount === variables.length, "State schema summary counts variables");
  assert(coin?.type === "number" && coin.initialValue === 3, "State schema keeps scalar initial value");
  assert(coin.readBy.length > 0 && coin.writtenBy.length > 0 && coin.interpolatedBy.length > 0, "State schema keeps read/write/template refs");
  assert(nestedCoin?.type === "number" && nestedCoin.initialValue === 3, "State schema keeps nested path fallback initial value");
  assert(nestedCoin.exportKey === "nested_inventory_coins", "State schema keeps portable export key for nested paths");
  assert(nestedCoin.statuses.includes("export-blocked"), "State schema keeps nested path export warning status");
  assert(document.exportBlocks.some((block) => block.code === "state-key-name-sanitized" && block.key === "nested_inventory.coins"), "State schema keeps nested path export block");
  console.log("[ok] State schema sidecar keeps state refs and warnings");
}

function validateExportProfile(profilePath) {
  const document = JSON.parse(fs.readFileSync(profilePath, "utf8"));
  const schema = JSON.parse(fs.readFileSync(path.join(projectRoot, "docs", "export-profile.schema.json"), "utf8"));
  const schemaErrors = validateJsonSchemaSubset(document, schema);
  assert(schemaErrors.length === 0, `Export profile matches schema: ${schemaErrors.slice(0, 5).join("; ")}`);
  assert(document.format === "narrative-canvas-export-profile", "Export profile has format marker");
  assert(document.version === 1, "Export profile has version 1");
  assert(document.files.some((file) => file.id === "story-md" && file.name === "state-runtime-key-play-story.md"), "Export profile lists Story Markdown file");
  assert(document.files.some((file) => file.id === "runtime-json" && file.schema === "docs/runtime-json.schema.json"), "Export profile lists Runtime JSON schema");
  assert(document.targets.some((target) => target.id === "ink" && target.fileId === "ink"), "Export profile lists ink target");
  assert(document.mappings?.variables?.["nested_inventory.coins"] === "nested_inventory_coins", "Export profile keeps nested variable export key");
  assert(document.mappings?.nodes?.n1 === "Bribe_check", "Export profile keeps node slug mapping");
  assert(document.warnings.some((warning) => warning.code === "state-key-name-sanitized"), "Export profile keeps export warnings");
  console.log("[ok] Export profile sidecar matches schema and keeps mappings");
  return document;
}

function validateRuntimeJson(runtimePath) {
  const document = JSON.parse(fs.readFileSync(runtimePath, "utf8"));
  const session = createRuntimeSession(document);
  const start = session.current();
  assert(start.body.includes("Coins before: 3."), "Runtime JSON loader renders start body");
  assert(start.body.includes("Nested coins: 3."), "Runtime JSON loader renders nested path template");
  assert(session.advance(), "Runtime JSON loader advances by link");
  const choiceNode = session.current();
  assert(choiceNode.body.includes("Coins before choice: 3."), "Runtime JSON loader renders choice body");
  assert(choiceNode.customFields.readout === "Custom field coins: 3", "Runtime JSON loader renders custom field");
  assert(choiceNode.choices.some((choice) => choice.id === "opt_bribe"), "Runtime JSON loader exposes bribe choice");
  assert(!choiceNode.choices.some((choice) => choice.id === "opt_keep"), "Runtime JSON loader applies playbook choice lock");
  assert(session.choose("opt_bribe"), "Runtime JSON loader chooses bribe branch");
  const result = session.current();
  assert(result.body.includes("Coins after: 1."), "Runtime JSON loader applies coin effect");
  assert(result.body.includes("Suspicion after: 0."), "Runtime JSON loader applies suspicion effect");
  assert(result.customFields.readout === "Custom field after: 1", "Runtime JSON loader renders updated custom field");
  assert(result.state.inventory_coins === 1, "Runtime JSON loader state keeps inventory_coins = 1");
  assert(result.state.guard_suspicion === 0, "Runtime JSON loader state keeps guard_suspicion = 0");
  console.log("[ok] Runtime JSON custom loader walked bribe branch");
}

function createRuntimeSession(document) {
  if (document?.format !== "narrative-canvas-runtime") throw new Error("Unsupported runtime document.");
  if (document.version !== 1) throw new Error(`Unsupported runtime version: ${document.version}`);
  const state = deepClone(document.variables || {});
  const nodeById = new Map((document.nodes || []).map((node) => [node.id, node]));
  let currentNodeId = document.startNodeId || document.nodes?.[0]?.id || "";

  function current() {
    const node = nodeById.get(currentNodeId);
    if (!node) throw new Error(`Missing current node: ${currentNodeId}`);
    applyEffects(node.effects, state);
    return {
      node,
      state: deepClone(state),
      body: renderRuntimeText(node.body, state),
      customFields: renderRuntimeFields(node.customFields, state),
      choices: (node.choices || []).filter((choice) => !choice.condition || evaluateCondition(choice.condition, state))
    };
  }

  function advance() {
    const node = nodeById.get(currentNodeId);
    const transitions = node?.next || [];
    const transition = transitions.find((item) => !item.condition || evaluateCondition(item.condition, state));
    if (!transition?.targetId) return false;
    currentNodeId = transition.targetId;
    return true;
  }

  function choose(choiceId) {
    const node = nodeById.get(currentNodeId);
    const choice = (node?.choices || []).find((item) => item.id === choiceId);
    if (!choice) return false;
    if (choice.condition && !evaluateCondition(choice.condition, state)) return false;
    applyEffects(choice.effects, state);
    if (choice.targetId) currentNodeId = choice.targetId;
    return true;
  }

  function currentNodeIdValue() {
    return currentNodeId;
  }

  return { current, advance, choose, currentNodeId: currentNodeIdValue };
}

function renderRuntimeFields(fields, state) {
  const rendered = {};
  for (const [key, value] of Object.entries(fields || {})) {
    rendered[key] = renderRuntimeText(value, state);
  }
  return rendered;
}

function renderRuntimeText(text, state) {
  return String(text || "").replace(/\{([a-zA-Z_]\w*)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(state, key) ? String(state[key]) : match;
  });
}

function applyEffects(effects, state) {
  for (const effect of effects || []) {
    if (!effect.key) continue;
    if (effect.op === "set") state[effect.key] = effect.value;
    else if (effect.op === "add") state[effect.key] = Number(state[effect.key] || 0) + Number(effect.value || 0);
    else if (effect.op === "subtract") state[effect.key] = Number(state[effect.key] || 0) - Number(effect.value || 0);
    else if (effect.op === "toggle") state[effect.key] = !state[effect.key];
  }
}

function evaluateCondition(source, state) {
  const text = String(source || "").trim();
  if (!text) return true;
  if (/^true$/i.test(text)) return true;
  if (/^(false|null)$/i.test(text)) return false;
  const orParts = splitCondition(text, "||");
  if (orParts.length > 1) return orParts.some((part) => evaluateCondition(part, state));
  const andParts = splitCondition(text, "&&");
  if (andParts.length > 1) return andParts.every((part) => evaluateCondition(part, state));
  const grouped = unwrapConditionGroup(text);
  if (grouped != null) return evaluateCondition(grouped, state);
  const notWrapped = text.match(/^!\((.*)\)$/);
  if (notWrapped) return !evaluateCondition(notWrapped[1], state);
  if (text.startsWith("!") && text[1] !== "=") return !evaluateCondition(text.slice(1), state);
  const notPrefix = text.match(/^not\s+(.+)$/i);
  if (notPrefix) return !evaluateCondition(notPrefix[1], state);
  const predicate = parseExpressionPredicate(text);
  if (predicate && !predicate.invalid) return evaluateExpressionPredicate(predicate, state);
  const comparison = text.match(/^([a-zA-Z_]\w*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (comparison) {
    const left = state[comparison[1]];
    const right = parseLiteral(comparison[3]);
    if (comparison[2] === "==") return left === right;
    if (comparison[2] === "!=") return left !== right;
    if (comparison[2] === ">=") return Number(left) >= Number(right);
    if (comparison[2] === "<=") return Number(left) <= Number(right);
    if (comparison[2] === ">") return Number(left) > Number(right);
    if (comparison[2] === "<") return Number(left) < Number(right);
  }
  if (/^[a-zA-Z_]\w*$/.test(text)) return Boolean(state[text]);
  throw new Error(`Unsupported condition in acceptance loader: ${text}`);
}

function splitCondition(text, operator) {
  const source = String(text || "");
  const parts = [];
  let quote = "";
  let escaped = false;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && source.startsWith(operator, index)) {
      parts.push(source.slice(start, index).trim());
      index += operator.length - 1;
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts.filter(Boolean);
}

function unwrapConditionGroup(source) {
  const text = String(source || "").trim();
  if (!text.startsWith("(") || !text.endsWith(")")) return null;
  let quote = "";
  let escaped = false;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (depth === 0 && index < text.length - 1) return null;
  }
  return depth === 0 ? text.slice(1, -1).trim() : null;
}

function parseExpressionPredicate(source) {
  const text = String(source || "").trim();
  const includesMatch = text.match(/^([a-zA-Z_]\w*)\.includes\s*\(([\s\S]*)\)$/i);
  if (includesMatch) {
    const key = normalizeExpressionVariableTerm(includesMatch[1]);
    return key
      ? { name: "includes", key, value: includesMatch[2].trim(), invalid: false }
      : { invalid: true };
  }
  const match = text.match(/^(has|contains)\s*\(([\s\S]*)\)$/i);
  if (!match) return null;
  const args = splitExpressionArguments(match[2]);
  const key = normalizeExpressionVariableTerm(args[0]);
  return args.length === 2 && key
    ? { name: match[1].toLowerCase(), key, value: args[1].trim(), invalid: false }
    : { invalid: true };
}

function splitExpressionArguments(source) {
  const text = String(source || "");
  const args = [];
  let quote = "";
  let escaped = false;
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth === 0 && char === ",") {
      args.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  args.push(text.slice(start).trim());
  return args.filter(Boolean);
}

function normalizeExpressionVariableTerm(source) {
  const text = String(source || "").trim().replace(/^\$/, "");
  const match = text.match(/^([a-zA-Z_]\w*)$/);
  return match ? match[1] : "";
}

function evaluateExpressionPredicate(predicate, state) {
  const container = normalizeMembershipContainer(state[predicate.key]);
  const value = resolvePredicateValue(predicate.value, state);
  if (Array.isArray(container)) return container.some((item) => expressionValuesMatch(item, value));
  if (typeof container === "string") return String(value) !== "" && container.includes(String(value));
  if (container && typeof container === "object") return Object.prototype.hasOwnProperty.call(container, String(value));
  return expressionValuesMatch(container, value);
}

function normalizeMembershipContainer(value) {
  if (typeof value !== "string") return value;
  const text = value.trim();
  if (!text.startsWith("[") || !text.endsWith("]")) return value;
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : value;
  } catch (_error) {
    return value;
  }
}

function resolvePredicateValue(source, state) {
  const key = normalizeExpressionVariableTerm(source);
  if (key && Object.prototype.hasOwnProperty.call(state, key)) return state[key];
  return parseLiteral(source);
}

function expressionValuesMatch(left, right) {
  if (left === right) return true;
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber === rightNumber;
  return String(left) === String(right);
}

function parseLiteral(value) {
  const text = String(value || "").trim();
  if (/^".*"$/.test(text)) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text.slice(1, -1);
    }
  }
  if (/^'.*'$/.test(text)) return text.slice(1, -1).replace(/\\(["'\\])/g, "$1");
  if (/^true$/i.test(text)) return true;
  if (/^false$/i.test(text)) return false;
  if (/^null$/i.test(text)) return null;
  if (text !== "" && !Number.isNaN(Number(text))) return Number(text);
  return text;
}

function validateYarn(yarnPath, outputDir) {
  const yarnOut = path.join(outputDir, "yarn-out");
  fs.mkdirSync(yarnOut, { recursive: true });
  runTool("Yarn Spinner", tools.ysc, [
    "compile",
    yarnPath,
    "--output-directory",
    yarnOut,
    "--output-name",
    "state-runtime-key-play"
  ]);
}

function validateYarnPlaythrough(yarnPath) {
  const script = fs.readFileSync(yarnPath, "utf8");
  const result = runMinimalYarnScript(script, {
    startNode: "Start",
    choiceLabel: "Slip two coins to the Brakeman"
  });
  assert(result.output.includes("Coins before: 3."), "Yarn runner renders start body");
  assert(result.output.includes("Nested coins: 3."), "Yarn runner renders nested path template");
  assert(result.output.includes("Coins before choice: 3. Suspicion: 1."), "Yarn runner renders choice body");
  assert(result.output.includes("Coins after: 1. Suspicion after: 0."), "Yarn runner applies bribe effects");
  assert(result.state.inventory_coins === 1, "Yarn runner state keeps inventory_coins = 1");
  assert(result.state.guard_suspicion === 0, "Yarn runner state keeps guard_suspicion = 0");
  console.log("[ok] minimal Yarn runner walked bribe branch");
}

function validateYarnGenericPlaythrough(yarnPath, options = {}) {
  const script = fs.readFileSync(yarnPath, "utf8");
  const nodes = parseYarnNodes(script);
  const startNode = nodes.keys().next().value;
  const routeLabel = options.name ? ` (${options.name})` : "";
  assert(startNode, "Yarn runner found a start node");
  const result = runMinimalYarnScript(script, { startNode, choiceLabels: normalizeChoiceLabels(options) });
  assert(result.visited.length > 0, "Yarn runner visits at least one node");
  if (nodes.size > 1) assert(result.visited.length > 1, "Yarn runner reaches beyond the first node");
  validateRouteExpectations(`Yarn runner${routeLabel}`, result, options);
  console.log(`[ok] minimal Yarn runner${routeLabel} visited ${result.visited.length} node(s) from ${startNode}`);
  return result;
}

function runMinimalYarnScript(script, options = {}) {
  const nodes = parseYarnNodes(script);
  const state = parseYarnDeclarations(script);
  let current = options.startNode || "Start";
  const output = [];
  const visited = [];
  const visitedCounts = new Map();
  const seen = new Set();
  const choiceLabels = normalizeChoiceLabels(options);

  while (current) {
    if (visited.length > 50) throw new Error("Yarn runner exceeded route limit.");
    seen.add(current);
    visited.push(current);
    visitedCounts.set(current, (visitedCounts.get(current) || 0) + 1);
    const node = nodes.get(current);
    if (!node) throw new Error(`Yarn node not found: ${current}`);
    const route = runYarnNode(node, state, output, choiceLabels, visitedCounts);
    current = route.next;
    if (!current || seen.has(current)) break;
  }

  return { output: output.join("\n"), state, visited };
}

function parseYarnNodes(script) {
  const nodes = new Map();
  const blocks = String(script || "").split(/\n(?=title:\s*)/g);
  for (const block of blocks) {
    const title = block.match(/^title:\s*(.+)$/m)?.[1]?.trim();
    if (!title) continue;
    const body = block.match(/---\n([\s\S]*?)\n===/)?.[1] || "";
    nodes.set(title, body.replace(/\r\n/g, "\n").split("\n"));
  }
  return nodes;
}

function parseYarnDeclarations(script) {
  const state = {};
  const pattern = /<<declare\s+\$([a-zA-Z_]\w*)\s*=\s*([^>]+)>>/g;
  for (const match of String(script || "").matchAll(pattern)) {
    state[match[1]] = parseLiteral(match[2]);
  }
  return state;
}

function runYarnNode(lines, state, output, choiceLabels, visitedCounts) {
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || line.startsWith("//") || line.startsWith("<<declare")) continue;
    if (line.startsWith("->")) {
      const options = collectYarnOptions(lines, index);
      const choice = pickYarnChoice(options, state, nextChoiceLabel(choiceLabels), visitedCounts);
      if (!choice) return { next: "" };
      return runYarnOption(choice, state);
    }
    const jump = line.match(/^<<jump\s+([a-zA-Z_]\w*)>>$/);
    if (jump) return { next: jump[1] };
    const ifMatch = line.match(/^<<if\s+(.+?)>>$/);
    if (ifMatch) {
      const block = collectYarnIfBlock(lines, index);
      const selected = evaluateYarnCondition(ifMatch[1], state, visitedCounts) ? block.thenLines : block.elseLines;
      return runYarnNode(selected, state, output, choiceLabels, visitedCounts);
    }
    if (line.startsWith("<<")) {
      applyYarnCommand(line, state);
      continue;
    }
    output.push(renderYarnText(raw.trimEnd(), state));
  }
  return { next: "" };
}

function collectYarnIfBlock(lines, startIndex) {
  const thenLines = [];
  const elseLines = [];
  let target = thenLines;
  let depth = 0;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("<<if ")) {
      depth += 1;
      target.push(lines[index]);
      continue;
    }
    if (line === "<<endif>>") {
      if (depth === 0) return { thenLines, elseLines, endIndex: index };
      depth -= 1;
      target.push(lines[index]);
      continue;
    }
    if (depth === 0 && line === "<<else>>") {
      target = elseLines;
      continue;
    }
    target.push(lines[index]);
  }
  return { thenLines, elseLines, endIndex: lines.length - 1 };
}

function collectYarnOptions(lines, startIndex) {
  const options = [];
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line.startsWith("->")) break;
    const match = line.match(/^->\s*(.*?)\s*(?:<<if\s+(.+?)>>)?$/);
    const option = {
      label: (match?.[1] || "").trim(),
      condition: (match?.[2] || "").trim(),
      commands: []
    };
    index += 1;
    while (index < lines.length && !lines[index].trim().startsWith("->")) {
      const command = lines[index].trim();
      if (command) option.commands.push(command);
      index += 1;
    }
    options.push(option);
  }
  return options;
}

function pickYarnChoice(options, state, preferredChoiceLabel, visitedCounts) {
  const available = options.filter((option) => !option.condition || evaluateYarnCondition(option.condition, state, visitedCounts));
  if (preferredChoiceLabel) {
    const matched = available.find((option) => option.label === preferredChoiceLabel);
    if (!matched) throw new Error(`Yarn choice not found: ${preferredChoiceLabel}`);
    return matched;
  }
  return available[0] || null;
}

function runYarnOption(option, state) {
  for (const command of option.commands) {
    const jump = command.match(/^<<jump\s+([a-zA-Z_]\w*)>>$/);
    if (jump) return { next: jump[1] };
    applyYarnCommand(command, state);
  }
  return { next: "" };
}

function applyYarnCommand(command, state) {
  const set = command.match(/^<<set\s+\$([a-zA-Z_]\w*)\s+to\s+(.+?)>>$/);
  if (set) {
    state[set[1]] = evaluateYarnValue(set[2], state);
  }
}

function evaluateYarnCondition(condition, state, visitedCounts = new Map()) {
  const withVisited = String(condition || "").replace(/visited\(\"([^\"]+)\"\)/g, (_match, nodeTitle) => {
    return (visitedCounts.get(nodeTitle) || 0) > 0 ? "true" : "false";
  });
  const normalized = replaceTextOutsideQuotes(withVisited, (part) => {
    return part
      .replace(/\band\b/g, "&&")
      .replace(/\bor\b/g, "||")
      .replace(/\$([a-zA-Z_]\w*)/g, "$1");
  });
  return evaluateCondition(normalized, state);
}

function evaluateYarnValue(source, state) {
  const text = String(source || "").trim();
  const arithmetic = text.match(/^\$([a-zA-Z_]\w*)\s*([+-])\s*(.+)$/);
  if (arithmetic) {
    const left = Number(state[arithmetic[1]] || 0);
    const right = Number(parseLiteral(arithmetic[3]) || 0);
    return arithmetic[2] === "+" ? left + right : left - right;
  }
  const variable = text.match(/^\$([a-zA-Z_]\w*)$/);
  if (variable) return state[variable[1]];
  return parseLiteral(text);
}

function renderYarnText(text, state) {
  return String(text || "").replace(/\{\$([a-zA-Z_]\w*)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(state, key) ? String(state[key]) : match;
  });
}

function validateTweeGenericPlaythrough(tweePath, options = {}) {
  const script = fs.readFileSync(tweePath, "utf8");
  const routeLabel = options.name ? ` (${options.name})` : "";
  const result = runMinimalTweeScript(script, { choiceLabels: normalizeChoiceLabels(options) });
  assert(result.visited.length > 0, "Twee runner visits at least one passage");
  validateRouteExpectations(`Twee runner${routeLabel}`, result, options);
  console.log(`[ok] minimal Twee runner${routeLabel} visited ${result.visited.length} passage(s)`);
  return result;
}

function runMinimalTweeScript(script, options = {}) {
  const passages = parseTweePassages(script);
  const storyData = parseTweeStoryData(passages.get("StoryData") || []);
  const state = parseTweeInitialState(passages.get("StoryInit") || []);
  let current = storyData.start || "Start";
  const output = [];
  const visited = [];
  const visitedCounts = new Map();
  const choiceLabels = normalizeChoiceLabels(options);
  const seen = new Set();

  while (current) {
    if (visited.length > 50) throw new Error("Twee runner exceeded route limit.");
    const lines = passages.get(current);
    if (!lines) throw new Error(`Twee passage not found: ${current}`);
    visited.push(current);
    visitedCounts.set(current, (visitedCounts.get(current) || 0) + 1);
    const route = runTweePassage(lines, state, output, choiceLabels, visitedCounts);
    seen.add(current);
    current = route.next;
    if (!current || seen.has(current)) break;
  }

  return { output: output.join("\n"), state, visited };
}

function parseTweePassages(script) {
  const passages = new Map();
  let current = "";
  for (const raw of String(script || "").replace(/\r\n/g, "\n").split("\n")) {
    const header = raw.match(/^::\s+(.+?)(?:\s+\[[^\]]*\])?\s*$/);
    if (header) {
      current = header[1].trim();
      passages.set(current, []);
      continue;
    }
    if (current) passages.get(current).push(raw);
  }
  return passages;
}

function parseTweeStoryData(lines) {
  const text = (lines || []).join("\n").trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_error) {
    return {};
  }
}

function parseTweeInitialState(lines) {
  const state = {};
  (lines || []).forEach((line) => applyTweeCommand(line.trim(), state));
  return state;
}

function runTweePassage(lines, state, output, choiceLabels, visitedCounts) {
  const block = runTweeLineBlock(lines, state, output, visitedCounts);
  if (block.next) return { next: block.next };
  const preferredChoiceLabel = Array.isArray(choiceLabels) && choiceLabels.length ? choiceLabels[0] : "";
  const picked = pickTweeChoice(block.links, preferredChoiceLabel);
  if (!picked) return { next: "" };
  if (picked.consumesPreferred) choiceLabels.shift();
  runTweeLineBlock(picked.choice.commands, state, output, visitedCounts);
  return { next: picked.choice.target };
}

function runTweeLineBlock(lines, state, output, visitedCounts) {
  const links = [];
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index];
    const line = raw.trim();
    if (!line || line.startsWith("/*") || line === "<</link>>" || line === "<</if>>") continue;
    const ifMatch = line.match(/^<<if\s+([\s\S]+?)>>$/);
    if (ifMatch) {
      const block = collectTweeIfBlock(lines, index);
      const selected = evaluateTweeCondition(ifMatch[1], state, visitedCounts) ? block.thenLines : block.elseLines;
      const nested = runTweeLineBlock(selected, state, output, visitedCounts);
      links.push(...nested.links);
      if (nested.next) return { links, next: nested.next };
      index = block.endIndex;
      continue;
    }
    const linkMatch = parseTweeLinkMacro(line);
    if (linkMatch) {
      const block = collectTweeLinkBlock(lines, index);
      links.push({ ...linkMatch, commands: block.commands });
      index = block.endIndex;
      continue;
    }
    const goto = parseTweeGotoMacro(line);
    if (goto) return { links, next: goto.target };
    if (line.startsWith("<<set ")) {
      applyTweeCommand(line, state);
      continue;
    }
    output.push(renderTweeText(raw.trimEnd(), state));
  }
  return { links, next: "" };
}

function collectTweeIfBlock(lines, startIndex) {
  const thenLines = [];
  const elseLines = [];
  let target = thenLines;
  let depth = 0;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();
    if (line.startsWith("<<if ")) {
      depth += 1;
      target.push(lines[index]);
      continue;
    }
    if (line === "<</if>>") {
      if (depth === 0) return { thenLines, elseLines, endIndex: index };
      depth -= 1;
      target.push(lines[index]);
      continue;
    }
    if (depth === 0 && line === "<<else>>") {
      target = elseLines;
      continue;
    }
    target.push(lines[index]);
  }
  return { thenLines, elseLines, endIndex: lines.length - 1 };
}

function collectTweeLinkBlock(lines, startIndex) {
  const commands = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim() === "<</link>>") return { commands, endIndex: index };
    commands.push(lines[index]);
  }
  return { commands, endIndex: lines.length - 1 };
}

function parseTweeLinkMacro(line) {
  const match = line.match(/^<<link\s+((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*'))\s+((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*'))\s*>>$/);
  if (!match) return null;
  return {
    label: parseQuotedMacroString(match[1]),
    target: parseQuotedMacroString(match[2])
  };
}

function parseTweeGotoMacro(line) {
  const match = line.match(/^<<goto\s+((?:"(?:\\.|[^"])*")|(?:'(?:\\.|[^'])*'))\s*>>$/);
  return match ? { target: parseQuotedMacroString(match[1]) } : null;
}

function parseQuotedMacroString(source) {
  const text = String(source || "").trim();
  if (text.startsWith("\"")) {
    try {
      return JSON.parse(text);
    } catch (_error) {
      return text.slice(1, -1);
    }
  }
  return text.slice(1, -1).replace(/\\(["'\\])/g, "$1");
}

function pickTweeChoice(links, preferredChoiceLabel) {
  const available = Array.isArray(links) ? links : [];
  if (preferredChoiceLabel) {
    const matched = available.find((link) => link.label === preferredChoiceLabel);
    if (matched) return { choice: matched, consumesPreferred: true };
    if (available.length === 1 && available[0].label === "Continue") {
      return { choice: available[0], consumesPreferred: false };
    }
    throw new Error(`Twee choice not found: ${preferredChoiceLabel}`);
  }
  return available[0] ? { choice: available[0], consumesPreferred: false } : null;
}

function applyTweeCommand(command, state) {
  const set = String(command || "").trim().match(/^<<set\s+\$([a-zA-Z_]\w*)\s*(=|\+=|-=)\s*([\s\S]+?)>>$/);
  if (!set) return;
  const key = set[1];
  const operator = set[2];
  const value = evaluateTweeValue(set[3], state);
  if (operator === "=") {
    state[key] = value;
  } else if (operator === "+=") {
    state[key] = Number(state[key] || 0) + Number(value || 0);
  } else if (operator === "-=") {
    state[key] = Number(state[key] || 0) - Number(value || 0);
  }
}

function evaluateTweeValue(source, state) {
  const text = String(source || "").trim();
  const toggle = text.match(/^!\s*\$([a-zA-Z_]\w*)$/);
  if (toggle) return !state[toggle[1]];
  const variable = text.match(/^\$([a-zA-Z_]\w*)$/);
  if (variable) return state[variable[1]];
  try {
    return JSON.parse(text);
  } catch (_error) {
    return parseLiteral(text);
  }
}

function evaluateTweeCondition(condition, state, visitedCounts = new Map()) {
  const normalized = String(condition || "").replace(/visited\(\"([^\"]+)\"\)/g, (_match, passage) => {
    return String(visitedCounts.get(passage) || 0);
  });
  const stateKeys = Object.keys(state).filter((key) => /^[a-zA-Z_]\w*$/.test(key));
  const declarations = stateKeys.map((key) => `const $${key} = __state[${JSON.stringify(key)}];`).join("\n");
  try {
    return Boolean(Function("__state", `${declarations}\nreturn (${normalized});`)(state));
  } catch (error) {
    throw new Error(`Unsupported Twee condition in acceptance runner: ${condition} (${error.message})`);
  }
}

function renderTweeText(text, state) {
  return String(text || "").replace(/<<print\s+\$([a-zA-Z_]\w*)\s*>>/g, (_match, key) => {
    const value = state[key];
    return value == null ? "" : String(value);
  });
}

function replaceTextOutsideQuotes(text, transform) {
  let result = "";
  let buffer = "";
  let quote = "";
  let escaped = false;
  const flush = () => {
    if (!buffer) return;
    result += transform(buffer);
    buffer = "";
  };
  for (const char of String(text || "")) {
    if (quote) {
      result += char;
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'") {
      flush();
      quote = char;
      result += char;
      continue;
    }
    buffer += char;
  }
  flush();
  return result;
}

function validateInk(inkPath, outputDir) {
  runTool("inklecate", tools.inklecate, [
    "-j",
    "-o",
    path.join(outputDir, "state-runtime-key-play.ink.json"),
    inkPath
  ]);
}

function validateInkPlaythrough(inkPath) {
  const result = childProcess.spawnSync(tools.inklecate, ["-p", inkPath], {
    cwd: projectRoot,
    encoding: "utf8",
    input: "1\n",
    maxBuffer: 10 * 1024 * 1024,
    timeout: 10000
  });
  if (result.status !== 0) {
    throw new Error(`inklecate playthrough failed:\n${result.stdout || ""}${result.stderr || ""}`);
  }
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  assert(output.includes("Slip two coins to the Brakeman"), "inklecate playthrough exposes bribe choice");
  assert(output.includes("Coins after: 1."), "inklecate playthrough applies coin effect");
  assert(output.includes("Suspicion after: 0."), "inklecate playthrough applies suspicion effect");
  console.log("[ok] inklecate playthrough walked bribe branch");
}

function validateInkGenericPlaythrough(inkPath, options = {}, runtimeResult = {}) {
  const routeLabel = options.name ? ` (${options.name})` : "";
  const selectedChoices = Array.isArray(runtimeResult.selectedChoices) ? runtimeResult.selectedChoices : [];
  const input = selectedChoices.map((choice) => String(choice.index)).join("\n") + (selectedChoices.length ? "\n" : "");
  const result = childProcess.spawnSync(tools.inklecate, ["-p", inkPath], {
    cwd: projectRoot,
    encoding: "utf8",
    input,
    maxBuffer: 20 * 1024 * 1024,
    timeout: Math.max(10000, Math.min(Number(timeoutMs || 10000), 120000))
  });
  if (result.status !== 0) {
    throw new Error(`inklecate playthrough${routeLabel} failed:\n${result.stdout || ""}${result.stderr || ""}`);
  }
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  (options.expectText || []).forEach((expected) => {
    assert(output.includes(expected), `inklecate playthrough${routeLabel} output did not include expected text: ${expected}`);
  });
  console.log(`[ok] inklecate playthrough${routeLabel} accepted ${selectedChoices.length} choice(s)`);
  return { selectedChoices, output };
}

function validateTwee(tweePath, outputDir) {
  runTool("Tweego", tools.tweego, [
    "-o",
    path.join(outputDir, "state-runtime-key-play.html"),
    tweePath
  ]);
}

function runTool(label, command, commandArgs) {
  const result = childProcess.spawnSync(command, commandArgs, {
    cwd: projectRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed:\n${result.stdout || ""}${result.stderr || ""}`);
  }
  console.log(`[ok] ${label} accepted export`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}
