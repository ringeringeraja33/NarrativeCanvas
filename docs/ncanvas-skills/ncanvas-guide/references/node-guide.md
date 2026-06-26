# 节点类型详解（references/node-guide.md）

> 按需读取：想了解某节点类型的**用途、使用场景、关键字段含义、怎么手动加**时读本文。
> 教学视角。文件格式/字段归一化细节不在此（那属于 ncanvas-editor 的 references）。

节点分两大类：
- **Flow 节点（`kind: node`）**：承载故事流程，会被 Play 试玩访问。
- **Frame 节点（`kind: frame`）**：容器/分组框，多数会进事件表。

---

## Flow 节点

### Entry（入口）
- **是什么**：故事唯一起点，系统类型（不可删、每项目至少一个）。
- **何时用**：每个故事必须有且通常只有一个。Play 试玩和 Story 可达图都从这里开始。
- **关键字段**：`title`（显示为节点名）、`body`（开场白，支持 `{变量}` 插值）。
- **怎么手动加**：不用加——新项目自带一个。需要改起点就用 Playbook 的 Start Node 规则（按节点标题）。

### Content（正文）
- **是什么**：通用一格里写什么的节点，最常用。
- **何时用**：默认选择——正文、场景描述、设计笔记都放这。
- **关键字段**：`title`（可被搜索/路由引用）、`body`、`customFields`（按类型定义的自定义字段）。
- **怎么手动加**：点 Node Library 的 `Content`。

### Dialog（对话）
- **是什么**：多轮流言对白，每轮有"说话人 + 台词"。
- **何时用**：角色之间对话。说话人名若匹配某个 Character，Characters 页自动把该场景反链给该角色。
- **关键字段**：`turns: [{speaker, line}, ...]`。可在节点 Inspector 里逐轮编辑。
- **怎么手动加**：点 `Dialog`，在 Inspector 里加轮次、填说话人和台词。
- **要点**：speaker 为空串 = 旁白。

### Choice（选择/分支）
- **是什么**：分支枢纽，带多个选项；每个选项可设"可用条件"和"选中效果"，并连到不同目标。
- **何时用**：要分叉、要按条件解锁选项、要选中后改变量时。
- **关键字段**：
  - `choiceOptions`：完整选项，每项 `{id, label, requires, requiresMode, effects}`。
  - `choices`：纯文字标签数组（与 choiceOptions 的 label 镜像——手动编辑时界面自动同步，AI 改文件要两处一起改）。
  - `choiceRevealMode`：`hide`（不满足条件的选项直接隐藏）/ `disabled`（置灰显示"条件不满足"）。
- **怎么手动加**：点 `Choice`（默认带 "Continue"/"Turn back" 两项）；选中后在 Inspector 里 Add choice option，每项可加条件（Condition）和效果（Effect）。
- **分支连线**：每个选项连到各自目标。详见 SKILL.md"连线与分支"。

### Marker（路标）
- **是什么**：路标/操作笔记，**不进入玩家路线**。
- **何时用**：做备注锚点；可带 `routing: goTo` 跳到别处（设计期跳转，非玩家路径）。
- **关键字段**：`title`、`body`、`routing`。
- **怎么手动加**：点 `Marker`。

### Clue（线索）
- **是什么**：带元数据的线索记录，字段 Evidence（证据）/ Owner（归属）/ Outcome（结果）。
- **何时用**：悬疑/调查类，记录一条线索及其归属和结果。
- **关键字段**：`customFields`（evidence/owner/outcome）。
- **怎么手动加**：点 `Clue`，在 Inspector 填三个字段。

### InterviewNote（访谈记录）
- **是什么**：带出处的笔记，字段 Recorder（记录人）/ Reliability（可信度）。
- **何时用**：记录一段访谈/口供，并标注来源和可信度。
- **怎么手动加**：点 `Interview Note`。

### ArchiveNote（归档备注）
- **是什么**：归档/遗留标注，字段 Reason（理由），默认隐藏。
- **何时用**：标注废弃/合并/遗留内容的原因。
- **怎么手动加**：在 Node Library 的"Hidden"折叠区把 ArchiveNote 取消隐藏后再用。

### Condition / Set（旧式，勿用）
- **是什么**：legacy 类型，默认隐藏。
- **Condition**：真→第一条出边，假→第二条出边的门。
- **Set**：旧式赋值。
- **替代方案**：条件用节点的 `requirements`；赋值用节点的 `effects` 或 Playbook Variable Actions。新项目不要新建这两种。

---

## Frame 节点（容器框）

Frame 由其类型在 Node Library 里的 `kind:"frame"` 决定。Frame 渲染在普通节点**下层**，可把节点拖进它作为成员。

### 进事件表的 Frame

| Frame | 字段 | 场景 |
|---|---|---|
| **Event / "Frame"** | 无固定（通用） | 通用分组，想进事件表追踪时用 |
| **StorySequence**（章节框） | 位置 / 天气 / 任务集 / 状态 | 分章/分故事段 |
| **ConversationFrame**（对话框） | 参与者 / 摘要 | 聚拢一组对话节点 |
| **InvestigationEvent**（复审框） | 线索状态 / 风险 / 证据归属 | 做一轮 QA/复审 |

### 不进事件表的 Frame（纯画布分组/草稿）

| Frame | 字段 | 场景 |
|---|---|---|
| **LocationFrame**（地点框） | 区域 / 氛围 | 纯画布分区，默认 `eventSheetHidden` |
| **DraftFrame**（草稿框） | 理由 | 放未定内容，默认隐藏 + 不进表 |

### Frame 通用行为
- **折叠**：点框头部 `+/-`（与 Story 视图共享折叠状态）。
- **归属**：把节点拖进框中心范围自动归属；移动框/节点结束弹"更新归属?"确认。
- **拖动框**：带动所有成员一起移动。
- **层级**：框在下层，新框插在顶层，可用右键菜单调层。

### 怎么手动加 Frame
点 Node Library 里对应 Frame 类型（Event / StorySequence / LocationFrame 等）。自定义 Frame 类型可在 Node Library 表单里选 `Frame` kind 创建。

---

## 节点通用字段速记（教学视角）

- `title`：节点名（可搜索、可被路由/Playbook 引用）。
- `body`：正文，支持 `{变量}` / `{nested.path}` 模板插值。
- `ports`：输入/输出端口位置（连线用），普通节点默认 input=top/output=bottom，Frame 默认 input=left/output=right。
- `customFields`：按节点类型定义的自定义字段值。
- `cast`：关联的角色（role ∈ POV/Speaker/Present/Mentioned/Target/Owner）。
- `stateLogic`：可选——`requirements`（到达门槛）+ `effects`（到达/选中后的状态改变）。
- `routing`：可选——出口流向（continue/goTo/end）。

> 让 AI 直接改这些字段（生成/修改节点 JSON）→ 转交 **ncanvas-editor**。
