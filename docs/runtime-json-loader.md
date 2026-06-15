# Runtime JSON Loader Guide

Runtime JSON is the portable intermediate representation exported by Narrative Canvas. It is intended for custom loaders, prototypes, build scripts, and engine integrations that want the playable graph without canvas layout data.

Schema: [runtime-json.schema.json](runtime-json.schema.json)

Runnable examples:

- [`examples/custom-runtime-loader`](../examples/custom-runtime-loader)
- [`examples/godot-runtime-loader`](../examples/godot-runtime-loader)

## Contract

A consumer should treat the exported document as data:

- `format` must be `narrative-canvas-runtime`.
- `version` is the runtime schema version.
- `variables` contains initial state values after export-name mapping.
- `variableNames` lists exported variable identifiers.
- `nodes` contains playable nodes, choices, conditions, effects, routing, cast, and custom fields.
- `links` is a flat graph reference for consumers that need edge-level data.
- `playbook.rules` and `playbook.actions` preserve runtime configuration that may need target-specific handling.
- `report` contains compatibility warnings and source-to-export name maps.

Canvas-only data such as position, size, color, frames, port placement, selection, UI state, and editor history is intentionally absent.

## Minimal Runner Shape

The smallest useful loader needs:

1. A state object initialized from `variables`.
2. A `nodeById` map.
3. An expression evaluator for the supported condition subset.
4. An effect applier for portable operations.
5. A step function that returns the current node body and available choices.

```js
export function createRuntimeSession(document) {
  assertRuntimeDocument(document);
  const state = structuredClone(document.variables || {});
  const nodeById = new Map((document.nodes || []).map((node) => [node.id, node]));
  let currentNodeId = document.startNodeId || document.nodes?.[0]?.id || "";

  function current() {
    const node = nodeById.get(currentNodeId);
    if (!node) return null;
    applyEffects(node.effects, state);
    return {
      node,
      state: structuredClone(state),
      body: renderText(node.body, state),
      choices: getAvailableChoices(node, state)
    };
  }

  function choose(choiceId) {
    const node = nodeById.get(currentNodeId);
    const choice = node?.choices?.find((item) => item.id === choiceId);
    if (!choice) return false;
    if (choice.condition && !evaluateCondition(choice.condition, state)) return false;
    applyEffects(choice.effects, state);
    currentNodeId = choice.targetId || currentNodeId;
    return true;
  }

  return { current, choose };
}

function assertRuntimeDocument(document) {
  if (document?.format !== "narrative-canvas-runtime") {
    throw new Error("Unsupported Narrative Canvas runtime document.");
  }
  if (document.version !== 1) {
    throw new Error(`Unsupported runtime version: ${document.version}`);
  }
}

function getAvailableChoices(node, state) {
  return (node.choices || []).filter((choice) => {
    return !choice.condition || evaluateCondition(choice.condition, state);
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

function renderText(text, state) {
  return String(text || "").replace(/\{([a-zA-Z_]\w*)\}/g, (match, key) => {
    return Object.prototype.hasOwnProperty.call(state, key) ? String(state[key]) : match;
  });
}
```

The example deliberately omits full expression parsing. A production loader should either implement the supported JavaScript condition subset or generate target-native scripts from the Yarn, ink, or Twee exporters.

## Condition Subset

Runtime JSON condition strings are export-normalized JavaScript expressions:

- Bare key truthiness: `flag_watch_missing`
- Comparisons: `===`, `!==`, `>=`, `<=`, `>`, `<`
- Boolean joins: `&&`, `||`
- Grouped subexpressions: `A && (B || C)`
- Whole-expression negation: `!(...)`
- Quoted values containing logical operators: `ticket_phrase === "red && blue"`
- Membership checks: `flag_tokens.includes("boarding")`
- Flat-first object paths: `inventory.coins`

Legacy `==`, `!=`, `not ...`, `has(key, value)`, and `contains(key, value)` can appear in older source projects, but exports normalize new output toward the JavaScript subset. Object paths first check whether the full dotted key exists as a flat variable. If it does not, the resolver walks the JSON object path.

When a source expression falls outside the supported subset, Runtime JSON keeps the original string and the export report records `expression-not-translated`. Yarn, ink, and Twee use a `false` guard for that branch so their scripts remain parseable until the expression is rewritten or implemented in a custom loader.

## Effects

Portable operations:

- `set`
- `add`
- `subtract`
- `toggle`

Runtime-only operations are preserved in Runtime JSON and listed in `report.warnings`. Consumers may implement them, ignore them, or block export import depending on the target runtime.

## Report Handling

Use the report before loading into a target runtime:

- `report.variableNameMap` maps source variable keys to exported identifiers.
- `report.nodeNameMap` maps source node IDs to exported slugs.
- `report.warnings` lists compatibility notes such as sanitized names, implicit variables, complex variables, or runtime-only effects.

A loader can treat warnings as nonfatal, but build pipelines should surface them so writers and designers know what changed.

## Local Acceptance

The executable acceptance script includes a minimal Runtime JSON loader based on this guide:

```bash
node scripts/portable-export-acceptance.cjs
```

It exports the `state-runtime-key-play` fixture, walks the bribe branch through Runtime JSON, and checks the same export set with Yarn Spinner, ink, and Tweego tooling.

For a standalone consumer reference, generate the Runtime JSON into a temporary directory, then run the loader:

```bash
node scripts/portable-export-acceptance.cjs \
  --output-dir /tmp/narrative-canvas-runtime \
  --clean-output \
  --keep-output

node examples/custom-runtime-loader/runtime-json-runner.cjs \
  --runtime /tmp/narrative-canvas-runtime/state-runtime-key-play-runtime.json \
  --routes tests/fixtures/state-runtime-key-play.routes.json
```

That example uses the same route case format as portable acceptance and prints a JSON summary for CI or build logs.

For Godot 4, copy the scripts in [`examples/godot-runtime-loader`](../examples/godot-runtime-loader) into a project and point `RuntimeRouteDemo.gd` at an exported Runtime JSON file plus optional route cases.
