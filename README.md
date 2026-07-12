# Narrative Canvas

Changelog and release notes: [GitHub Releases](https://github.com/ringeringeraja33/NarrativeCanvas/releases)

[中文版本](README-zh.md)

<video src="https://github.com/ringeringeraja33/NarrativeCanvas/raw/main/assets/videos/runtime.mp4" controls width="800" muted></video>

Narrative Canvas is a node-based workspace for building complex interactive narratives. It unifies beats, dialogue, branching choices, conditions, variable updates, routing, cast and notes into a single connected structure that can be previewed and edited directly.

It is intended for structure planning, branch validation, pitch preparation, and narrative explanation. Keep prose drafting, text polishing, and dialogue writing in your preferred writing tool.

The interface supports both English and Chinese. The web app has an `EN / 中文` floating language switch in the lower-right corner, and the Obsidian plugin has a `Language` setting that can follow Obsidian’s language.

![Narrative Canvas main canvas](main-canvas.png)

## Safety Notes

- The plugin runtime makes no network requests, sends no telemetry, and requires no account or payment. Project data stays in vault `.ncanvas` files and the plugin's local settings data.
- `Playbook.json` is declarative. It defines `Play` titles, body text, choice options, condition syntax, and variable writes, and does not execute arbitrary JavaScript.
- `Hide` only hides Events Sheet columns; it does not delete data. `Delete` removes a schema field and also clears matching values from frame nodes in the Events Sheet.
- Deleted nodes are moved to an archive outside the runtime path for recovery safety, but you should still version important projects.
- `Save`: saves the current project. In the web app, it writes to browser `localStorage`. In Obsidian, it writes the active `.ncanvas` file in your vault.
- `New`: creates a fresh project. In the web app, this uses browser storage. In Obsidian, it creates a `.ncanvas` file according to plugin settings.
- `Open`: in the web app, imports a project file from disk; in Obsidian, opens a project file from the vault.
- `Reload`: discards unsaved changes and reloads the last saved source. In the web app, this reads browser storage; in Obsidian, it rereads the active `.ncanvas` file.
- `Clear storage`: web app only. Removes the browser-stored project and opens an empty project.

### Web App

Open `index.html` directly, or visit:

<https://ringeringeraja33.github.io/NarrativeCanvas/>

When the Project File control shows `Browser storage`, the web app reads and writes `localStorage` (not browser HTTP cache). If you clear browser cache, the saved project file may still remain. Use `Clear storage` if you want a full local reset.

The lower-right floating `EN / 中文` button switches language. The web app stores your last choice in `localStorage`; on first load it auto-selects based on document and browser locale.

### Obsidian Plugin

For manual installation, copy the latest released plugin files into:

```text
.obsidian/plugins/narrative-canvas/
```

Then reload Obsidian and enable `Narrative Canvas` under Community plugins.

Plugin settings:

- `Language` options: `Follow Obsidian`, `中文`, and `English`.
- `Sample project` opens the bundled sample project.
- `Project save folder` and `New project file name` control where new `.ncanvas` files are created.
- `Auto-save interval` (seconds) sets how often Narrative Canvas writes the active project file. Empty means Obsidian’s own autosave behavior applies.
- `Current project` shows the path that the ribbon button will open next, with a clear action.

### Main Workflow

1. Open or create a `.ncanvas` project.
2. Add nodes from the Node Library.
3. Connect one node’s output port to another node’s input port.
4. Use frames to group nodes. Frames are shown in Events Sheet by default; frame-only types can be hidden there via node type settings.
5. Select a node and edit it in the Inspector.
6. Use `Story` to inspect the reachable graph from `Entry`.
7. Click `Play` to preview the current narrative path.
8. Save or export when structure is ready. PNG export presets are `4096 x 4096`, `6144 x 6144`, `8192 x 8192`, and `12000 x 12000`, and filenames include the final rendered size. Very large canvases are auto-scaled to stay within browser raster limits.

### Default Node Types

- The current default node types are: **Entry**, **Content**, **Dialog**, **Choice**, **Condition**, **Set**, **Marker**, **Event**, **Story Sequence**, **Clue**, **Interview Note**, **Location Frame**, **Conversation Frame**, **Investigation Event**, **Archive Note**, and **Draft Frame**.
- **Condition** and **Set** are kept as compatibility types and are hidden by default for migration support.
- **Archive Note** and **Draft Frame** are hidden by default; other advanced defaults are visible.

Default node types are editable templates. `Entry` is a system type and cannot be deleted. Other types can be renamed, hidden, restored, recolored, and extended with custom fields. `Set` and `Condition` are retained for legacy compatibility and are not recommended for new workflows.

### Canvas Operations

- Drag a node by its header to move it.
- Drag a frame by its header to move all nodes inside it.
- Use Shift/Cmd/Ctrl + click or rectangle select for multi-select, then drag a selected header to move the group.
- Click an output port then an input port to create a link.
- Double-click empty canvas space to cancel a pending connection.
- Right-click an existing link to reconnect or delete it.
- `Canvas` and `Story` can both collapse frames, with shared collapse state. When collapsed in Canvas, links to child nodes are routed through frame ports temporarily; underlying links are not rewritten.
- `Frame` and `Event Frame` are rendered below normal nodes by default. New frames are inserted above existing frame layers; frame depth can be adjusted via the node context menu.
- Choice and Dialog cards keep long option or turn lists inside a vertically scrollable preview, so node size and canvas layout stay unchanged. In the Node inspector, `Add turn` appears after the turn list.
- Every node has two ports: an **input port** (`input`) that receives links, and an **output port** (`output`) that starts links. Flow is always output → input, and input-to-output clicks are ignored. A `Focus` action selects and centers that node at 100% zoom.
- Ports can be repositioned by dragging along a node boundary. Port positions are saved on the node and persist across sessions.

### Story

`Story` shows the reachable structure from `Entry`. Non-frame nodes appear only if reachable from `Entry`. Frame nodes appear when the frame itself is reachable, or when it contains reachable descendants.

Story membership is stored explicitly as `frameId` on each node. On opening older projects, membership is initially inferred from canvas geometry: ungrouped nodes are assigned to the smallest frame containing their center. After that, moving nodes, Story rows, or frames updates explicit membership instead of recomputing overlap continuously.

Story updates read from current canvas links and frame membership, then write back to the canvas. Dragging a Story row into a frame assigns its node to that frame and writes `frameId`. If the dragged row is a frame, descendants move together. The target frame may expand to include incoming nodes. Dragging a row to root level clears `frameId` and removes it from frames.

Frame collapse state is shared between Story and Canvas. Collapsing a frame hides descendants in both views; expanding restores child rows and node-to-node link rendering.

Manual Story order is stored in `storyOrder`. `Re-sort by graph` clears manual ordering and restores graph-based order.

`Focus` in Story selects the node, opens the Node Inspector, centers it on canvas, and zooms to 100%.

### Events Sheet

![Events Sheet](events-sheet.png)

`Frame` nodes appear in Events Sheet by default. Different frame types are placed in separate tables. Frame types used only for canvas grouping can enable `Hide frame rows from Events Sheet` in the node type editor.

You can rename, hide, or delete columns. Hidden columns are collected in each table’s rightmost `Hidden` column for recovery. Deleting schema fields removes them from frame-type definitions and clears matching values from existing frame nodes.

`Re-sort by graph` clears manual row order and sorts rows by current canvas graph position.

### Characters

![Characters page](characters.png)

`Characters` can be linked to nodes using Cast chips:

- `POV`
- `Speaker`
- `Present`
- `Mentioned`
- `Target`
- `Owner`

You can also create references in node text with `@Character Name`. Character pages show backlinks in story order, including speaker scenes, present scenes, mentions, ownership, and frame scenes.

Use Character focus to highlight related nodes.

### Document

![Document editor in Twee mode](document.png)

`Document.md` is a full-page, VSCode-style editor for the project's runtime narrative. A slim tab strip shows the file name, a `Plain text` / `Ink` / `Yarn` / `Twee` format switch, and the live sync status; below it an edge-to-edge monospace editor with a synced line-number gutter fills the whole pane. `Tab` and `Shift+Tab` indent and outdent, and lines do not soft-wrap, so scripts read the same as in a code editor.

Edit existing narrative content directly and changes sync back to the project: project title and notes, node titles and bodies, variables, existing choices, conditions, effects, and routes are compared field by field before they are merged. Canvas layout and metadata the format cannot express stay unchanged. Add or delete nodes, choices, and routes on the canvas or in the inspector; stable node IDs and body-boundary markers keep incomplete source edits from changing structure. Switching formats re-renders the same project as Plain text (Story Markdown), Ink, Yarn, or Twee 3 / SugarCube.

### Playbook

![Playbook settings](playbook.png)

Think of `Playbook.json` in this way:

**`Node Library` defines the fields each node type has. `Node Inspector` fills those fields. `Playbook` defines how Play preview reads and uses them.**

Use Playbook to configure Play runtime state and rules. Keep manuscript writing in your writing tool and runtime logic in your engine project.

Playbook has six tabs:

- **Variable Definitions** lists project variables with types and current values. New variables auto-focus.
- **Variable Actions** edits state changes outside node rows, including timing, target, key, operation, and value. The value control is constrained by variable type.
- **Script Builder** batch-edits non-frame node `Requirements`, `effects`, and `Routing`. It uses the same State Logic data as Inspector and provides structured row entry for common patterns.
- **Choice Conditions** batch-edits choice availability rules and displays each option’s `on-choose Effects`. It shares option data with Inspector and keeps legacy condition rows for migration consistency.
- **Play rules** controls preview behavior only: Start Node, End Condition, and Debug Mode. Visit Tracking is under Debug Mode, and its visit list is discarded when Play preview ends.
- **Validation** checks state reads/writes, text interpolation, and export risks. Each entry points to where a key is read, written, or interpolated, with links back to canvas or Advanced JSON.

Runtime state keys are flat names by default. For values shared across requirements, effects, text templates, and portable exports, prefer underscore keys like `inventory_coins`, `flag_watch_missing`, and `clue_glass_key`. Dot keys from older projects are still loadable: resolution checks flat keys first, then falls back to object paths like `inventory.coins`. Portable text exports flatten object paths and include key mappings in the export report.

Condition fields use a safe JavaScript expression subset: comparisons, `&&`, `||`, `!`, parentheses, quoted strings, numbers, booleans, dotted state paths, and `.includes(...)`. Arbitrary JavaScript is not executed. Expressions outside this subset stay in Runtime JSON with an export warning; Yarn, Ink, and Twee receive a parseable `false` guard for that branch.

Projects saved in older versions continue to load through normalization: legacy `choices[]`, `choiceIndex` links, missing `actions`, old custom node types, Events Sheet columns, Frame / Jump data, legacy `ports`, and dotted state keys are preserved or migrated. Legacy `choices[]` receive stable IDs (`opt_1`, `opt_2`, ...), so older branches keep order and sidecar output remains aligned after save.

### Portable Exports (Beta)

The top toolbar supports these export types:

- **Text Source Mode**: after `Import MD`, this mode flag is written automatically. Project file control remains unified across project JSON, Story MD, sidecars, and engine exports.
- **Runtime JSON**: a stripped runtime IR for external tools or custom loaders. It removes canvas layout fields while keeping nodes, links, state variables, cast, conditions, effects, play rules, and report output.
- **Story MD**: exports a readable `story.md` draft of the runtime graph including node IDs (in comments), body, conditions, choices, effects, and `goto` targets. It is used for review and text-first exploration. **Import MD** reads this format back into a canvas project and intentionally replaces the current project via explicit action.
- **Layout JSON** exports a schema-sidecar keyed by node/link IDs for canvas-only layout data. **Import Layout** restores positions, frames, ports, collapsed states, and link metadata after Story MD import.
- **State Schema**: exports `<slug>-state.schema.json` for Story MD workflows, including variables, portable `exportKey` names, initial values, read/write/template references, validation status, and export warning blocks. **Import State** restores variables from this sidecar after `Import MD`.
- **Export Profile**: exports `<slug>-export.profile.json`, listing portable files, target consumers, schema pointers, node/variable mapping, and export warning blocks for downstream handoff.
- **Yarn**: exports `.yarn` nodes, shortcut options, variable declarations, `<<jump>>`, and `<<set>>` commands.
- **Ink**: exports `.ink` knots, `VAR` declarations, sticky `+` choices, diverts, and `~` assignments.
- **Twee**: exports Twee 3 `.twee` passages for Twine / Tweego, including SugarCube `StoryData`, `StoryInit`, conditional links, `<<goto>>`, and `<<set>>`.

All exporters share one mapping of node slugs and variable names. Complex variables, Playbook actions, and effect operations that do not map cleanly to target formats are retained in Runtime JSON and exported as comments with warnings. After Story MD, Runtime JSON, Yarn, Ink, Twee, or Export All, an export report dialog appears with warnings and renamed variable mappings. Runtime JSON retains the full report for downstream tools.

### AI copilot (Beta)

![AI copilot](assets/screenshots/ai-copilot.png)

The **AI** button at the bottom-left of the canvas opens an experimental copilot. Discuss the story in your own language, then ask it to change the canvas — it replies with a proposal of operations (add / update nodes, add / remove links) that you **Apply to canvas** or **Reject**. Nothing changes until you apply. The current node selection is passed as context, and the panel is bilingual.

In the web app, open **Connection settings** and point it at any OpenAI-compatible endpoint (endpoint URL, API key, model); that config is stored only in your browser. In the Obsidian plugin, configure the same fields in plugin settings; the API key is stored in the plugin's local `data.json`, and requests use Obsidian's `requestUrl`. The bundled canvas code contains no browser `fetch` or `localStorage` branch. The feature is experimental and marked **Beta**.
