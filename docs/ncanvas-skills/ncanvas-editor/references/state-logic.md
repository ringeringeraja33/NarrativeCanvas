# 状态逻辑与条件表达式（references/state-logic.md）

> 按需读取：要写条件表达式、选项效果、剧本动作、gate 锁选项时读本文。
> 结论源自 `NarrativeCanvas/main.js`：表达式求值 `evaluateCondition` line 22740、解析器 `parseJsConditionExpression` line 18475、效果 `normalizeNodeEffects` line 21426、剧本动作 `normalizePlaybookAction` line 20053、枚举常量 line 1787–1914。

---

## 一、变量（`project.variables`）

扁平字典，**值类型无限制**（string / number / boolean / array / object / null 都可）。键名风格：下划线，如 `inventory_coins`、`flag_met_guard`、`nested_inventory.coins`。

```jsonc
"variables": {
  "traveler": "Mara",
  "inventory_coins": 3,
  "guard_suspicion": 1,
  "flag_watch_missing": true,
  "flag_boarding_denied": false,
  "ticket_phrase": "red && blue",   // 字符串里可以含 &&（作为字面量）
  "flag_tokens": ["boarding", "watch"],
  "nested_inventory": { "coins": 3 }
}
```

> `ticket_phrase === "red && blue"` 这种比较是合法的——表达式解析器对字符串字面量内的 `&&` 不敏感。

---

## 二、条件表达式语法（`requirements` / `condition` / `requires`）

不是 `eval`，是一套**自定义递归下降解析器**，支持 JavaScript 子集。

### 字面量
- 字符串：`"..."` / `'...'`
- 数字：`3`、`-2`、`1.5`
- `true` / `false` / `null` / `undefined`（不区分大小写）
- `not` 等价于 `!`

### 运算符（按优先级，低→高）
1. `||`
2. `&&`
3. 相等：`===` `!==` `==` `!=`
4. 比较：`>=` `<=` `>` `<`
5. 一元 `!`
6. 后缀：成员访问 `.`、方法调用 `.includes(...)`

### 成员访问
- 支持 `.` 链：`nested_inventory.coins`、`variables.foo.bar`。
- 前导 `variables.` 会被剥离，所以 `variables.foo` 与 `foo` 等价。

### 方法调用
- **只允许 `.includes(...)`**（`JS_CONDITION_METHODS`，白名单）。
- 旧式函数 `has(a,b)` / `contains(a,b)` 也支持，都编译成 `container.includes(value)`。

### 分组
- 括号 `(...)`。

### 不支持
算术（`+ - * /`）、赋值、三元、箭头函数、`includes` 以外的方法/属性访问。

### 真实复杂例子（来自 fixture）
```js
(guard_suspicion >= 1 && (inventory_coins >= 2 || ticket_phrase === "red && blue")) && flag_watch_missing && flag_tokens.includes("boarding") && nested_inventory.coins >= 3 && !flag_boarding_denied
```

### 求值语义
- `===` 严格相等；`==` 松散（再尝试数值、字符串比较）。
- `>=`/`<=`/`>`/`<` 用原生 JS 比较。
- `&&`/`||` 短路 + 布尔强转。
- `.includes(x)`：数组用 `some(匹配)`；字符串用 `String.includes`；其它 → `false`。
- **空表达式**：`requirements`/`requires` 空 = 视为通过（`true`）；`condition` 空 = 视为不满足（`false`）。

---

## 三、节点状态逻辑（`node.stateLogic`）

可选字段，结构（`normalizeNodeStateLogic` line 21417）：

```jsonc
"stateLogic": {
  "requirements": "guard_suspicion >= 1",     // 表达式字符串，空 = 无门槛
  "requirementsMode": "all",                    // "all"(=and) | "any"(=or)
  "effects": [ /* Effect[] */ ]
}
```

> 别名兼容：`requirement`/`gate`→`requirements`；`requirementMode`/`conditionMode`→`requirementsMode`。
> 若 `requirements` 为空且 `effects` 为空，整个 `stateLogic` 会被删除——所以**可省略空 stateLogic**。

`requirementsMode` 存储值是 `all` / `any`（不是 and/or）。

---

## 四、Effect（效果）

效果出现在两处：节点 `stateLogic.effects[]`、Choice 选项 `choiceOptions[].effects[]`。结构（`normalizeNodeEffects` line 21426）：

```jsonc
{ "trigger": "onChoose", "op": "subtract", "key": "inventory_coins", "value": "2" }
```

| 字段 | 说明 |
|---|---|
| `trigger` | 见下表；默认 `onVisit` |
| `op` | 操作，见下表；默认 `set` |
| `key` | 目标变量名（别名词 `variable`/`name`）；`op==="clear"` 时可空 |
| `value` | 值（字符串） |

**规则**：effect 没有 `key` 且 `op !== "clear"` 时，该 effect 会被丢弃。

### `op` 枚举（`PLAYBOOK_ACTION_OPERATIONS` line 1787）

| op | 运行时语义 |
|---|---|
| `set` | `variables[key] = value` |
| `add` | `variables[key] = Number(旧值) + Number(value)` |
| `subtract` | `variables[key] = Number(旧值) - Number(value)` |
| `append` | 向数组追加（`appendPlaybookStateValue`） |
| `remove` | 从数组移除（`removePlaybookStateValue`） |
| `toggle` | `variables[key] = !布尔(旧值)`（忽略 value） |
| `clear` | `delete variables[key]` |

