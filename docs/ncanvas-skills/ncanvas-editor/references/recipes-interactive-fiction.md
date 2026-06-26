# 互动故事配方（references/recipes-interactive-fiction.md）

> **路由触发**：当用户的画板用途是**互动叙事 / 分支故事 / 游戏 / 视觉小说**（要做剧情流程、分支选择、多结局、状态面板、角色剧情线）时读本文。本文是**领域配方**，不复述 SKILL.md 的通用文件格式规则。
> 纯结构化数据画板、知识图谱、设定集（无剧情流程）通常用不到本文。

本文把"做互动故事"的常见结构拆成可套用的**组合配方**，每个配方说明何时用、怎么布、完整 JSON 片段。坐标约定见 SKILL.md「布局约定」。

---

## 配方总览（按故事构件）

| 配方 | 何时用 |
|---|---|
| 1. 开场链 Entry → Content → Choice | 任何故事的开头骨架 |
| 2. 条件解锁选项（带 requires） | 选项随状态/物品解锁 |
| 3. 选项效果改状态（带 effects） | 选择改变变量（物品/属性/flag） |
| 4. 多结局节点（routing:end） | 故事终点 / 阶段性结局 |
| 5. 会合点（多分支汇到同一节点） | 不同选择殊途同归 |
| 6. 状态面板用 `{变量}` 模板呈现 | 模拟器式的 hp/饱腹度/分数显示 |
| 7. 设定区 + 叙事区并用 | 世界观与剧情同板呈现 |
| 8. 角色 cast 关联与 Dialog 自动反链 | 角色剧情线、对白归属 |

> 单个 Choice 节点 / 单条 link 的**原子写法**见 SKILL.md 配方区。本文是**多节点组合**。

---

## 1. 开场链（Entry → Content → Choice）

最常见骨架。Entry 点题开场 → Content 交代处境 → Choice 出第一个分叉。

```jsonc
// Entry（开场）
{ "id": "n0", "type": "Entry", "title": "Start",
  "body": "【开场】……（点题，可带 {变量} 显示初始面板）",
  "x": 80, "y": 80, "frameId": "", "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }

// Content（处境）
{ "id": "n1", "type": "Content", "title": "辨识处境",
  "body": "……（推进，可重复显示 {面板变量}）",
  "x": 80, "y": 260, "frameId": "", "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }

// Choice（第一个分叉，写法见 SKILL.md 配方 B）
{ "id": "n2", "type": "Choice", "title": "探索方向", "body": "……",
  "x": 80, "y": 440, "frameId": "", "choiceRevealMode": "hide",
  "choiceOptions": [ /* 见配方 2/3 */ ], "choices": [ /* 镜像 */ ],
  "customFields": {},
  "ports": { "input": { "side": "left", "t": 0.3 }, "output": { "side": "right", "t": 0.7 } } }

// 连线
{ "id": "l0", "from": "n0", "to": "n1" },
{ "id": "l1", "from": "n1", "to": "n2" }
```

布局：垂直流向（y 递增 180 左右一档），Choice 之后转水平（向右展开分支）。

---

## 2. 条件解锁选项（requires）

选项只在满足条件时可选/可见。`choiceRevealMode` 决定不满足时**隐藏**（`hide`）还是**置灰**（`disabled`）。

```jsonc
"choiceOptions": [
  { "id": "opt_1", "label": "用钥匙开门",
    "requires": "has_key === true", "requiresMode": "all",
    "effects": [] },
  { "id": "opt_2", "label": "踹门",
    "requires": "stamina >= 20", "requiresMode": "all",
    "effects": [ { "trigger": "onChoose", "op": "subtract", "key": "stamina", "value": "20" } ] },
  { "id": "opt_3", "label": "离开",
    "requires": "", "requiresMode": "all", "effects": [] }   // 空.requires = 永远可选（保底项）
]
```

要点：
- 每个故事 Choice **建议留一个空 requires 的保底选项**，避免玩家无路可走。
- 表达式语法见 `state-logic.md`（`=== >= && || .includes()` 等）。
- `requiresMode: "all"`（全部满足=and）/ `"any"`（任一=or）。

---

## 3. 选项效果改状态（effects）

选中后改变量。`trigger: "onChoose"` 是选项专属触发（节点级用 `"onVisit"`）。

```jsonc
{ "id": "opt_bribe", "label": "贿赂守卫（-2 金币）",
  "requires": "coins >= 2", "requiresMode": "all",
  "effects": [
    { "trigger": "onChoose", "op": "subtract", "key": "coins", "value": "2" },
    { "trigger": "onChoose", "op": "set", "key": "flag_bribed", "value": "true" }
  ] }
```

op 速记：`set` 赋值 / `add` `subtract` 数字加减 / `toggle` 布尔取反 / `append` `remove` 数组增删 / `clear` 删键。完整枚举见 `state-logic.md`。

> 注意 `value` 一律是**字符串**（数字也写成 `"2"`）。

---

