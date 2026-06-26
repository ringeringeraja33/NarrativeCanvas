---
name: ncanvas-editor
description: "编辑 NarrativeCanvas 的 .ncanvas 叙事画布文件（Obsidian 插件 / 浏览器应用）。This skill should be used when creating, reading, updating, or deleting content inside a .ncanvas or .narrativecanvas file — including nodes, links, choices, dialog turns, variables, characters, playbook rules, the event sheet, and node types. Trigger whenever the user mentions ncanvas、NarrativeCanvas、叙事画布、剧情节点、分支故事、互动叙事，or asks to add/remove/modify canvas nodes or branches in an Obsidian .ncanvas file."
---

# ncanvas-editor — 操作 .ncanvas 叙事画布文件

本技能指导如何安全地对 NarrativeCanvas 的 `.ncanvas` 文件做**增删改**。

`.ncanvas` 是 [NarrativeCanvas](https://github.com/ringeringeraja33/NarrativeCanvas)（Obsidian 插件 + 浏览器应用）的项目文件，用于构建节点式分支叙事 / 互动剧情。它是**纯 JSON**，但有一套由应用代码（`main.js` 的归一化函数）强制、却没有独立 Schema 文件约束的隐式规则。

> **技能存在的理由**：这些规则不写在文件里，若凭直觉编辑，保存后会被插件"纠正"或导致内容丢失（最常见的坑：Choice 选项没双写、新节点没带 `frameId`、改了类型没清理专属字段）。下文把这些坑全部列出。

## 何时使用

需要在 `.ncanvas` / `.narrativecanvas` 文件里做以下任一操作时使用本技能：

- 新增 / 删除 / 修改**节点**（节点 = 故事里的一格：Entry 入口、Content 正文、Dialog 对话、Choice 选择、各种 Frame…）
- 新增 / 删除 / 修改**连线**（节点间的分支流向，含 Choice 每个选项的分支）
- 编辑**变量、选项效果、条件表达式、剧本规则（Playbook）、事件表、角色、自定义节点类型**
- 把一段剧情翻译成画布结构，或反过来读懂一个画布

---

## 文件格式速览

整个文件是一个 JSON 对象，顶层四个键：

```jsonc
{
  "version": 1,                          // 恒为 1（SAVED_STATE_VERSION），勿改
  "savedAt": "2026-06-17T08:30:12.405Z", // ISO 时间戳，每次写回应刷新
  "project": { /* ★ 真正的内容 ★ */ },
  "ui": { /* 编辑器界面状态：选中项、视图缩放、侧栏宽度… 一般勿动 */ }
}
```

`project` 是操作目标，`ui` 只影响编辑器视图——除非明确要求改视图，否则原样保留。

`project` 内部结构：

```jsonc
{
  "title": "项目标题",
  "notes": "项目备注",
  "workflowMode": "canvas",              // canvas / source / … 一般勿动
  "variables": { "变量名": <值> },       // 扁平运行时状态变量
  "script": {                            // Playbook 剧本配置
    "nodeTypes": {},
    "actions": [ /* 剧本动作 */ ],
    "playRules": { startNode, endCondition, visitTracking, debugMode }
  },
  "eventSheet": { "columns": [...], "hiddenColumns": [] }, // 事件表列定义
  "eventRowOrder": { "<frameType>": ["nodeId", ...] },
  "nodeTypes": [ /* 16 种系统类型 + 自定义类型定义 */ ],
  "customNodeTypes": [],                 // 历史遗留，迁移后恒为 []，勿写
  "characters": [ /* 角色 */ ],
  "deletedNodes": [ /* 已删除节点归档，供恢复 */ ],
  "nodes": [ /* ★ 所有节点 ★ */ ],
  "links": [ /* ★ 所有连线（边）★ */ ]
}
```

---

## 核心安全规则（务必遵守）

以下规则源自代码归一化函数，违反会导致内容丢失或被静默修改。理解"为什么"比死记更重要。

### 1. Choice 选项必须双写

Choice 节点有两份等价数据，归一化时 **`choiceOptions` 覆盖 `choices`**：

```jsonc
{
  "type": "Choice",
  "choiceOptions": [ { "id": "opt_1", "label": " bribing", "requires": "", "requiresMode": "all", "effects": [] } ],
  "choices": [ "bribing" ]   // ← 必须是上面所有 label 的纯字符串镜像
}
```

- 改选项时两处一起改，`choices[]` 的顺序与内容必须与 `choiceOptions[].label` 完全一致。
- 没有选项时写 `"choices": []`，**勿写 `choiceOptions: []`**（空数组会被归一化删除，留 `choices: []` 即可）。
- 选项 `id` 建议用稳定的 `opt_1`、`opt_2`…（按位置编号）；连线引用选项时用此 `id`。

### 2. 每个节点都要显式 `frameId`

- `frameId: ""` = 画布**根层级**（最常见）。
- `frameId: "<某 Frame 节点id>"` = 归属那个 Frame。
- **勿省略 `frameId`**：省略后插件按几何位置"推断"归属，可能把节点错误塞进相交的 Frame。新增节点一律显式写 `"frameId": ""`（除非明确要放进某 Frame）。

> **frameId 与几何位置的关系**：写文件时，**显式 `frameId` 是权威**——加载即按它归属。几何位置（节点坐标是否落在 Frame 矩形内）只在**用户实时拖拽**时触发"更新归属?"弹窗，不影响文件加载结果。因此写文件时：① 给 frameId；② 同时把子节点坐标放进 Frame 矩形内（视觉一致），二者不冲突。

### 3. 字段是类型驱动的，改 `type` 要清理

某些字段仅在特定类型节点有效，其它类型上会被删除。把节点改成新类型时，主动清理旧类型的专属字段：

| 字段 | 仅在 |
|---|---|
| `turns` | Dialog |
| `choiceRevealMode` / `choiceOptions` | Choice |
| `collapsed` / `layout` | Frame 类型（`kind:"frame"`，如 Event、StorySequence、LocationFrame…） |
| `condition` / `conditionMode` | Condition（或显式设了 condition 的节点） |

### 4. 空值字段会被删除，不必手动删

如 `stateLogic` 既无 `requirements` 又无 `effects` 时整个删除；`routing` 为 `{mode:"continue"}` 无 target 时也删除。写文件时可省略这些空字段，插件加载时自动补默认值，无需为"对齐"手动塞空对象。

### 5. 节点 id 稳定，删除要级联清理 links

- 节点 `id` 是稳定字符串（`n0`、`n1`…），连线 `links[].from`/`to` 引用它。
- **删除节点时同时删除所有 `from` 或 `to` 等于该 id 的连线**，否则留悬空连线。
- 新建节点 id 取**最小空闲值**（非 max+1）：从 `n0` 起找第一个未占用 id。连线 id 同理（`l0`、`l1`…），角色 id（`c0`…）。
- 被删节点可选移入 `deletedNodes`（供恢复），非必须——除非明确要保留可恢复归档。

### 6. Entry 不可删，Condition/Set 是 legacy

- `Entry` 是 `system: true` 系统类型，**不可删除**（项目至少要有一个入口节点）。
- `Condition`、`Set` 是 `legacy: true`（默认 hidden），不建议新建；现代写法用节点的 `stateLogic.requirements`/`effects` 代替。
- 勿从 `nodeTypes[]` 删除带 `system: true` 的系统类型定义。

### 7. 勿破坏 `ui` 段（除非要改视图）

`ui` 只是编辑器会话状态（选中、缩放、侧栏宽度）。改剧情内容时原样保留 `ui`。只有明确要求"把视图移到某节点""改主题"时才动它。

---

## 节点通用字段

通用字段（几乎所有节点）：`id`、`type`、`title`、`body`（支持 `{变量}`/`{nested.path}` 模板）、`x`/`y`（坐标）、`frameId`、`width`/`height`（可选）、`ports`、`customFields`、`cast`。

`ports` 结构：`{input:{side,t}, output:{side,t}}`，side ∈ top/right/bottom/left，t ∈ 0..1。普通节点默认 input=top、output=bottom；Frame 节点默认 input=left、output=right。

> **`layerOrder` 字段**：节点层叠顺序（数值越大越在上层），由插件自动管理（新增节点插顶层、右键菜单调层）。**写文件时通常可省略**——加载后自动补。Frame 渲染在普通节点下层是其类型固有行为，无需靠 layerOrder 实现。仅在要精确还原某画布的层叠时才显式写。

> **16 种系统节点类型的完整定义、类型专属字段、Frame/事件表细节**见 `references/node-fields.md`。SKILL.md 不重复列表，以避免信息冗余。

---

## 布局约定（坐标与尺寸）

`.ncanvas` 是 JSON，坐标和尺寸不会自动排版——写文件时要自己安排 `x/y/width/height`，否则节点会堆叠在一起。约定如下，便于得到清晰可读的画布：

**流向**
- **线性流程**（主线一路向下）：`y` 递增，每档约 **+180**（节点高约 120–160 + 间距）。`x` 保持一致。
- **分支展开**（Choice 之后）：转为 `x` 递增，每条分支一列，列距约 **+380**（节点宽 200 + 间距）。`y` 按各分支独立推进。
- **分区**（设定区 + 叙事区同板）：左半 `x` 较小（如 0–1100）放设定，右半 `x` 较大（如 1300+）放叙事，中间留空白分隔。

**Frame 容器尺寸**
- Frame 要在视觉上**包住**其子节点：`width` ≥ 子节点最右 x − Frame x + 节点宽 + 边距；`height` ≥ 子节点最下 y − Frame y + 节点高 + 边距。
- 经验值：装一排（2–3 个）子节点的设定 Frame，`width` 约 1000、`height` 约 300；多排则 `height` 按排数 × ~140 叠加。
- Frame 坐标放在子节点群的**左上角**（Frame.x < 子节点最小 x，Frame.y < 子节点最小 y，留 ~40 边距给标题栏）。

**间距与防重叠**
- 同列相邻节点 y 差 ≥ 180；同行相邻节点 x 差 ≥ 380（含宽度）。
- 不确定时宁可拉开，重叠会遮挡端口、难连线。

**起步参考**：单条主线从 `x:80, y:80` 起步；设定 Frame 从 `x:40, y:40` 起步。新建文件可直接用 `assets/blank-project.ncanvas` 当起点（已含合法骨架与一个 Entry）。

---

## 读取流程

1. 用 Read 工具读取整个 `.ncanvas` 文件。
2. 它是 JSON。定位：`project.nodes[]` 找节点，`project.links[]` 找连线，`project.characters[]` 找角色。
3. 节点按 `id` 互引用；连线 `from`→`to` 表示从源节点输出连到目标节点输入。

## 写入流程

1. **整体改 JSON 对象**（在内存里构造好完整新内容）。
2. **刷新时间戳**：把 `savedAt` 改成当前 ISO 时间（格式 `YYYY-MM-DDTHH:mm:ss.sssZ`）。
3. **序列化**：`JSON.stringify(data, null, 2)` —— **2 空格缩进**，与原文件一致。
4. **整体写回**：用 Write 工具把完整 JSON 写回原路径。**勿用字符串拼接做局部替换**，易破坏 JSON。
5. **保持 `ui` 段原样**。
6. **跑校验脚本**：`node scripts/validate_ncanvas.js <文件路径>`（脚本随技能附带）。通过后再交付。它会查 JSON 合法性、Choice 双写、悬空 link、choiceOptionId 引用、id 唯一、Entry 存在等。

> **新建文件**：复制 `assets/blank-project.ncanvas`（完整骨架：16 个 nodeTypes + 一个 Entry + 合法 ui + 默认事件表列），改 `project` 内容即可，**勿手写 nodeTypes**。

---

## 典型操作配方

下列片段可直接套用。`...` 代表省略的其它字段。

### A. 新增普通节点（Content）

```jsonc
{
  "id": "n3", "type": "Content", "title": "过关", "body": "成功。",
  "x": 600, "y": 80, "frameId": "", "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } }
}
```
`push` 进 `project.nodes`。

### B. 新增 Choice 节点（含选项，重点：双写）

```jsonc
{
  "id": "n4", "type": "Choice", "title": "贿赂检查", "body": "守卫盯着你。",
  "x": 330, "y": 80, "frameId": "", "choiceRevealMode": "hide",
  "choiceOptions": [
    { "id": "opt_1", "label": "塞两枚硬币", "requires": "inventory_coins >= 2", "requiresMode": "all",
      "effects": [ { "trigger": "onChoose", "op": "subtract", "key": "inventory_coins", "value": "2" } ] },
    { "id": "opt_2", "label": "继续走", "requires": "", "requiresMode": "all", "effects": [] }
  ],
  "choices": [ "塞两枚硬币", "继续走" ],   // ★ 必须与上面 label 镜像
  "customFields": {},
  "ports": { "input": { "side": "left", "t": 0.3 }, "output": { "side": "right", "t": 0.7 } }
}
```

### C. 新增连线

普通连线：`{ "id": "l1", "from": "n0", "to": "n4" }`

Choice 分支连线（带选项引用，**优先 `choiceOptionId`**）：
```jsonc
{ "id": "l2", "from": "n4", "to": "n5", "label": "塞两枚硬币",
  "choiceOptionId": "opt_1", "choiceIndex": 0 }   // 同时给 index 更稳
```

### D. 删除节点（级联清理）

删除节点 `n4`：① 从 `project.nodes` 移除 `id==="n4"`；② 从 `project.links` 移除所有 `from==="n4"` 或 `to==="n4"`；③（可选）把节点对象放进 `project.deletedNodes`。

### E. 修改节点类型（同步清理专属字段）

Dialog→Content：删 `turns`；Choice→Content：删 `choiceOptions`、`choiceRevealMode`，`choices` 置 `[]`。

### F. 终点节点（routing: end）

标记"到此不再往下"的终点（结局、章节末、死路）：
```jsonc
{ "id": "n_end", "type": "Content", "title": "结局",
  "body": "……", "x": 1200, "y": 400, "frameId": "",
  "routing": { "mode": "end", "target": "" },
  "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }
```
`routing.mode` ∈ `continue`(默认，顺下一条出边) / `end`(终点) / `goTo`(跳到 target 节点)。`continue` 无 target 时整个 routing 被归一化删除，可省略。

### G. 新增角色并关联节点

```jsonc
// project.characters 加角色
{ "id": "c0", "name": "Mara", "role": "Lead", "voice": "Precise", "notes": "", "hidden": false }
// 节点 cast 引用（role 见下）
"cast": [ { "characterId": "c0", "role": "Speaker" } ]
```
节点 cast `role` 枚举：`POV`/`Speaker`/`Present`/`Mentioned`/`Target`/`Owner`（非法值归 `Present`）。
> Character 的 `role` 字段是**自由文本**（如 "Lead"），与节点 cast 的 `role` 枚举是两回事。

### H. 编辑变量 / 剧本规则

变量（扁平字典，值可为 string/number/boolean/array/object）：
```jsonc
"variables": { "inventory_coins": 3, "flag_met_guard": true, "tokens": ["boarding","watch"] }
```
剧本规则 4 个开关（每个 `{enabled, value}`）：`startNode`(value=入口节点标题)、`endCondition`(value=结束条件表达式)、`visitTracking`(value=bool)、`debugMode`(value=bool)。
剧本动作 `actions[]` 与状态表达式语法见 `references/state-logic.md`。

### I. 新增自定义节点类型

往 `project.nodeTypes[]` 加定义（type 用 `Custom_` 前缀 slug，width 节点夹 160–420、frame 夹 160–860）。完整字段定义见 `references/node-fields.md`。

> 以上 A–I 是**原子配方**（单节点/单连线的结构写法）。若要做**多节点组合**（分支故事、多结局、状态面板、设定+叙事同板等），见下文路由索引中的领域配方。

---

## 写回前自检清单

Write 之前逐条核对：

- [ ] 整体仍是合法 JSON（2 空格缩进）。
- [ ] `version` 仍为 `1`；`savedAt` 已刷新为当前 ISO 时间。
- [ ] `ui` 段未被破坏（除非明确要改视图）。
- [ ] 所有 Choice 节点：`choices[]` 与 `choiceOptions[].label` 完全一致（顺序、文本）。
- [ ] 所有节点都有显式 `frameId`（新增的尤其）。
- [ ] 无悬空连线：每条 link 的 `from`/`to` 都指向现存节点 id。
- [ ] 改过类型的节点：已清理旧类型专属字段（turns/choiceOptions/collapsed…）。
- [ ] 新增节点/连线/角色 id 用最小空闲值，未与现有冲突。
- [ ] 未删除 `system:true` 的系统节点类型；Entry 节点仍存在。

---

## 何时读 references / 用脚本（渐进式披露，按需加载）

SKILL.md 只放**通用规则**（文件格式、安全坑、原子配方、布局约定）。以下内容按场景按需读取，**不要一股脑全读**：

### 通用参考（任何 ncanvas 编辑都可能需要）
- **`references/node-fields.md`** —— 需要某系统类型的完整字段定义、新建自定义类型、查 Frame/事件表列细节时。
- **`references/state-logic.md`** —— 要写条件表达式（`requirements`/`condition`/`requires`）、选项效果（`effects`）、剧本动作（`script.actions`）、gate 锁选项时。含完整语法和 `op`/`trigger`/`category` 枚举。
- **`references/samples.md`** —— 想看真实节点完整写法（Dialog 带 turns、Choice 带选项效果、Frame、Choice 分支连线）时，直接复制改造。

### 领域配方（按画板用途路由，仅相关时读）
- **`references/recipes-interactive-fiction.md`** —— **当画板用途是互动叙事 / 分支故事 / 游戏 / 视觉小说**（要做剧情流程、分支选择、多结局、状态面板、角色剧情线）时读。含开场链、条件解锁选项、选项效果、多结局、会合点、`{变量}` 面板、设定+叙事同板、角色 cast 等组合配方。纯结构化数据画板/设定集（无剧情流程）用不到。

### 工具与资产
- **`scripts/validate_ncanvas.js`** —— 写回后跑校验（见「写入流程」第 6 步）。用法 `node scripts/validate_ncanvas.js <文件> [--quiet]`。
- **`assets/blank-project.ncanvas`** —— 新建文件的完整骨架起点（16 个 nodeTypes + Entry + 合法 ui）。**勿手写 nodeTypes**，复制此文件改内容。
- **`assets/blank-node.json`** —— 单个最小新节点骨架，新增节点时可作起点。

> **路由判断**：先看用户要做什么。改单个节点/连线 → 直接用 SKILL.md 原子配方 + 必要时读 node-fields/state-logic；做一整段互动故事 → 先读 recipes-interactive-fiction；不确定字段 → 读 node-fields。
