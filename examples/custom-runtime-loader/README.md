# Custom Runtime Loader Example

This example shows the smallest practical consumer for a Narrative Canvas Runtime JSON export. It is useful as a reference for build scripts, prototypes, and engine-side loaders that want to drive the exported graph directly.

Run it from the Narrative Canvas project root after generating a Runtime JSON file. This example writes generated files to `/tmp` so the source tree stays clean:

```powershell
node scripts/portable-export-acceptance.cjs `
  --output-dir /tmp/narrative-canvas-runtime `
  --clean-output `
  --keep-output

node examples/custom-runtime-loader/runtime-json-runner.cjs `
  --runtime /tmp/narrative-canvas-runtime/state-runtime-key-play-runtime.json `
  --routes tests/fixtures/state-runtime-key-play.routes.json
```

The runner reads `routes.json`, walks each route through the Runtime JSON graph, and checks:

- selected choice labels
- minimum visit count
- expected visited node ids, slugs, or titles
- expected output text
- expected final state values

The route file uses the same schema as portable acceptance:

```json
{
  "format": "narrative-canvas-route-cases",
  "version": 1,
  "cases": [
    {
      "name": "example-route",
      "choiceLabels": ["First choice", "Second choice"],
      "minVisits": 3,
      "expectNode": ["Resolution"],
      "expectText": ["Route complete"],
      "expectState": [{ "key": "route", "value": "complete" }]
    }
  ]
}
```

Scope:

- Runtime JSON v1 only
- `set`, `add`, `subtract`, `toggle`, `append`, `remove`, and `clear` effects
- bare keys, comparisons, boolean joins, grouped expressions, negation, `has(...)`, and `contains(...)`
- flat-first dotted state lookup for conditions and templates

For a production integration, keep `report.warnings` visible in build output and decide which warning codes should block import for your target runtime.
