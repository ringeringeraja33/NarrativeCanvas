#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

main();

function main() {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (args.help || !args.runtime) {
      printUsage();
      process.exit(args.help ? 0 : 1);
    }
    const runtimePath = path.resolve(args.runtime);
    const routesPath = args.routes ? path.resolve(args.routes) : "";
    const document = readJson(runtimePath);
    assertRuntimeDocument(document);
    const routeCases = routesPath ? readRouteCases(routesPath) : [createDefaultRouteCase()];
    const results = routeCases.map((routeCase) => runRouteCase(document, routeCase));
    const summary = {
      status: "pass",
      runtime: formatPath(runtimePath),
      routes: routesPath ? formatPath(routesPath) : "",
      routeCount: results.length,
      results
    };
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(`[fail] ${error.message || error}`);
    process.exit(1);
  }
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    if (key === "help") {
      result.help = true;
      continue;
    }
    result[key] = argv[index + 1] || "";
    index += 1;
  }
  return result;
}

function printUsage() {
  console.log(`Usage:
  node examples/custom-runtime-loader/runtime-json-runner.cjs --runtime path/to/export-runtime.json [--routes path/to/routes.json]

Options:
  --runtime path   Runtime JSON export to load
  --routes path    Optional narrative-canvas-route-cases JSON file
  --help           Show this message`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readRouteCases(filePath) {
  const document = readJson(filePath);
  if (document?.format !== "narrative-canvas-route-cases") {
    throw new Error(`Unsupported route cases file: ${filePath}`);
  }
  if (!Array.isArray(document.cases) || !document.cases.length) {
    throw new Error(`Route cases file has no cases: ${filePath}`);
  }
  return document.cases.map(normalizeRouteCase);
}

function createDefaultRouteCase() {
  return normalizeRouteCase({
    name: "default",
    choiceLabels: [],
    minVisits: 1,
    expectNode: [],
    expectText: [],
    expectState: []
  });
}

function normalizeRouteCase(routeCase) {
  return {
    name: String(routeCase?.name || "route"),
    choiceLabels: normalizeStringList(routeCase?.choiceLabels),
    minVisits: Number(routeCase?.minVisits || 0),
    expectNode: normalizeStringList(routeCase?.expectNode),
    expectText: normalizeStringList(routeCase?.expectText),
    expectState: Array.isArray(routeCase?.expectState) ? routeCase.expectState.map((item) => ({
      key: String(item?.key || ""),
      value: item?.value
    })).filter((item) => item.key) : []
  };
}

function normalizeStringList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (value == null || value === "") return [];
  return [String(value)];
}

function assertRuntimeDocument(document) {
  if (document?.format !== "narrative-canvas-runtime") {
    throw new Error("Unsupported Narrative Canvas runtime document.");
  }
  if (document.version !== 1) {
    throw new Error(`Unsupported runtime version: ${document.version}`);
  }
  if (!Array.isArray(document.nodes) || !document.nodes.length) {
    throw new Error("Runtime document has no nodes.");
  }
}

function runRouteCase(document, routeCase) {
  const session = createRuntimeSession(document);
  const choiceLabels = [...routeCase.choiceLabels];
  const visited = [];
  const output = [];
  const selectedChoices = [];
  const seenSteps = new Set();
  let finalState = {};

  for (let step = 0; step < 100; step += 1) {
    const page = session.current();
    const visit = {
      id: page.node.id,
      slug: page.node.slug,
      title: page.node.title
    };
    visited.push(visit);
    output.push(page.body);
    Object.values(page.customFields || {}).forEach((value) => {
      if (value) output.push(String(value));
    });
    finalState = page.state;

    const stepKey = `${page.node.id}:${JSON.stringify(finalState)}:${choiceLabels.join("|")}`;
    if (seenSteps.has(stepKey)) break;
    seenSteps.add(stepKey);

    const choice = pickChoice(page.choices, choiceLabels);
    if (choice) {
      selectedChoices.push({ id: choice.id, label: choice.label });
      session.choose(choice.id);
      continue;
    }
    if (!session.advance()) break;
  }

  const result = {
    name: routeCase.name,
    visited,
    selectedChoices,
    output: output.filter(Boolean).join("\n"),
    finalState
  };
  validateRouteCase(routeCase, result);
  return {
    name: result.name,
    visitedCount: result.visited.length,
    visited: result.visited,
    selectedChoices: result.selectedChoices,
    finalState: result.finalState
  };
}

function createRuntimeSession(document) {
  const state = deepClone(document.variables || {});
  const nodeById = new Map((document.nodes || []).map((node) => [node.id, node]));
  let currentNodeId = document.startNodeId || document.nodes?.[0]?.id || "";

  function current() {
    const node = nodeById.get(currentNodeId);
    if (!node) throw new Error(`Missing current node: ${currentNodeId}`);
    if (node.condition && !evaluateCondition(node.condition, state)) {
      throw new Error(`Current node condition is false: ${node.title || node.id}`);
    }
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
    if (node?.routing?.mode === "end") return false;
    const branch = (node?.conditionBranches || []).find((item) => !item.condition || evaluateCondition(item.condition, state));
    const transition = branch || (node?.next || []).find((item) => !item.condition || evaluateCondition(item.condition, state));
    const targetId = transition?.targetId || node?.routing?.targetId || "";
    if (!targetId) return false;
    currentNodeId = targetId;
    return true;
  }

  function choose(choiceId) {
    const node = nodeById.get(currentNodeId);
    const choice = (node?.choices || []).find((item) => item.id === choiceId || item.label === choiceId);
    if (!choice) return false;
    if (choice.condition && !evaluateCondition(choice.condition, state)) return false;
    applyEffects(choice.effects, state);
    if (choice.targetId) currentNodeId = choice.targetId;
    return true;
  }

  return { current, advance, choose };
}

function pickChoice(choices, choiceLabels) {
  const available = Array.isArray(choices) ? choices : [];
  if (!available.length) return null;
  const requested = choiceLabels.length ? String(choiceLabels.shift()).trim() : "";
  if (!requested) return available[0];
  const found = available.find((choice) => choice.id === requested || choice.label === requested);
  if (!found) {
    throw new Error(`Choice not found: ${requested}. Available: ${available.map((choice) => choice.label || choice.id).join(", ")}`);
  }
  return found;
}

function renderRuntimeFields(fields, state) {
  const rendered = {};
  for (const [key, value] of Object.entries(fields || {})) {
    rendered[key] = renderRuntimeText(value, state);
  }
  return rendered;
}

function renderRuntimeText(text, state) {
  return String(text || "").replace(/\{([^{}]+)\}/g, (match, key) => {
    const resolved = resolveStateValue(key.trim(), state);
    return resolved.found ? String(resolved.value) : match;
  });
}

function applyEffects(effects, state) {
  for (const effect of effects || []) {
    if (!effect.key) continue;
    const key = effect.key;
    const value = resolveEffectValue(effect, state);
    if (effect.op === "set") state[key] = value;
    else if (effect.op === "add") state[key] = Number(state[key] || 0) + Number(value || 0);
    else if (effect.op === "subtract") state[key] = Number(state[key] || 0) - Number(value || 0);
    else if (effect.op === "toggle") state[key] = !state[key];
    else if (effect.op === "append") {
      const current = Array.isArray(state[key]) ? state[key] : [];
      state[key] = [...current, value];
    } else if (effect.op === "remove") {
      const current = Array.isArray(state[key]) ? state[key] : [];
      state[key] = current.filter((item) => !valuesMatch(item, value));
    } else if (effect.op === "clear") {
      state[key] = Array.isArray(state[key]) ? [] : "";
    }
  }
}

function resolveEffectValue(effect, state) {
  if (effect.valueSource === "state" || effect.valueSource === "variable") {
    const resolved = resolveStateValue(effect.value, state);
    return resolved.found ? resolved.value : effect.value;
  }
  return effect.value;
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
  const comparison = text.match(/^([a-zA-Z_][\w.]*)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (comparison) {
    const left = resolveStateValue(comparison[1], state).value;
    const right = parseConditionValue(comparison[3], state);
    if (comparison[2] === "==") return valuesMatch(left, right);
    if (comparison[2] === "!=") return !valuesMatch(left, right);
    if (comparison[2] === ">=") return Number(left) >= Number(right);
    if (comparison[2] === "<=") return Number(left) <= Number(right);
    if (comparison[2] === ">") return Number(left) > Number(right);
    if (comparison[2] === "<") return Number(left) < Number(right);
  }
  if (/^[a-zA-Z_][\w.]*$/.test(text)) return Boolean(resolveStateValue(text, state).value);
  throw new Error(`Unsupported condition in custom runtime loader: ${text}`);
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
  const match = String(source || "").trim().match(/^(has|contains)\s*\(([\s\S]*)\)$/i);
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
  const match = text.match(/^([a-zA-Z_][\w.]*)$/);
  return match ? match[1] : "";
}

function evaluateExpressionPredicate(predicate, state) {
  const container = normalizeMembershipContainer(resolveStateValue(predicate.key, state).value);
  const value = parseConditionValue(predicate.value, state);
  if (Array.isArray(container)) return container.some((item) => valuesMatch(item, value));
  if (typeof container === "string") return String(value) !== "" && container.includes(String(value));
  if (container && typeof container === "object") return Object.prototype.hasOwnProperty.call(container, String(value));
  return valuesMatch(container, value);
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

function parseConditionValue(source, state) {
  const key = normalizeExpressionVariableTerm(source);
  if (key) {
    const resolved = resolveStateValue(key, state);
    if (resolved.found) return resolved.value;
  }
  return parseLiteral(source);
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
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function resolveStateValue(key, state) {
  const text = String(key || "").trim();
  if (!text) return { found: false, value: undefined };
  if (Object.prototype.hasOwnProperty.call(state, text)) {
    return { found: true, value: state[text] };
  }
  if (!text.includes(".")) return { found: false, value: undefined };
  const parts = text.split(".");
  let current = state;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !Object.prototype.hasOwnProperty.call(current, part)) {
      return { found: false, value: undefined };
    }
    current = current[part];
  }
  return { found: true, value: current };
}

function validateRouteCase(routeCase, result) {
  if (routeCase.minVisits > 0 && result.visited.length < routeCase.minVisits) {
    throw new Error(`${routeCase.name} visited ${result.visited.length} node(s), expected at least ${routeCase.minVisits}`);
  }
  routeCase.expectNode.forEach((expected) => {
    if (!result.visited.some((visit) => [visit.id, visit.slug, visit.title].includes(expected))) {
      throw new Error(`${routeCase.name} did not visit ${expected}; visited ${result.visited.map((visit) => visit.slug || visit.title || visit.id).join(", ")}`);
    }
  });
  routeCase.expectText.forEach((expected) => {
    if (!result.output.includes(expected)) {
      throw new Error(`${routeCase.name} output did not include expected text: ${expected}`);
    }
  });
  routeCase.expectState.forEach((expected) => {
    const resolved = resolveStateValue(expected.key, result.finalState);
    if (!resolved.found) throw new Error(`${routeCase.name} final state is missing ${expected.key}`);
    if (!valuesMatch(resolved.value, expected.value)) {
      throw new Error(`${routeCase.name} final state ${expected.key} expected ${JSON.stringify(expected.value)}, got ${JSON.stringify(resolved.value)}`);
    }
  });
}

function valuesMatch(actual, expected) {
  if (actual === expected) return true;
  const actualNumber = Number(actual);
  const expectedNumber = Number(expected);
  if (Number.isFinite(actualNumber) && Number.isFinite(expectedNumber)) return actualNumber === expectedNumber;
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function formatPath(filePath) {
  return path.relative(process.cwd(), filePath) || ".";
}
