# Portable Export Contract

Narrative Canvas exports must be useful outside this app. The export layer is engine-neutral: Unity, Godot, Unreal, web runtimes, Twine, and custom loaders are consumers, not semantic owners.

## Goals

- Produce plain files that can be stored in source control, reviewed, diffed, and moved between tools.
- Keep `Runtime JSON` as the stable intermediate representation for custom loaders.
- Emit standard text formats for writer-facing and runtime-facing workflows: Yarn, ink, and Twee/Twine.
- Preserve unsupported data in reports instead of silently dropping it.
- Avoid private assumptions from one engine plugin or one runtime package.

## Non-Goals

- No round-trip import from Yarn, ink, or Twine in this phase.
- No engine-specific metadata in the core export model.
- No JavaScript or arbitrary expression language in portable story data.
- No hidden conversion of complex project features into target-specific behavior that the author cannot inspect.

## Common Portable Semantics

| Concept | Portable representation | Notes |
|---|---|---|
| Node identity | Stable `id` plus exported `slug` | `id` preserves canvas identity. `slug` is target-format safe and collision checked. |
| Text body | Plain text with runtime variables | Variable interpolation uses the same runtime resolver as Play where possible. |
| Variables | Flat identifiers | New projects should use lower-case underscore names such as `inventory_coins`. Legacy dot keys are mapped to underscores and recorded in the report. |
| Choices | Repeatable options by default | ink uses sticky `+` choices. Other targets should preserve repeatability unless a target format requires an explicit marker. |
| Conditions | Safe JavaScript expression subset | Bare keys, `===` / `!==` / numeric comparisons, `&&`, `||`, `!`, grouped subexpressions, quoted strings, `array_key.includes(value)`, and flat-first object paths. Legacy condition forms still load and are normalized during export. |
| Effects | `set`, `add`, `subtract`, `toggle` | Other operations stay in Runtime JSON and export warnings until each target format has a clear mapping. |
| Routing | Explicit target ids and slugs | Linear transitions, choice transitions, condition branches, and go-to routing stay visible in Runtime JSON. |
| Cast | Character references by id/name/role | Targets that do not support cast metadata may ignore it without losing story flow. |
| Custom fields | Runtime-rendered metadata | Exporters may render custom node fields as text or preserve them as metadata. |
| Playbook rules/actions | Runtime JSON first | Rules and actions are not silently translated into target-specific logic unless the mapping is documented and test-covered. |

## Play-To-Export Mapping Rules

Exports should follow the same runtime semantics as Play preview wherever the target format can represent them.

### Text And Templates

- Node title, body, dialog turns, choice labels, and custom fields use the runtime template resolver.
- Resolver priority is `variables.<key>` prefix, then node fields (`title`, `body`, `label`, `choices`, direct fields, custom fields), then project variables.
- A node-field template such as `{title}` is not a state read. A project variable such as `{inventory_coins}` is a state read.
- If a template token cannot be resolved, Runtime JSON preserves the original text and Validation marks the token as a template mismatch.

### Conditions

- Node `stateLogic.requirements` has priority over legacy node conditions and custom script condition fields.
- Choice option `requires` and link `requirements` both contribute to exported choice conditions.
- Conditions use a safe JavaScript expression subset: bare keys, strict equality, numeric comparisons, `&&`, `||`, `!`, grouped subexpressions, quoted strings, `array_key.includes(value)`, and flat-first object paths. Legacy `==`, `!=`, `not ...`, `has(...)`, and `contains(...)` continue to load for older projects.
- Expression keys are normalized through the same variable-name map as exported variables.
- Object paths resolve exact flat keys first. If no flat key exists, exporters read the nested JSON value, create a flattened portable variable such as `nested_inventory_coins`, and list the mapping in the export report.
- Membership checks use one state variable plus one literal or state value. Runtime JSON keeps JS-style `.includes(...)`; Yarn emits `contains($key, value)` and declares array variables as JSON strings for a host membership function; ink maps primitive array variables to `LIST`; Twee emits SugarCube/JavaScript `.includes(...)`.
- Expressions outside the subset are preserved in Runtime JSON and reported as export warnings. Yarn, ink, and Twee emit a parseable `false` guard for those branches so exported scripts stay valid while the warning points to the compatibility work item.

