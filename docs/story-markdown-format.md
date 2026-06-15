# Story Markdown Format

Story Markdown is the first text-source experiment for Narrative Canvas. It is designed for readable review and simple round-trips between a canvas project and a plain Markdown script.

Current scope:

- Export: `.ncanvas -> <slug>-story.md`
- Import: `story.md -> .ncanvas` through the explicit `Import MD` button
- Layout sidecar: `<slug>-layout.json` through `Layout JSON` or `Export all`
- State schema sidecar: `<slug>-state.schema.json` through `State Schema` or `Export all`
- Export profile sidecar: `<slug>-export.profile.json` through `Export Profile` or `Export all`
- Sync model: replacing import/export only; no file watch and no automatic merge
- Layout: import rebuilds a simple grid layout instead of preserving canvas geometry

## Document Shape

```markdown
# Project title

<!-- narrative-canvas-story-md: v1 -->

## Start
<!-- id: n0 -->
type: Entry
slug: Start

Opening body text.

next:
- goto: Bribe_check

## Bribe check
<!-- id: n1 -->
type: Choice
slug: Bribe_check

Choice body text.

choices:
- Slip two coins to the Brakeman
  id: opt_bribe
  requires: guard_suspicion >= 1 && inventory_coins >= 2
  effect: onChoose subtract inventory_coins 2
  goto: Bribe_accepted
```

## Nodes

Each level-2 heading creates one node:

```markdown
## Node title
```

Supported node metadata directly under the heading:

- `<!-- id: n1 -->` preserves a stable node id.
- `type: Choice` sets the node type. If omitted, import infers `Entry` for the first node, `Choice` for nodes with choices, `Condition` for nodes with branches, and `Content` otherwise.
- `slug: Bribe_check` adds an alternate reference name for `goto`.
- `requires: expression` sets node requirements.

Body text is any plain text between metadata and a section such as `choices:`, `effects:`, `branches:`, or `next:`.

## Choices

Choice sections use list items. Nested lines configure the active choice:

```markdown
choices:
- Choice label
  id: opt_id
  requires: flag_ready && flag_tokens.includes("boarding")
  effect: onChoose subtract inventory_coins 2
  goto: Target_slug
```

Short-form authoring is also accepted:

```markdown
-> Choice label
requires: flag_ready
set: flag_done true
goto: Target_slug
```

Import turns choices into `choices`, `choiceOptions`, and choice links.

## Effects

Effects use this form:

```markdown
effect: onChoose subtract inventory_coins 2
```

The parser also accepts operation shortcuts inside a choice:

```markdown
set: flag_done true
add: inventory_coins 1
subtract: inventory_coins 2
toggle: flag_seen
```

Node-level effects use an `effects:` section:

```markdown
effects:
- onVisit set flag_seen true
```

## Routing

Linear routing:

```markdown
next:
- goto: Target_slug
- goto: Other_slug if flag_ready
```

Condition branches:

```markdown
branches:
- if flag_ready: Ready_node
- else: Blocked_node
```

Targets may reference a node id, heading title, or `slug:`. Missing non-`END` targets create placeholder Content nodes so route intent is not lost.

## Portable Condition Subset

Story Markdown should stay inside the same condition subset used by portable exports:

- Bare keys
- Comparisons: `===`, `!==`, `>=`, `<=`, `>`, `<`
- Boolean joins: `&&`, `||`
- Grouping: `A && (B || C)`
- Negation: `!(...)` and `!key`
- Membership: `flag_tokens.includes("boarding")`
- Flat-first object paths: `inventory.coins`

Legacy `==`, `!=`, `not ...`, `has(key, value)`, and `contains(key, value)` still import for older files. Avoid arbitrary functions, object-path writes, and target-engine-specific macros in Story Markdown if it needs to round-trip.

## Layout Sidecar

`Layout JSON` exports canvas-only data keyed by node and link ids:

```json
{
  "format": "narrative-canvas-story-layout",
  "version": 1,
  "nodes": [
    {
      "id": "n1",
      "title": "Bribe check",
      "type": "Choice",
      "x": 330,
      "y": 80,
      "frameId": "act_1"
    }
  ],
  "links": [
    {
      "id": "l1",
      "from": "n1",
      "to": "n2",
      "choiceOptionId": "opt_bribe"
    }
  ]
}
```

This sidecar is applied through the explicit `Import Layout` button. Its contract is intentionally simple: ids in `story.md` are the stable join keys, while the sidecar owns canvas positions, dimensions, frames, port positions, collapsed state, and link identity. Import restores layout for matching nodes and links, and may recreate missing frame nodes because frames are canvas organization data. It does not create or delete story nodes.

Schema: [`story-layout.schema.json`](story-layout.schema.json)

## State Schema Sidecar

`State Schema` exports Validation-derived state data for text-source workflows:

```json
{
  "format": "narrative-canvas-state-schema",
  "version": 1,
  "variables": [
    {
      "key": "inventory_coins",
      "exportKey": "inventory_coins",
      "type": "number",
      "hasInitial": true,
      "initialValue": 3,
      "statuses": ["ok"],
      "readBy": [{ "label": "Bribe check choice \"Slip two coins to the Brakeman\"", "nodeId": "n1" }],
      "writtenBy": [{ "label": "Bribe check choice effect 1", "nodeId": "n1" }],
      "interpolatedBy": [{ "label": "Start body", "nodeId": "n0" }]
    }
  ],
  "exportBlocks": []
}
```

The file records initial values, inferred types, Validation statuses, read/write/template references, invalid expressions, and export warning blocks. `key` is the source project key; `exportKey` is the safe variable name used by Story Markdown and portable text exports. Use `Import State` after `Import MD` when a plain-text story file needs its initial state restored from the sidecar.

Schema: [`state-schema.schema.json`](state-schema.schema.json)

## Export Profile Sidecar

`Export Profile` records the handoff manifest for a Story Markdown export set. It lists the portable files, target consumers, schema pointers, node and variable export mappings, and export warnings.

Schema: [`export-profile.schema.json`](export-profile.schema.json)

Real story source acceptance: [`story-source-acceptance.md`](story-source-acceptance.md)

## Import Safety

`Import MD` is an explicit replacing import:

- It always asks for confirmation before opening the file picker.
- It does not watch `story.md` for changes.
- It does not merge concurrent edits from an open canvas project.
- It rebuilds links and choice options from Markdown route declarations.
- Use `Import Layout` with the Layout JSON sidecar to restore positions, frames, ports, collapsed state, and matching link metadata.
- It starts with empty project variables; use `Import State` with the State Schema sidecar to restore initial values after import.
- It preserves known node ids from `<!-- id: ... -->`; missing ids are generated.

## Not Preserved By Story Markdown Alone

The importer intentionally does not preserve:

- Canvas positions from the original project
- Port positions
- Frames
- Event sheet metadata
- Characters and cast entries
- Custom node type schemas
- Inspector-only fields that are not represented in the Markdown body or metadata

Use Runtime JSON or the full `.ncanvas` project file when those fields must be preserved.