## 4. 多结局节点（routing: end）

结局/终点节点用 `routing: { mode: "end" }` 标记，表示"到此不再往下"。

```jsonc
{ "id": "n_end_a", "type": "Content", "title": "结局A · ……",
  "body": "【结局】……（收束叙事，可显示终态变量 {coins} {hp}）",
  "x": 1200, "y": 400, "frameId": "",
  "routing": { "mode": "end", "target": "" },
  "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }
```

要点：
- 结局节点通常是 Content 类型，配 `routing.end`。
- 多结局时每个结局独立一个节点，分别连自不同 Choice 选项。
- 若想"全局结束条件"（如 hp<=0 任意时刻结束），改用 Playbook 的 `endCondition` 规则（见 `state-logic.md`）而非每个节点都写。

---

## 5. 会合点（多分支汇流）

不同选择殊途同归到同一节点。**多条 link 的 `to` 指向同一节点 id** 即可，无需特殊字段。

```jsonc
// 两个 Choice 选项都连到 n_hub
{ "id": "l5", "from": "n_choice", "to": "n_hub", "choiceOptionId": "opt_1", "choiceIndex": 0 },
{ "id": "l6", "from": "n_choice", "to": "n_hub", "choiceOptionId": "opt_2", "choiceIndex": 1 }
```

或来自不同 Choice 的分支汇到同一后续节点。会合点之后的故事对所有路径共用。

---

## 6. 状态面板用 `{变量}` 模板呈现

模拟器/数值游戏常需在每个节点"显示面板"。在 `body` 里用 `{变量名}` 插值：

```jsonc
// 变量定义（project.variables）
"variables": { "hp": 100, "satiation": 80, "coins": 5, "flag_met_boss": false }

// 节点 body 里显示
"body": "【面板】hp={hp}　饱腹度={satiation}　金币={coins}\n主角做了某事……"
```

要点：
- 数值类变量配 effects 增减，body 实时反映。
- 布尔/数组变量插值会显示 `true`/`false` 或数组的逗号串——如不美观，改用条件分支（不同节点）而非直接插值。
- 命名用扁平小写下划线（`inventory_coins`），让条件/效果/模板/导出共用一键。

---

## 7. 设定区 + 叙事区并用

世界观与剧情同板：用 Frame 容器把"设定"分组，与"叙事流程"分区摆放。

布局约定（见 SKILL.md「布局约定」）：
- **设定区**放左半（x 较小），用 Event/StorySequence 等 Frame 装设定条目节点（Content 写说明）。这些节点不接进叙事流程（无 link 或仅内部说明用）。
- **叙事区**放右半（x 较大），Entry 起的分支流程。
- Frame 要在尺寸上包住其设定子节点（子节点 frameId 指向该 Frame，且坐标落在 Frame 矩形内）。

设定节点示例（装在 Frame 内）：
```jsonc
{ "id": "s1", "type": "Content", "title": "丧尸 · 弱点",
  "body": "只能毁掉大脑或心脏击杀……",
  "x": 80, "y": 110, "frameId": "f1",   // ★ 指向所属设定 Frame
  "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }
```

---

## 8. 角色 cast 关联与 Dialog 自动反链

- 在 `project.characters` 定义角色；在节点 `cast[]` 用 `{characterId, role}` 关联。
- Dialog 的 `turns[].speaker` 文本若与某 Character.name 完全一致，Characters 页自动反链该场景。
- cast role 枚举：`POV`(视角) / `Speaker`(说话) / `Present`(在场) / `Mentioned`(提及) / `Target`(承受) / `Owner`(归属)。

```jsonc
// 角色
{ "id": "c0", "name": "林", "role": "幸存者·巡逻员", "voice": "警觉疲惫", "notes": "", "hidden": false }
// Dialog 节点：speaker="林" 会自动关联 c0
{ "id": "n_d1", "type": "Dialog", "title": "林 scene",
  "turns": [ { "speaker": "林", "line": "别动。" } ],
  "cast": [ { "characterId": "c0", "role": "Speaker" } ],
  "x": 400, "y": 300, "frameId": "", "choices": [], "customFields": {},
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } } }
```

---

## 设计经验（做互动故事时）

- **先骨架后细化**：先用 Content 把主线串起来（Entry → … → 结局），再在分叉点换成 Choice。
- **每个 Choice 留保底项**（空 requires 的选项），防死路。
- **状态用扁平变量**，body 用 `{var}` 显示面板；结局节点读 `{var}` 反映终态。
- **多结局靠独立节点 + routing.end**，不要靠"同一个节点 body 里 if-else 文本"（Play 试玩走不到）。
- **用 Story 视图检查可达性**：从 Entry 能到的才在试玩里出现，能发现死路/孤岛。
- **变量初始值**在 `project.variables` 设；试玩从这份初始值克隆。
- **写完跑校验脚本** `scripts/validate_ncanvas.js`（见 SKILL.md），确认 Choice 双写、无悬空 link。