旧式 op（`if`/`goTo`/`show`/`hide`/`lockChoice`/`unlockChoice`）归一化时保留但 UI 不生成，**新建效果不要用这些**——锁选项改用剧本动作的 `lockChoice`/`unlockChoice`。

### `trigger` 枚举（line 1798–1804）

| trigger | 含义 |
|---|---|
| `onVisit` | 到达该节点时触发（默认） |
| `onChoose` | 选中该选项时触发（Choice 选项效果常用） |
| `manual` | 手动触发 |
| `gate` | 内部/合成触发（剧本动作锁定用） |

---

## 五、Choice 选项（`choiceOptions[]`）

结构（`normalizeChoiceOptions` line 21366）：

```jsonc
{
  "id": "opt_1",                  // 稳定 id：推荐 opt_1, opt_2…（按位置）。冲突时加 _2
  "label": "塞两枚硬币",           // 显示文本（空 label 的选项会被丢弃）
  "requires": "inventory_coins >= 2",  // 门槛表达式，空 = 无门槛
  "requiresMode": "all",          // "all" | "any"
  "effects": [ /* Effect[] */ ]   // 选中时的效果
}
```

**id 生成**（`generateChoiceOptionId` line 21396）：按位置 `opt_1`、`opt_2`…；冲突时 `opt_2_2`。也可自定义 id（如 `opt_bribe`），只要唯一。**连线引用选项时用 `choiceOptionId` 指向这个 id。**

> 记得 SKILL.md 规则 1：`choices[]` 必须与 `choiceOptions[].label` 镜像。

`requiresMode` 存 `all`/`any`。

---

## 六、连线（`project.links[]`）

结构（`normalizeLink` line 21047）：

```jsonc
{
  "id": "l2",
  "from": "n4",          // 源节点 id（输出端口）
  "to": "n5",            // 目标节点 id（输入端口）。方向恒为 output→input
  "label": "塞两枚硬币",  // 可选
  "choiceOptionId": "opt_1",  // 可选：引用源 Choice 节点的选项 id（优先于 index）
  "choiceIndex": 0,           // 可选：选项位置索引（与 choiceOptionId 并存更稳）
  "requirements": "flag_x"    // 可选：走这条边的额外门槛表达式
}
```

- 没有选项分支时，只给 `from`/`to`（加可选 `label`/`requirements`）即可。
- Choice 的分支边：**同时给 `choiceOptionId` 和 `choiceIndex`**，二者指向同一选项，最稳。
- 空的 `label`/`requirements`/`choiceIndex`/`choiceOptionId` 会被删除，不必留空串。

---

## 七、剧本配置（`project.script`）

```jsonc
"script": {
  "nodeTypes": {},          // 旧式按类型的 condition/set，一般空
  "actions": [ /* PlaybookAction[] */ ],
  "playRules": { /* 4 个开关 */ }
}
```

### playRules（4 个 `{enabled, value}`）

| 规则 | value 类型 | 说明 |
|---|---|---|
| `startNode` | string | 入口节点标题（如 `"Start"`） |
| `endCondition` | string | 结束条件表达式 |
| `visitTracking` | bool | 是否记录访问 |
| `debugMode` | bool | 调试模式 |

### PlaybookAction（`script.actions[]`，`normalizePlaybookAction` line 20053）

7 个字段：

```jsonc
{
  "id": "gate_lock_keep_when_suspicious",
  "trigger": "gate",            // onVisit/onChoose/manual/gate
  "target": "Bribe check",      // 目标节点标题 / 节点类型 / 作用域
  "op": "lockChoice",           // 同 Effect 的 op（含旧式 lockChoice/unlockChoice）
  "category": "Variable",       // 见下表
  "key": "opt_keep",            // 目标 key（选项 id 或变量名）
  "value": "guard_suspicion >= 1"  // 值（表达式或字面量）
}
```

> 别名：`when`→trigger；`nodeType`/`node`/`scope`→target；`action`/`type`→op；`scopeType`→category；`variable`/`name`→key。
> 空 key 且非 `clear` 时默认填 `"state_key"`。id 缺省回退 `a${index}`。

`category` 枚举（`PLAYBOOK_STATE_CATEGORIES` line 1840）：
`Quest`、`Quest Entry`、`Variable`、`Actor`、`Item`、`Location`、`Sim Status`、`Alert`、`Misc`、`Custom`、`Manual Enter`。

**gate 锁选项典型用法**：当某条件成立时锁定某选项：
```jsonc
{ "id": "gate_lock_x", "trigger": "gate", "target": "Bribe check", "op": "lockChoice",
  "category": "Variable", "key": "opt_keep", "value": "guard_suspicion >= 1" }
```

---

## 八、routing（节点出口流向，可选）

```jsonc
"routing": { "mode": "goTo", "target": "n5" }
```
`mode` ∈ `continue`（默认，顺连线下一个）/ `end`（结束）/ `goTo`（跳转到 target 节点 id 或标题）。
`mode==="continue"` 且无 `target` 时整个 `routing` 被删除，可省略。
（旧式 `Jump` 节点已废弃，迁移成 `Content` + `routing.goTo`。）