### Choices

- Choice options are repeatable by default.
- ink uses sticky `+` choices.
- Yarn uses shortcut options.
- Twee/SugarCube uses `<<link>>` rather than plain wiki links so option effects can run before navigation.
- `choiceRevealMode` affects Play preview only in this phase. Exporters bake the choice condition into the target script and let the target runtime decide how unavailable choices appear.
- `gate` Playbook actions with `op: "lockChoice"` or `op: "unlockChoice"` can be baked when `target` resolves to the choice node and `key` matches the choice option id or label. The action `value` is treated as the condition: `lockChoice` makes the option unavailable while the expression is true; `unlockChoice` adds an availability condition. Blank or `true` locks/unlocks unconditionally, and `false` has no locking effect.

### Effects

- Portable operations are `set`, `add`, `subtract`, and `toggle`.
- Runtime-only operations such as `append`, `remove`, and `clear` stay in Runtime JSON and are listed in Validation and export warnings.
- Node `onVisit` effects run when the node body is entered. Choice `onChoose` effects run inside the choice branch before jumping or diverting.

### Routing

- A node with choices routes through choice-linked targets.
- Conditional links export as ordinary `next` transitions with their own condition expressions.
- Explicit `routing.mode === "goTo"` wins over the next outgoing link for linear nodes.
- `routing.mode === "end"` exports as no next transition in Runtime JSON and as the target format's end behavior where possible.
- Multiple plain outgoing links are exported in deterministic canvas/link order.

### Visit Tracking

- Visit Tracking is a Play preview debug aid and only runs when Debug Mode is enabled.
- The visited-node list is stored for the open preview session and is discarded when Play preview closes.
- During an open preview, `visited.<slug>` conditions can read that temporary session list without creating variables.
- Visit Tracking does not add `visited.<slug>` entries to State Schema, and Runtime JSON does not export automatic `onVisit` writes for it.
- User-authored dotted keys still load as ordinary legacy state keys when they are defined as variables, and follow the same export mapping and warning rules as other dotted keys.

### Playbook Actions

- Playbook actions are preserved in Runtime JSON.
- Portable text exporters do not emit arbitrary Playbook actions unless a specific mapping is documented and fixture-tested.
- The documented first mapping is choice gating: `gate` + `lockChoice` / `unlockChoice` is folded into exported choice conditions for Runtime JSON, Yarn, ink, and Twee when the action points at a concrete choice option.
- Validation marks Playbook actions as export risks so custom loaders can decide whether to implement them.

## Export Formats

### Runtime JSON

Runtime JSON is the source of truth for portable consumers. It strips canvas layout fields and keeps the runtime graph, variables, Narrative Library entries, the compatibility-only Character list, conditions, effects, routing, play rules, and export report. Node references include `codexId` and `kind`; `characterId` remains as a compatibility alias.

Schema: [`runtime-json.schema.json`](runtime-json.schema.json)

Loader guide: [`runtime-json-loader.md`](runtime-json-loader.md)

Consumers should:

- Read `format === "narrative-canvas-runtime"` and `version === 1`.
- Start from `startNodeId` or `startNode`.
- Use `report.variableNameMap` and `report.nodeNameMap` to trace exported names back to source project names.
- Treat `report.warnings` as actionable compatibility notes, not fatal errors unless the consumer cannot support the listed feature.

### Story Markdown

Story Markdown is a readable projection of the runtime graph for writers, review, and the P5 text-source experiment. It keeps node ids in HTML comments, runtime body text, conditions, choices, effects, and `goto` targets. Import is explicit and replacing: `Import MD` reads the minimal dialect back into a canvas project, resets layout to a simple grid, preserves known node ids, rebuilds choice links, and does not watch files for automatic sync. `Layout JSON` exports a schema-backed sidecar keyed by node and link ids for canvas layout, frames, port positions, and link identity. `Import Layout` can apply that sidecar after `Import MD`, restoring matching node layout, frame membership, ports, collapsed state, and link metadata without creating or deleting story nodes.

Layout schema: [`story-layout.schema.json`](story-layout.schema.json)

