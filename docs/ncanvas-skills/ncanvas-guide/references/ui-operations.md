# 手动操作手册（references/ui-operations.md）

> 按需读取：想查某个手动操作的完整步骤、按钮位置、右键菜单时读本文。
> 所有手势源自 `main.js` UI handler 核实，针对 Obsidian 插件版（Web 版基本一致）。

## 界面布局

```
┌─────────────┬───────────────────────────────┬─────────────┐
│ 左栏         │ 画布（中）                      │ 右栏 Inspector│
│ Project 卡片 │ 顶部：Undo/Redo 缩放 Play PNG  │ Project/Node │
│ Files 标签   │                               │ /Story 三 tab │
│ Node Library │                               │              │
└─────────────┴───────────────────────────────┴─────────────┘
```

- **左栏**：Project 卡片（Save/New 按钮 + 文件名 + 脏标记）、Files 标签（Narrative.canvas / Events Sheet / Characters / Playbook，**切换中间工作区**不是文件选择器）、Node Library 调色板（+ 自定义类型表单）。
- **中间画布**：顶部工具栏（Undo、Redo、缩放 `-`/`%`/`+`、Center、Play、Export PNG + 分辨率选择）。
- **右栏 Inspector**：Project / Node / Story 三个 tab。两栏都可折叠（点侧栏边缘的折叠按钮）。

---

## 1. 加节点
- 点左栏 **Node Library** 里对应类型的按钮（如 Content、Dialog、Choice）。
- 节点落在**画布视口中心**并自动选中、打开 Node Inspector。
- 默认值：Choice 自带 "Continue"/"Turn back" 两项；Condition/Set 默认空。
- **不是双击创建**——双击空白处只取消待连的连线。

### 加自定义节点类型
在 Node Library 下方表单填：名称、颜色、kind（Node/Frame）、自定义字段（每行一个 `key: Label`），点 **Add**。type 自动取 `Custom_<slug>`。隐藏的类型在调色板下方的"Hidden"折叠区，点 Show 恢复。

---

## 2. 连线（link）
**主要手势：点击端口**
1. 点源节点的**输出端口**（普通节点在下边，Frame 在右边）→ 进入"待连"状态，出现提示气泡。
2. 点目标节点的**输入端口**（普通节点在上边，Frame 在左边）→ 连线建立。
3. 双击空白处取消待连。

**断开/重连**：右键连线 → 重连（再点对应端口）或删除。
- 不能连到自己。
- Choice 选项的分支连线会随选项自动同步。

---

## 3. 编辑节点
- **选中**：点节点 → 右栏切到 Node Inspector。
- **画布内联编辑**：双击节点 → 进入内联编辑（标题/正文）；Esc 或点节点外退出。
- **Inspector 编辑**：类型下拉、标题、正文、Dialog 轮次、cast、state logic、自定义字段，以及 **Duplicate / Delete node / Focus** 按钮。
- **节点右键菜单**：层级（置顶/上移/下移/置底）+ 删除。

### 多选与移动
- Shift/Ctrl+点击 多选；或空白处**拖框选**。
- 拖选中节点的头部移动整组。

---

## 4. Choice 选项编辑
选中 Choice 节点 → Node Inspector 里的选项区：
- **Add choice option**：新增一项（默认 `{label:"New choice", requires:"", effects:[]}`），自动聚焦标签输入。
- 每项可展开编辑：**条件**（Add choice option condition）+ **效果**（Add choice option effect）。
- 上/下箭头调序；删除按钮移除。
- 语义：每项"条件满足时可用，选中后执行其效果"；空 requires = 永远可用。

---

## 5. Frame 容器
- **加 Frame**：点 Node Library 里 Frame 类型（Event / StorySequence / LocationFrame 等）。
- **把节点放进去**：把节点**拖到框矩形中心范围内**。归属按几何自动判定：
  - 拖动节点/框结束时，自动重算每个移动节点的归属。
  - 移动框后会弹 **"Update frame membership?"** 对话框（列出进入/离开的节点），确认才写入。
- **折叠/展开**：点框头部 `+/-`（与 Story 视图共享状态）。
- **拖动框**：带动所有成员一起移动。
- **层级**：框在下层；右键菜单调层。

---

