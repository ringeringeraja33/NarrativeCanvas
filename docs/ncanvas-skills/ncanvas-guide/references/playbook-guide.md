# Playbook 与状态逻辑详解（references/playbook-guide.md）

> 按需读取：想配置 Playbook（变量/动作/规则/gate）或写状态逻辑（条件/效果/表达式）时读本文。
> 教学视角。op/trigger 完整枚举表见 ncanvas-editor 的 references/state-logic.md（文件格式视角）。

## 一、Playbook 是什么

Playbook 只管**试玩（Play）预览的运行时状态和规则**——不存正文（正文在节点里），不跑真实引擎逻辑（那交给游戏引擎）。一句话：定义"Play 怎么读这些节点"。

打开方式：点左侧 `Playbook.json` 文件 tab。顶部 `?` 是帮助手册，`Advanced JSON` 可看/改原始 JSON（点任意跳转按钮能定位到对应 token）。

---

## 二、6 个 tab

### 1. variables（变量定义）
- 列出项目所有变量：键 / 类型 / 当前值。
- **Add variable** 新增（新建后自动聚焦输入）。
- 变量值类型自由（字符串/数字/布尔/数组/对象），但**比较运算符按类型过滤**：布尔只能 `===/!==/truthy/falsy`；数字多了 `>= <= > <`；字符串有 `contains`；数组有 `contains`；对象只有 truthy/falsy。

### 2. actions（变量动作）
- **节点之外**的状态写入：跨节点、全局、或手动触发。
- 每条动作：`trigger`（onVisit 进节点时 / manual 手动 / 旧式 onChoose）+ `target`（目标节点/类型）+ `op`（操作）+ `key`（变量键）+ `value`。
- **op 按类型过滤**：字符串/对象→`set`；数字→`set/add/subtract`；布尔→`set/toggle`；数组→`set/append/remove`。

### 3. script（脚本构建器）
- 批量编辑**非 Frame 节点**的 Requirements（条件）/ effects（效果）/ Routing（路由）。
- 读写的数据**和节点 Inspector 完全一样**，只是换了个批量视角。

### 4. gates（条件门 / 锁选项）
- gate 动作：按条件**锁定/解锁某 Choice 的具体选项**。
- `op: lockChoice` → value 条件为真时该选项**不可选**；`unlockChoice` → 反向加可用条件。
- 典型：`gate | 目标=贿赂检查 | lockChoice | key=opt_贿赂 | value="guard_suspicion >= 1"`（可疑度高时锁掉贿赂选项）。
- 导出时 gate 会折进 Choice 的条件里。

### 5. rules（试玩规则）
- 只影响 Play 预览行为。4 条（见下"四条 play rules"）。

### 6. validation（校验）
- 检查状态读写、文本插值、导出风险。
- 每条可点击跳回画布或 Advanced JSON 定位。
- **导出前务必跑一遍**，处理警告。

---

## 三、四条 play rules

| 规则 | 值类型 | 含义 |
|---|---|---|
| **Start Node**（起点） | 字符串（节点标题） | Play 从哪个节点开始 |
| **End Condition**（结束条件） | 条件表达式 | 为真时预览结束 |
| **Debug Mode**（调试模式） | 布尔 | 调试辅助总开关 |
| **Visit Tracking**（访问追踪） | 布尔 | **只在 Debug Mode 开时生效**；记录本次会话访问过的节点，可用 `visited.<slug>` 读，无需建变量；关闭 Play 即丢弃，不导出 |

---

## 四、状态逻辑：三处写状态

变量（状态）可以在三个地方被改变：

1. **Choice 选项的 onChoose effects**：只有选中该选项时才执行。
2. **节点的 onVisit effects**：进入该节点（访问到）时执行。
3. **Playbook 的 Variable Actions**：跨节点、全局、或手动触发。

> 选哪个？效果只属于某个选项 → 放选项 effects；属于到达某节点 → 放节点 onVisit effects；跨节点/全局/手动 → 放 Playbook actions。

## 五、Requirements（门槛）vs Effects（效果）

- **Requirements**：决定"能否到达这个节点 / 这个选项能否可选"。是**读**条件。
- **Effects**：决定"到达节点 / 选中选项后，改变什么变量"。是**写**操作。
- 在节点 Inspector 里，State Logic 分成 **Conditions** 和 **Effects** 两块独立编辑。
- 在 Playbook 的 script / Choice Conditions tab 里可批量编辑同样的数据。

---

## 六、条件表达式语法（安全 JS 子集）

不是 `eval`，是受控解析器。能写：

| 类别 | 示例 |
|---|---|
| 变量真值判断 | `flag_met_guard` |
| 比较 | `coins >= 2`、`a === "red"`、`x !== false` |
| 布尔组合 | `a && b`、`a \|\| b`、`!flag`、`(a && b) \|\| c` |
| 字符串字面量 | `phrase === "red && blue"`（串里能含运算符） |
| 成员判断 | `tokens.includes("boarding")` |
| 点路径 | `nested_inventory.coins`（扁平键优先，再走对象路径） |
| 旧式函数 | `has(tokens, "boarding")` / `contains(tokens, "boarding")` 仍兼容 |

**不能写**：算术（`+ - * /`）、赋值、三元、箭头函数、`includes` 以外的方法/属性访问、任意 JS。

**空表达式**：Requirements/选项 requires 空 = 视为通过（无门槛）；节点 condition 空 = 视为不满足。

**组合模式**：多条条件用 `requirementsMode`：`all`（全部满足=and）/ `any`（任一满足=or）。

---

## 七、变量命名规范

用**扁平小写下划线**：`inventory_coins`、`flag_watch_missing`、`clue_glass_key`。

为什么：让同一个键在 requirements、effects、文本模板 `{...}`、可导出名里都通用，导出映射最干净。旧式点路径（`inventory.coins`）仍能加载（解析时先查扁平键，再走对象路径），但新项目用扁平。

---

## 八、效果（Effect）op 速记

| op | 干什么 |
|---|---|
| `set` | 直接赋值 |
| `add` / `subtract` | 数字加减 |
| `toggle` | 布尔取反（忽略 value） |
| `append` / `remove` | 数组追加/移除（运行时操作，导出时保留+警告） |
| `clear` | 删除该变量键 |

> 完整 op/trigger/category 枚举与归一化规则 → ncanvas-editor 的 references/state-logic.md。

---

## 九、Playbook 与 Inspector 的关系（避免困惑）

Playbook 的 script / Choice Conditions tab 和节点 Inspector 编辑的是**同一份数据**——只是视角不同：Inspector 是"单个节点看"，Playbook 是"所有节点批量看"。改一处另一处同步。Playbook 适合全局审视和批量调整，Inspector 适合精修单个节点。
