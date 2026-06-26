---
name: ncanvas-guide
description: "NarrativeCanvas 画板的使用向导：讲解 ncanvas 画板的功能概念、手动操作方法与最佳实践。This skill should be used when the user wants to understand how the ncanvas board works or how to operate it manually — e.g. asking what a node type / Choice / Playbook / event sheet / condition is for, how to connect nodes, how to playtest, or how to get started as a beginner. 触发关键词：怎么用 ncanvas、画板教程、Choice/Dialog/Playbook/事件表/变量/条件是什么、手动操作、连线、试玩、新手入门。注意：当用户要让 AI 直接增删改 .ncanvas 文件内容时，改用 ncanvas-editor 技能。"
---

# ncanvas-guide — NarrativeCanvas 画板使用向导

本技能是 **教学/引导型**：帮助理解 NarrativeCanvas（ncanvas）画板的功能、手动操作方法与设计思路。它不直接改文件——需要实际增删改 `.ncanvas` 内容时，转交 `ncanvas-editor` 技能。

## 何时使用

- 用户想了解画板**某个功能是什么、怎么用**（Choice、Playbook、事件表、条件、变量、Frame…）
- 用户要**手动操作**画板（怎么加节点、连线、试玩、导出）
- **新手入门**，想知道怎么上手
- 用户在"理解概念/手动操作"与"让 AI 改文件"之间分不清时，先讲解、再按需转交 `ncanvas-editor`

> **与 ncanvas-editor 的分工**：guide 讲"是什么/怎么手动操作"；editor 负责"让 AI 直接改 JSON 文件"。讲解 Choice 概念用 guide；让 AI 自动生成一段 Choice 分支用 editor。

---

## 画板是什么

NarrativeCanvas 是一个**节点式**的叙事工作区，用来规划复杂的互动叙事、分支故事、游戏剧情。它把"节拍、对话、分支选择、条件、变量更新、路由、角色、笔记"统一进一张**相连的结构图**里。

定位关键点：它是做**结构规划、分支验证、提案准备、叙事讲解**的工具——**文字润色**仍交给外部写作工具，真正跑逻辑的运行时代码交给游戏引擎。

### 核心心智模型（三个概念就够）

1. **节点 = 故事里的一格**：一个入口、一段正文、一次对话、一个选择……都是节点。
2. **连线 = 分支流向**：从一个节点的**输出端口**连到另一个节点的**输入端口**，表示"走完这格去哪"。方向恒为输出→输入。
3. **Playbook = 运行规则**：定义"试玩（Play）时怎么读这些节点"——起点在哪、何时结束、变量怎么变。

### 30 秒做出第一个分支故事

1. 打开/新建 `.ncanvas` 项目（已自带一个 Entry 入口节点）。
2. 从左侧 **Node Library** 点 `Content` 加几个正文节点，点输出端口→下一个输入端口连起来。
3. 想分叉就加 `Choice`，给每个选项写文字；点 **Play** 试玩走一遍。

---

## 功能导览（一句话讲清每块）

### 节点类型用途速查

| 节点 | 用途 | 何时用 |
|---|---|---|
| **Entry** | 故事唯一入口（系统类型，不可删） | 每个项目必须有一个，Play/Story 从这里开始 |
| **Content** | 通用正文/场景/设计笔记 | 默认的"一格里写什么"节点 |
| **Dialog** | 多轮对话（每轮有说话人+台词） | 角色对白；说话人名匹配角色会自动关联 |
| **Choice** | 分支选择（带选项、可用条件、选中效果） | 要分叉、要按条件解锁选项时 |
| **Marker** | 路标/操作笔记，不进入玩家路线 | 做备注锚点，可带 goTo 跳转 |
| **Clue** | 线索（带 证据/归属/结果 字段） | 悬疑/调查类线索记录 |
| **InterviewNote** | 访谈记录（带 记录人/可信度） | 带出处的笔记 |
| **ArchiveNote** | 归档备注（默认隐藏） | 标注废弃/遗留内容 |
| **Condition** | 旧式条件门（真→第一支，假→第二支） | 已废弃，新项目勿用（用节点的 requirements 代替） |
| **Set** | 旧式赋值 | 已废弃，勿用 |
| **Event / Frame** | 通用容器框，进事件表 | 分组一组节点并想在事件表追踪 |
| **StorySequence** | 章节/故事序列框（位置/天气/任务/状态） | 分章，进事件表 |
| **ConversationFrame** | 对话框（参与者/摘要），进事件表 | 聚拢对话节点 |
| **InvestigationEvent** | 调查/复审框（线索状态/风险/证据归属），进事件表 | QA/复审一轮内容 |
| **LocationFrame** | 地点框（区域/氛围），**不进事件表** | 纯画布分区 |
| **DraftFrame** | 草稿框（理由），**不进事件表**，默认隐藏 | 放未定内容/草稿 |

> 16 种的**详细讲解（是什么/什么时候用/关键字段/怎么手动加）**见 `references/node-guide.md`。

### 连线与分支

