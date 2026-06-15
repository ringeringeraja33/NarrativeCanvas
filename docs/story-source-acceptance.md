# Story Source Acceptance

Use this check when you have a real `story.md` source and want to prove that the text-source workflow can import, restore sidecars, export portable targets, and run named routes.

```bash
node scripts/portable-export-acceptance.cjs --story path/to/story.md
```

To run the built-in regression fixture:

```bash
node scripts/portable-export-acceptance.cjs --story-fixture
```

This uses `tests/fixtures/story-source-acceptance.story.md` plus `tests/fixtures/story-source-acceptance.layout.json` and `tests/fixtures/story-source-acceptance.state.schema.json`, follows `Board the train` -> `Take left door`, and expects `route=left`.
The fixture currently emits two expected `node-name-sanitized` warnings because node titles with spaces are exported as portable slugs.

Optional sidecars can be applied before export:

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --layout path/to/story-layout.json \
  --state path/to/state.schema.json
```

If the sidecars live beside the story source, the script can discover them:

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --auto-sidecars
```

`--auto-sidecars` checks names such as `story-layout.json`, `story.layout.json`, `story-state.schema.json`, `story.state.schema.json`, `story-routes.json`, and `story.routes.json`, plus shared `layout.json`, `state.schema.json`, and `routes.json` files in the same folder. Explicit `--layout`, `--state`, and `--route-cases` paths take priority.

The script opens the app in headless Chrome, imports the Story Markdown file, optionally applies Layout JSON and State Schema sidecars, then exports:

- `<slug>-story.md`
- `<slug>-layout.json`
- `<slug>-state.schema.json`
- `<slug>-export.profile.json`
- `<slug>-runtime.json`
- `<slug>.yarn`
- `<slug>.ink`
- `<slug>.twee`

It validates the JSON sidecars against their schemas, verifies that any provided Layout JSON sidecar is re-exported with the same key node/link layout fields and view scale, runs a default path through Runtime JSON, the minimal Yarn runner, `inklecate -p`, and the minimal Twee / SugarCube runner, then compiles Twee with the external tools used by the portable export acceptance check. This is an automated readiness check, not a replacement for reviewing the actual story route and consumer behavior by hand.

Route assertions can make the check prove a specific path:

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --choice-label "Board the train" \
  --choice-label "Take left door" \
  --min-visits 3 \
  --expect-node Aboard \
  --expect-text "The carriage door shuts" \
  --expect-state route=left
```

- `--choice-label` selects a choice by label or Runtime JSON choice id instead of always taking the first available choice. Repeat it to drive multiple choice nodes in order.
- `--min-visits` requires Runtime JSON, Yarn, and Twee to visit at least that many nodes or passages.
- `--expect-node` can be repeated and must match a Runtime JSON id / slug / title, a Yarn node title, or a Twee passage name.
- `--expect-text` can be repeated and must appear in Runtime JSON, Yarn, Ink CLI, and Twee output.
- `--expect-state key=value` can be repeated and checks the final Runtime JSON, Yarn, and Twee state. Values are parsed as JSON arrays/objects, booleans, numbers, `null`, or strings.
- `--route-cases path/to/routes.json` runs multiple named route cases from one exported story. Use this when a real story needs more than one branch proven before release.
- `--min-route-cases count` requires at least that many route cases. Use it with `--decision-gate` when the package needs a fixed amount of branch coverage.
- `--require-layout` fails unless a Layout JSON sidecar is provided by `--layout` or discovered by `--auto-sidecars`, then checks that the exported layout preserves the input layout's node positions, optional node sizes, link metadata, and view scale.
- `--max-warnings count` fails the check when the exported `Export Profile` contains more warnings than allowed. Use `--max-warnings 0` when a real story must ship without portability warnings.
- `--allow-warning-code code` excludes reviewed warning codes from the `--max-warnings` count. Repeat it when a story has known acceptable warnings such as slug sanitization.

Route case files use this shape and are validated against [`portable-route-cases.schema.json`](portable-route-cases.schema.json):

```json
{
  "format": "narrative-canvas-route-cases",
  "version": 1,
  "cases": [
    {
      "name": "left-door",
      "choiceLabels": ["Board the train", "Take left door"],
      "minVisits": 4,
      "expectNode": ["Aboard"],
      "expectText": ["Route: left"],
      "expectState": [
        { "key": "route", "value": "left" }
      ]
    }
  ]
}
```

To draft a route case file from the exported Runtime JSON, use:

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --auto-sidecars \
  --write-route-template path/to/story.routes.json
```

The generated file is meant to be reviewed. It follows reachable choices up to a bounded number of terminal routes, then fills in `choiceLabels`, `minVisits`, final node expectations, last visible text, and final state.

If a story uses variables in conditions, templates, or effects, pass a State Schema sidecar with `--state`. Portable targets such as ink need declared initial values; the check should fail if a story relies on undeclared state.
Use `--require-state` when the acceptance package must include that sidecar. It accepts either an explicit `--state` path or a matching state sidecar found by `--auto-sidecars`.

Use `--require-layout` when the acceptance package must prove the `md -> canvas layout -> export` path. It accepts either an explicit `--layout` path or a matching layout sidecar found by `--auto-sidecars`.

Use `--keep-output` to keep the exported files for inspection:

```bash
node scripts/portable-export-acceptance.cjs --story path/to/story.md --keep-output
```

Use `--output-dir path/to/acceptance-output` when the exported artifacts need a fixed review folder instead of a temporary directory. The directory must be empty so old files cannot hide a missing export; pass `--clean-output` only when you intentionally want to remove its existing contents before the run.

Use `--decision-gate` for a release-grade story-source acceptance package. It rejects `--story-fixture`, the built-in fixture path, and any copy with the same Story Markdown contents, then requires a real `--story`, a Layout JSON sidecar, route cases, `--output-dir`, `--summary`, `--report`, and an explicit `--max-warnings` threshold. Each route case must include at least one `expectNode`, `expectText`, or `expectState` assertion. Add `--min-route-cases count` when the package needs a specific minimum number of named routes. `--require-layout` can still be passed for readability, but `--decision-gate` already treats canvas arrangement as mandatory. Add `--require-state` when state declarations are mandatory for the review.

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --auto-sidecars \
  --decision-gate \
  --require-layout \
  --require-state \
  --max-warnings 0 \
  --output-dir path/to/acceptance-output \
  --summary path/to/acceptance-output/acceptance-summary.json \
  --report path/to/acceptance-output/acceptance-report.md
```

Use `acceptance/project-story-template/` as the starting structure for a real project package. Replace its story, sidecars, and route cases before running `--decision-gate`.

Use `--summary path/to/acceptance-summary.json` to write a machine-readable record of the source inputs, exported files, route assertions, consumer checks, export warnings, Runtime JSON route, Yarn route, Ink CLI route, Twee route, and SHA-256 file evidence for inputs and exported artifacts:

```bash
node scripts/portable-export-acceptance.cjs \
  --story path/to/story.md \
  --auto-sidecars \
  --allow-warning-code node-name-sanitized \
  --max-warnings 0 \
  --summary path/to/acceptance-summary.json
```

The summary is validated against [`portable-acceptance-summary.schema.json`](portable-acceptance-summary.schema.json) before it is written.

Use `--report path/to/acceptance-report.md` to write a Markdown report for human review. It summarizes source inputs, file evidence, consumers, warnings, route cases, Ink choices, Twee visits, final state, and exported files.

Use `--timeout 90000` or higher when a real story route needs more time in headless Chrome. The timeout also increases Chrome's virtual-time budget for the export runner.
