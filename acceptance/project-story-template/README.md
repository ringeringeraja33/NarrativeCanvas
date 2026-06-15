# Text-Source Acceptance Package Template

Copy this directory when a real project needs a fixed Story Markdown acceptance package. The template files document the expected shape; replace them with project content before using the package as release evidence.

Usage:

1. Copy this directory and rename it, for example `acceptance/my-project-story/`.
2. Replace `story.md` with the real Story Markdown source.
3. Update `layout.json` by node id, preserving positions, sizes, link metadata, and view scale.
4. Update `state.schema.json` with the variables used by the story and route assertions.
5. Update `routes.json` with at least two route cases. Each route case must include `choiceLabels`, `minVisits`, and at least one of `expectNode`, `expectText`, or `expectState`.
6. Run the acceptance command from the project root.

Command template:

```powershell
node scripts/portable-export-acceptance.cjs `
  --story acceptance/project-story-template/story.md `
  --auto-sidecars `
  --decision-gate `
  --require-layout `
  --require-state `
  --route-cases acceptance/project-story-template/routes.json `
  --min-route-cases 2 `
  --max-warnings 0 `
  --output-dir acceptance/project-story-template/output `
  --clean-output `
  --summary acceptance/project-story-template/output/acceptance-summary.json `
  --report acceptance/project-story-template/output/acceptance-report.md
```

Pass criteria:

- `status` is `pass`.
- `gate.decisionReady` is `true`.
- Runtime JSON, Yarn, Ink, and Twee consumers pass.
- `warnings.unreviewedCount` is `0`.
- Summary and report files are written to the fixed output directory.
- `fileEvidence` records SHA-256 hashes for inputs and exported artifacts.

After replacing the template content, update the command paths from `project-story-template` to the real package directory.