- **普通连线**：点源节点输出端口 → 目标节点输入端口。多条出边按画布/连线顺序导出。
- **Choice 分支**：每个选项可连到不同目标，带各自的"可用条件"和"选中效果"。
- **Condition（旧式）**：第一条出边=真，第二条出边=假。
- **路由 routing**（在节点 Inspector 里设）：
  - `continue`（默认）— 顺下一条出边走。
  - `goTo` — 显式跳到目标，**优先于**下一条出边。
  - `end` — 终点，不再往下。

### Playbook（剧本）—— 6 个 tab

Playbook 只管**试玩预览的运行时状态和规则**。点左侧 `Playbook.json` 文件 tab 进入，顶部 6 个 tab：

| tab | 管什么 |
|---|---|
| **variables** | 项目变量定义（键/类型/值） |
| **actions** | 节点之外的状态写入（跨节点、全局、手动触发） |
| **script** | 批量编辑各节点的 Requirements / effects / Routing |
| **gates** | gate 锁定规则（按条件锁定/解锁某 Choice 选项） |
| **rules** | 试玩规则：起点 / 结束条件 / 调试模式 / 访问追踪 |
| **validation** | 检查状态读写、文本插值、导出风险，每条可跳回画布 |

> 6 tab + 4 条 play rules + actions/gate + 变量与状态逻辑的**完整讲解**见 `references/playbook-guide.md`。

### 变量与状态逻辑（要点）

- **三处写状态**：① Choice 选项的 onChoose effects（选中时）；② 节点的 onVisit effects（进入节点时）；③ Playbook 的 Variable Actions（跨节点）。
- **Requirements（门槛）vs Effects（效果）**：Requirements 决定"能否到达/可选"；Effects 决定"到达/选中后改变什么"。
- **条件表达式**是安全的 JS 子集：`flag_x`、`coins >= 2`、`a === "red"`、`tokens.includes("x")`、`&&`/`||`/`!`/`(...)`、点路径 `nested.coins`。**不执行任意 JS**。
- **变量命名**：用扁平小写下划线（`inventory_coins`、`flag_met_guard`），让同一个键在条件、效果、文本模板、导出里都通用。

### 角色 & cast

节点通过 **cast** 关联角色，6 种 role：

| role | 含义 |
|---|---|
| **POV** | 视角人物（"你"是谁） |
| **Speaker** | 本节点 Dialog 里说话的人 |
| **Present** | 在场但不一定说话 |
| **Mentioned** | 被提及/点名 |
| **Target** | 动作的承受对象 |
| **Owner** | 拥有/负责（如线索归属） |

Dialog 的 `turns[].speaker` 文本若匹配某角色名，Characters 页会自动把该场景反链给该角色。正文里写 `@角色名` 也能自然引用。

### 事件表（Events Sheet）

- **是什么**：把 Frame 节点按类型排成表格，每行一个 Frame（一个"事件"），便于纵览章节/节拍。
- **6 个默认列**：`ACT`（幕）、`Chap.`（章）、`Event Type`（事件类型）、`Beat`（节拍）、`Description`（描述）、`Characters`（遇到的角色），加各 Frame 类型自己的自定义列。
- **哪些进表**：`kind:"frame"` 且**没**勾"从事件表隐藏"的类型进表（Event、StorySequence、ConversationFrame、InvestigationEvent）。LocationFrame、DraftFrame 默认不进表（纯画布分组/草稿）。
- **删列 vs 隐藏列**：隐藏可恢复；删除是破坏性的（会清掉已有节点里对应值）。

### Play 试玩

- **怎么开**：点中间工具栏 **Play**，从"起点节点"开始预览。
- **能干什么**：检查条件、选项显示、访问记录、调试状态——只验证"当前画布内"的读路线和变量变化。
- **visit tracking（访问追踪）**：只在"调试模式"开启时运行，记录本次会话访问过哪些节点，可用 `visited.<slug>` 条件读取（无需建变量）；关闭 Play 即丢弃，不导出。

### 导出（9 种格式）

| 格式 | 用途 |
|---|---|
| **Runtime JSON** | 给自研引擎的最小运行时 IR（无画布布局），自研 loader 的真源 |
| **Story MD** | 可读的故事投影，便于写作复核；`Import MD` 可读回（会**替换**当前项目） |
| **Layout JSON** | 仅画布布局（位置/框/端口），Story MD 导入后用它恢复布局 |
| **State Schema** | 变量 + 可导出名 + 初始值 + 读写引用 |
| **Export Profile** | 交接清单（文件列表、消费方、映射、警告） |
| **Yarn / Ink / Twee** | 对接对应对话脚本生态 |
| **Export All** | 上述全打包 + CSV/图片 |
| **PNG** | 画布截图（4096/6144/8192/12000 预设） |

导出共享一张"节点 slug + 变量名"映射表；无法映射的复杂变量/动作/效果**保留在 Runtime JSON 并报警告**，绝不静默丢弃。导出后会弹报告对话框列警告和改名映射。

---

## 手动操作速查（点哪里）