## 6. Playbook
- **进入**：点左栏 `Playbook.json` 文件 tab → 中间切到 Playbook 面板。
- **顶部**：`?` 帮助、`Advanced JSON`/Hide JSON 切换、Export JSON。
- **6 个 tab**：variables / actions / script / gates / rules / validation（点切换）。
- **Advanced JSON**：原始 JSON 视图；点任意"跳转"按钮定位到对应 token。

---

## 7. Play 试玩
- **开始**：点中间工具栏 **Play** → 打开预览对话框，从 Start Node 开始。
- 对话框内：
  - **Continue/Next page**：往下走（`play-next`）。
  - **选项按钮**：每个可用出边一个按钮；按 `choiceRevealMode`，不可用的选项置灰（显示"条件不满足"）或隐藏。
  - **Dialog 台词**：Continue 推进台词，Previous line 回上一句。
  - **Previous page**：回上一页（`play-prev`）。
  - **Restart**：重开（`restart-play`）。
  - **Manual actions**：trigger 为 `manual` 的 Playbook 动作会渲染成额外按钮。
- 关闭对话框即重置预览状态（visit tracking 丢弃）。

---

## 8. 快捷键

| 操作 | 快捷键 |
|---|---|
| 缩放 | Ctrl/Cmd + 滚轮（向光标缩放） |
| 平移 | 中键拖动（或滚动条） |
| 居中画布 | Center 工具栏按钮 |
| 框选 | 空白处左键拖 |
| 删除 | 选中节点/连线后 Delete / Backspace（多选时删整组） |
| 撤销 | Ctrl/Cmd + Z |
| 重做 | Ctrl/Cmd + Shift + Z 或 Ctrl/Cmd + Y |
| 取消内联编辑 / 关菜单 | Escape |

> **没有复制粘贴/重复的快捷键**——Duplicate 只能通过 Node Inspector 的 Duplicate 按钮。

---

## 9. 保存与加载
- **保存**：左栏 **Save** 按钮（写 `.ncanvas` 到 vault）。Obsidian 另有命令"Save project file to vault"。
- **自动保存**：插件设置 `autoSaveIntervalSeconds`（默认 0=关，可设 10–14 秒）。变脏后定时静默保存。
- **新建**：New 按钮（弹确认）。
- **打开别的项目**：open-project-file → 文件选择器（接受 `.json/.ncanvas/.narrativecanvas`）。
- **从 vault 重载**：reload-project-file（丢弃未保存改动）。
- **脏标记**：左栏文件名旁的指示器反映未保存状态。

---

## 10. 导出
按钮分两处：
- **画布工具栏（中间顶部）**：Export PNG + 分辨率选择（4096/6144/8192/12000）。
- **Project 面板 "Project I/O" 网格**：每格式一按钮——
  - export-json / export-story-md / export-story-layout / export-state-schema / export-profile / export-runtime-json
  - export-yarn / export-ink / export-twee
  - export-all（全打包）
  - 导入：import-story-md / import-story-layout / import-state-schema（弹确认 + 文件选择；Story MD 导入会**替换**当前项目）
- **各面板自带导出**：Characters（Export MD/JSON）、Events Sheet（Export CSV/JSON）、Playbook（Export JSON）。

导出经浏览器/Obsidian 下载（不直接写 vault，vault 写入只走 Save 流程）。导出后弹报告对话框（警告 + 改名映射）。

---

## 常见操作组合（场景速查）

**"我要做一条带条件的分支"**
1. 加 Choice 节点 → 连到上游。
2. Inspector 里 Add choice option 写两个选项。
3. 给选项加 Condition（如 `coins >= 2`）和 Effect（如 `subtract coins 2`）。
4. 每个选项连到不同下游节点。
5. Play 试玩验证。

**"我要把这段归到第二章"**
1. 加 StorySequence 框，填 Location/Time/Quest/Status。
2. 把相关节点拖进框中心 → 弹"更新归属?"确认。
3. 事件表里该框作为一行出现。

**"我要锁掉某个选项"**
1. 进 Playbook → gates tab。
2. 加一条 `lockChoice`，target 指向该 Choice，key 指向选项 id，value 写锁定条件。
3. Validation 检查，Play 试玩验证选项确实被锁。
