# Narrative Canvas 1.1.1

Compared with GitHub release `1.1.0` published on 2026-06-06.

## English

### Added

- Improved the Playbook guide and Sample.ncanvas. Clicking `?` on Playbook now opens the contextual help manual.
- Added a Validation status page that shows risk details (including export output, issue source, and remediation hints) on hover and keyboard focus.
- Added Advanced JSON jump actions to Playbook rows so you can jump directly to the matching row/rule in JSON, and added buttons that map to the selected script-builder row and scroll to the corresponding JSON line after expansion.
- Export All now includes all currently supported outputs: Project JSON, Story MD, Layout JSON, State Schema, Export Profile, Runtime JSON, Yarn, Ink, Twee, Events CSV/JSON, Node Fields CSV, Characters MD/JSON, Playbook JSON, and image exports.

### Changed

- Significantly optimized the inspector UI.
- Reordered Playbook tabs to: Variable Definitions, Variable Actions, Script Builder, Choice Conditions, Play Rules, Validation.
- Variable Actions now only work with keys declared in Variable Definitions. The key selector shows variable type, and operators are filtered by type:
  - strings and objects: `set`
  - numbers: `set` / `add` / `subtract`
  - booleans: `set` / `toggle`
  - arrays: `set` / `append` / `remove`
- Variable Action input controls are now type-aware. Numbers use numeric input, booleans use true/false dropdowns, and arrays/objects use JSON-form value fields; mismatched values are normalized before save.
- New variable actions now only expose `onVisit` and `manual` timing; legacy global `onChoose` actions are still loaded for compatibility and execution, but are marked as compatibility rows with migration guidance toward per-option `Effects`.
- Boolean `set` now uses a true/false selector; `toggle` is shown as `Invert` / `Reverse`.
- Node inspector state logic is now split into separate Conditions and Effects blocks. Each block opens a one-time structured add row; after submit, the generated text is written back and the temporary control closes.
- Choice condition tables now show each option’s `Choice Effects` in the last column, while condition controls remain in the same row as condition status.
- Choice option `Choice Effects` is now synced in both directions between Inspector and Playbook: Inspector keeps editable free text, while Playbook stores structured operation/key/value rows.
- In narrow inspector widths, condition rows, effect rows, routing controls, and choice editing panels reflow to two columns first, then one column when very narrow, preventing clipping.
- Choice options now render `Choice Requirements` and `Choice Effects` as matching titled boxed sections.
- Play preview status text now uses a single muted base color by default when no explicit semantic color is provided.
- Condition status copy now reads as preview-flow guidance rather than command-style status text.
- Deleting the last Character or Variable now correctly enters empty-state UI and persists an empty character list or variable object.

### Compatibility

- Existing `.ncanvas` files remain readable. The loader normalizes old `choices[]`, `choiceIndex` links, missing `actions`, old custom node types, Events Sheet columns, Frame / Jump data, and dotted state keys.
- Story MD import intentionally replaces the current canvas project. Use Layout JSON and State Schema sidecars to restore layout, ports, frame membership, variables, and link metadata after import.
- Conditions use a safe JavaScript expression subset. Expressions outside that subset stay in Runtime JSON with an export warning; Yarn, Ink, and Twee emit a parseable `false` guard for the affected branch.

## 中文

### 新增

- Playbook 各行新增 JSON 按钮，可打开高级 JSON 并定位到对应行或规则。JSON 定位现在会等待展开后的编辑器完成测量，脚本构建行按钮可滚到选中的 JSON 行。
- 导出全部现在包含当前工具支持的所有导出内容：Project JSON、Story MD、Layout JSON、State Schema、Export Profile、Runtime JSON、Yarn、Ink、Twee、事件 CSV/JSON、Node Fields CSV、角色 MD/JSON、Playbook JSON 和当前图片导出。
- 设置校验状态页，可在悬浮或键盘聚焦时显示对应工作文件导出的具体风险、来源说明和处理建议。

### 调整

- 对检查器UI进行大幅优化。
- 完善了Playbook页面的说明手册（点击“?”图标可查看）和示例内容。
- Playbook 标签顺序改为：变量定义、变量动作、脚本构建、选项条件、演示规则、校验。
- 变量动作只能选择已在变量定义中声明的 key。键下拉框显示变量类型，操作下拉框按类型筛选：字符串和对象使用 `set`，数字使用 `set` / `add` / `subtract`，布尔使用 `set` / `toggle`，数组使用 `set` / `append` / `remove`。
- 变量动作的值控件现在按变量类型约束。数字使用数字输入，布尔值使用 true/false 下拉，数组和对象在 `set` 时使用 JSON 形态的值，不匹配的值在保存前规范化。
- 新建变量动作只提供 `onVisit` 与 `manual` 时机。旧版全局 `onChoose` 动作仍会读取和执行，但编辑器会标为兼容行，并提示新的选项选择变化写入选项自身的 `Effects`。
- 布尔变量动作的 `set` 使用 true/false 下拉；`toggle` 在界面显示为 `Invert` / `取反`，明确表示翻转当前值。
- 节点检查器的状态逻辑区现在分为条件和效果，两块编辑区旁各有添加按钮。添加条件和添加效果都会打开一次性结构化行；提交后生成的条件或效果写入对应文本编辑区，临时控件随即消失。
- 选项条件表格最后一列显示每个选项的 `选择时效果`，条件控件与条件状态保留在同一行。
- Choice 选项的 `选择时效果` 现在在检查器和 Playbook 之间实时同步：检查器保留可编辑文本区，Playbook 用结构化的操作 / 键 / 值行呈现同一批效果。
- 右侧检查器宽度较窄时，条件行、效果行、路由控件和选项编辑区会优先改为两列排列；极窄时再退回单列，避免输入框或编辑区溢出侧栏。
- 选项条件和脚本构建现在让选择条件编辑区与选择时效果编辑区等高，每一行的两个编辑区对齐。
- Choice 选项的“选择要求”改为带标题的方框区块，与“选择时效果”一致，使两个同级控件外观统一。
- 演示预览的状态文字使用统一的浅灰基础色，没有语义状态时不再继承到不一致的颜色。
- 条件状态文案改为 `演示流程可满足此条件 / 需在演示流程中达成此条件`，让 Playbook 校验更像演示流程提示，而不是当前状态命令。
- 删除最后一个角色或变量后，页面会立即刷新为空态，并正确保存空角色列表或空变量对象。

### 兼容性

- 旧 `.ncanvas` 文件仍可读取。加载时会规范化旧 `choices[]`、`choiceIndex` 连线、缺失的 `actions`、旧自定义节点类型、事件表列、Frame / Jump 数据和点号状态 key。
- Story MD 导入会显式替换当前 canvas 项目。导入后使用 Layout JSON 与 State Schema sidecar 恢复布局、端口、frame 归属、变量和连线元数据。
- 条件字段使用安全的 JavaScript 表达式子集。超出子集的表达式会保留在 Runtime JSON 并进入导出警告；Yarn、Ink 和 Twee 会给对应分支写出可解析的 `false` 条件保护。