**布局**：左侧 = Project 卡片 + Files 标签（Canvas/Events/Characters/Playbook）+ Node Library 调色板；中间 = 画布（顶部工具栏 Undo/Redo、缩放、Play、Export PNG）；右侧 = Inspector（Project/Node/Story 三个 tab）。

| 操作 | 怎么做 |
|---|---|
| **加节点** | 点左栏 Node Library 里对应类型按钮（节点落在画布视口中心并自动选中） |
| **连线** | 点源节点**输出端口** → 点目标节点**输入端口**；双击空白处取消待连 |
| **断开/重连** | 右键连线 → 重连或删除 |
| **选中/编辑** | 点节点选中（右侧出 Node Inspector）；双击节点进入画布内联编辑，Esc 退出 |
| **多选** | Shift/Ctrl+点击 或 空白处拖框选；拖选中头部移动整组 |
| **加 Choice 选项** | 选中 Choice 节点 → Node Inspector 里"Add choice option"，每项可设条件+效果 |
| **把节点放进 Frame** | 把节点**拖到框的中心范围内**（归属按几何自动判定，移动框时会弹"更新归属?"） |
| **折叠 Frame** | 点框头部的 `+/-` |
| **进 Playbook** | 点左栏 `Playbook.json` 文件 tab |
| **试玩** | 点中间工具栏 **Play** |
| **缩放** | Ctrl/Cmd + 滚轮（向光标）；或工具栏 +/- |
| **平移** | 中键拖动；或滚动条 |
| **删除** | 选中节点/连线后按 Delete/Backspace |
| **撤销/重做** | Ctrl/Cmd+Z；Ctrl/Cmd+Shift+Z 或 Y |
| **保存** | 左栏 Save；另支持自动保存（插件设置 `autoSaveIntervalSeconds`，0=关） |
| **导出** | Project 面板的"Project I/O"网格（每格式一按钮）；PNG 在画布工具栏 |

> **完整手势手册（含每步细节、右键菜单、自定义节点类型创建）**见 `references/ui-operations.md`。

---

## 常见问答 FAQ

**Q：Choice 的 `choices` 和 `choiceOptions` 是什么关系？**
A：同一个东西的两份镜像。`choiceOptions` 是带条件的完整选项；`choices` 是纯文字标签数组。手动加选项时界面会自动同步；让 AI 改文件时必须两处一起改（详见 ncanvas-editor）。

**Q：gate 锁选项怎么理解？**
A：Playbook 的 gates tab 里，一条 `gate` 动作 `op: lockChoice` 指向某个 Choice 的具体选项，当它的 `value` 条件为真时该选项**不可选**（`unlockChoice` 反向加可用条件）。常做"硬币不够就锁掉贿赂选项"这类逻辑。导出时会折进 Choice 的条件里。

**Q：节点怎么归到 Frame？为什么我拖了却没进去？**
A：归属按"节点中心是否落在框矩形内"自动判定。拖动框/节点结束时会弹"更新归属?"对话框，确认才写入。手动改文件时则要显式写 `frameId`。

**Q：条件表达式能写什么？**
A：JS 子集：变量真值判断、`=== !== >= <= > <`、`&& || !`、括号、`"字符串"`、`.includes(...)`、点路径。**不能**写算术、赋值、三元、任意方法调用。`has()/contains()` 是旧写法仍兼容。

**Q：变量怎么命名？**
A：扁平小写下划线，如 `inventory_coins`、`flag_met_guard`。旧式点路径 `inventory.coins` 仍能加载，但新项目建议扁平（条件、效果、模板、导出都用同一键）。

**Q：Play 试玩和真实游戏引擎一样吗？**
A：不一样。Play 只验证"当前画布内"的读路线和变量变化，是预览/调试用。真实运行由你的引擎（用 Runtime JSON + 自研/Godot loader）跑。复杂动作/效果保留在 Runtime JSON 里，由引擎决定。

**Q：Condition/Set 节点还能用吗？**
A：是 legacy 类型（默认隐藏），新项目别用。条件改用节点的 `requirements`；赋值改用节点的 `effects` 或 Playbook 的 Variable Actions。

---

## 最佳实践

- **变量用扁平小写下划线**，让一键通用。
- **先 Content 搭骨架，再细化**：先用通用正文节点把流程串起来，再按需要换成 Dialog/Choice。
- **用 Frame 分章/分组**，进事件表的类型（StorySequence 等）便于纵览。
- **用 Story 视图检查可达性**：从 Entry 出发能走到哪些节点一目了然，能发现死路/孤岛。
- **导出前跑 Playbook 的 Validation**，处理状态读写和插值警告。
- **文字润色交给外部写作工具**，画板管结构。

---

## 何时读 references / 转交

- 想了解某节点类型**详细用途和怎么手动加** → `references/node-guide.md`
- 想配置 **Playbook / 变量 / 状态逻辑 / 条件** → `references/playbook-guide.md`
- 想查**某个手动操作的完整步骤** → `references/ui-operations.md`
- **要让 AI 直接增删改 `.ncanvas` 文件**（生成节点 JSON、批量改、删除分支）→ 转交 **`ncanvas-editor`** 技能