`State Schema` exports `<slug>-state.schema.json` as the state sidecar for Story Markdown workflows. It is derived from Validation and keeps source keys, portable `exportKey` names, variable initial values, inferred types, read/write/template references, statuses, invalid expressions, and export warning blocks. `Import State` can restore current project variables from the sidecar after `Import MD`; it uses `exportKey` so flattened Story Markdown variables keep their initial values.

Schema: [`state-schema.schema.json`](state-schema.schema.json)

`Export Profile` exports `<slug>-export.profile.json` as a handoff manifest for text-source and portable-export workflows. It lists the portable files, target consumers, schema pointers, node and variable export mappings, and the same export warnings shown in the export report.

Profile schema: [`export-profile.schema.json`](export-profile.schema.json)

Real story source acceptance: [`story-source-acceptance.md`](story-source-acceptance.md)

Format details: [`story-markdown-format.md`](story-markdown-format.md)

### Yarn

Yarn export targets standard Yarn text semantics:

- One Yarn node per exported runtime node.
- `title:` uses the exported node slug.
- Variables are declared in the start node.
- Choices use shortcut option syntax.
- Effects use `<<set>>` where the operation is portable.
- Flow uses `<<jump>>`.

Validation target: a Yarn parser/compiler or a small reference parser that checks node headers, variables, shortcut options, commands, and jumps.

### Ink

Ink export targets standard ink text semantics:

- One knot per exported runtime node.
- Variables use top-level `VAR`.
- Choices use sticky `+`.
- Effects use `~` assignments where the operation is portable.
- Flow uses diverts.

Validation target: ink compiler tooling, inkjs, or a small reference parser that checks knots, variables, choices, assignments, and diverts.

### Twee / Twine

Twee export targets Twee 3 text first because it is portable and diffable. The first supported story format is SugarCube because its variables, conditional macros, links, and setters map closely to the current runtime model.

`StoryData` uses SugarCube `2.30.0` to match the story format bundled with Tweego `2.1.1`. This keeps the default `tweego story.twee -o story.html` path working; projects can upgrade the story format after import if they need newer SugarCube features.

Minimum mapping:

- Passage title = exported node slug.
- Body = runtime-rendered body text.
- Project variables = SugarCube `StoryInit` `<<set $key = value>>` declarations.
- Choice link = SugarCube `<<link "label" "target">>` so onChoose effects can run before navigation.
- Conditions = SugarCube `<<if $key ...>>` wrappers.
- Effects = SugarCube `<<set>>` for `set / add / subtract / toggle`; runtime-only effects remain in the export report.
- Conditional routing = guarded links or `<<goto "target">>` transitions.

Validation target: Tweego/Twine import plus the existing fixture reference parser, which checks `StoryData`, passage targets, macro balance, the bribe branch, and key effects.

## Report Rules

Every export should include or surface:

- Variable name mappings.
- Node slug mappings.
- Complex variables that are only preserved in Runtime JSON.
- Effects that are runtime-only for a target format.
- Playbook actions that were not translated.
- Expressions outside the supported JavaScript condition subset.
- Missing targets or links that cannot be resolved.

The report is part of portability. A target export with warnings can still be valid, but the warnings must explain what the receiving tool needs to implement or ignore.

## Validation Ladder

1. **Fixture check**: export buttons exist and generated files contain expected runtime content.
2. **Schema check**: Runtime JSON validates against `runtime-json.schema.json`.
3. **Format parser check**: Yarn, ink, and Twee parse with their target ecosystem or a reference parser.
4. **Consumer check**: optional samples load in Unity, Godot, Unreal, Twine, or a custom loader.

The consumer check is useful, but it must not override the portable contract.

Local acceptance:

```bash
node scripts/portable-export-acceptance.cjs
```

The script exports `tests/fixtures/state-runtime-key-play.ncanvas`, runs `ysc compile`, `inklecate -j`, `inklecate -p`, and `tweego`, then walks the same bribe branch through a minimal Runtime JSON loader.

## References

- Yarn Spinner documentation: https://docs.yarnspinner.dev/
- ink language documentation: https://github.com/inkle/ink/blob/master/Documentation/WritingWithInk.md
- Tweego / Twee 3 documentation: https://www.motoslave.net/tweego/docs/#twee3-language
