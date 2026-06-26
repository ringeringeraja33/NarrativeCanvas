# 节点类型完整字段定义（references/node-fields.md）

> 按需读取：需要某系统类型的完整定义、要新建自定义节点类型、要查 Frame / 事件表细节时读本文。
> 所有结论源自 `NarrativeCanvas/main.js` 的归一化函数（`normalizeCustomNodeType` line 21132、`defaultNodeTypeList` line 9559、`normalizeNode` line 21272）。

---

## 一、NodeTypeDef 完整结构（`project.nodeTypes[]` 每一项）

```jsonc
{
  "type": "Entry",              // 类型标识。系统类型用原名；自定义用 Custom_<slug>
  "label": "Entry",             // 显示名（≤40 字符）
  "badge": "E",                 // 角标 1-2 字符
  "color": "#cdd6f4",           // 十六进制颜色
  "width": 160,                 // 像素宽度。node 类型夹 160–420；frame 类型夹 160–860
  "custom": false,              // 是否来自历史 customNodeTypes 迁移（新建恒 false）
  "badgeCustom": false,         // 角标是否自定义
  "kind": "node",               // "node" | "frame"。frame = 容器/事件类型
  "fields": [],                 // 自定义字段定义 [{key,label}]
  "removedColumns": [],         // 仅 frame：从事件表删除的列 key（隐藏不销毁）
  "eventColumnLabels": {},      // 仅 frame：事件表列重命名 {colKey: label}
  "hidden": false,              // 是否从节点库隐藏
  "eventSheetHidden": false,    // 仅 frame：是否从事件表隐藏该类型行
  "system": true,               // 系统类型（不可删）。Entry 与所有"高级"类型为 true
  "legacy": false               // 旧式类型（Condition/Set），不建议新建
}
```

**width 夹取规则**（`normalizeCustomNodeType` line 21143）：
`clamp(width, 160, kind==="frame" ? 860 : 420)`。缺省时 node 默认 200、frame 默认 420。

**自定义字段 `fields`**：`[{ "key": "solution", "label": "Solution" }]`。`key` 是存进节点 `customFields` 里的键名，`label` 是界面显示。

---

## 二、16 种系统节点类型（与 `defaultNodeTypeList` 一致）

| type | label | badge | color | width | kind | system | hidden | legacy | fields(keys) |
|---|---|---|---|---|---|---|---|---|---|
| Entry | Entry | E | #cdd6f4 | 160 | node | ✓ | – | – | – |
| Content | Content | C | #61afef | 200 | node | – | – | – | – |
| Dialog | Dialog | D | #56b6c2 | 200 | node | – | – | – | – |
| Choice | Choice | C | #d19a66 | 200 | node | – | – | – | – |
| Condition | Condition | C | #e06c75 | 190 | node | – | ✓ | ✓ | – |
| Set | Set | S | #98c379 | 190 | node | – | ✓ | ✓ | – |
| Marker | Marker | M | #7fdbca | 170 | node | – | – | – | – |
| Event | Frame | F | #b48cff | 420 | **frame** | – | – | – | – |
| StorySequence | Story Sequence | N | #b48cff | 540 | frame | ✓ | – | – | location, timeWeather, questEpisode, status |
| Clue | Clue | N | #d99a3d | 230 | node | ✓ | – | – | evidence, owner, outcome |
| InterviewNote | Interview Note | N | #56b6c2 | 240 | node | ✓ | – | – | recorder, reliability |
| LocationFrame | Location Frame | N | #6f8fcf | 560 | frame | ✓ | – | – | region, mood |
| ConversationFrame | Conversation Frame | N | #3aa99f | 540 | frame | ✓ | – | – | participants, summary |
| InvestigationEvent | Investigation Event | N | #c678dd | 540 | frame | ✓ | – | – | clueStatus, risk, evidenceOwner |
| ArchiveNote | Archive Note | N | #8a8f98 | 220 | node | ✓ | ✓ | – | reason |
| DraftFrame | Draft Frame | N | #7f848e | 520 | frame | ✓ | ✓ | – | reason |

注：
- "高级"8 种（StorySequence 起）`system` 恒 true。
- LocationFrame / DraftFrame 的 `eventSheetHidden: true`（不出现在事件表行）。
- 高级类型 `badge` 存储值多为 `N`，UI 渲染时会按类型回退默认角标。

---

## 三、Frame 节点专属行为

一个节点是否为 Frame，由**其 type 在 `nodeTypes` 里的 `kind==="frame"`** 决定（`isFrameNode` line 24720），不是节点实例自带标记。

Frame 节点归一化后额外拥有：
- `collapsed`: bool（默认 false）—— 折叠状态。
- `layout`: `"free"` | `"stack"`（默认 `"free"`）—— 子节点布局。
- `width` / `height`：容器尺寸。

非 Frame 节点上的 `collapsed` / `layout` 会被删除。**把节点 type 改成 frame 类型时要补 `collapsed`/`layout`；改回普通类型要删。**

### 事件表（event sheet）

只有 `kind==="frame"` 且 `eventSheetHidden !== true` 的类型才出现在事件表（即 Event、StorySequence、ConversationFrame、InvestigationEvent；不含 LocationFrame、DraftFrame）。

这类节点会被 `ensureEventDefaults`（line 21511）补上事件列字段，默认列（`eventSheetColumns` line 2081）：

| key | label | width |
|---|---|---|
| act | ACT | 110px |
| chapter | Chap. | 110px |
| eventType | Event Type | 170px |
| beatList | Beat | 180px |
| eventDescription | Description | 360px |
| characterEncountered | Characters | 320px |

加上该类型 `fields[]` 定义的自定义列。`project.eventSheet.columns[]` 可整体定制（增删列、改 label/width）；`hiddenColumns[]` 隐藏列。

---

## 四、新建自定义节点类型

往 `project.nodeTypes[]` 追加一个 NodeTypeDef。要点：

1. `type` 用 `Custom_<slug>` 形式（`customNodeTypeId` line 21232），slug 取自 label。避免与现有 type 重名（重名时 `uniqueCustomNodeTypeId` 会加 `_2`、`_3`）。
2. `kind` 选 `"node"` 或 `"frame"`。
3. `width` 按夹取范围给（node 160–420，frame 160–860）。
4. `fields` 给自定义字段 `[{key,label}]`，这些 key 就是节点实例 `customFields` 里要填的键。
5. `custom` 恒 `false`（仅历史迁移标记）；`system`/`legacy` 恒 `false`（除非你刻意覆盖系统类型）。
6. **不要往 `customNodeTypes[]` 写**——那是历史字段，迁移后恒为 `[]`。

模板见 SKILL.md 配方 H。

---

## 五、端口（ports）默认值

`normalizeNodePorts` line 21451：

| 节点类型 | input 默认 | output 默认 |
|---|---|---|
| 普通节点 | `{side:"top", t:0.5}` | `{side:"bottom", t:0.5}` |
| Frame 节点 | `{side:"left", t:0.5}` | `{side:"right", t:0.5}` |

`side` 必须是 `top`/`right`/`bottom`/`left` 之一，否则回退默认。`t` 夹在 `[0,1]`，缺省 0.5。

新建普通节点最省事的 ports：
```jsonc
"ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } }
```
新建 Frame 节点：
```jsonc
"ports": { "input": { "side": "left", "t": 0.5 }, "output": { "side": "right", "t": 0.5 } }
```

---

## 六、id 生成规则（`nextId` line 24873）

取**最小空闲值**：从 0 起递增，找到第一个 `prefix+index` 未被占用的 id。

```js
function nextId(prefix, items) {
  const used = new Set(items.map(i => i.id));
  let index = 0;
  while (used.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
}
```

- 节点：`nextId("n", project.nodes)` → `n0`、`n1`…
- 连线：`nextId("l", project.links)` → `l0`、`l1`…
- 角色：`nextId("c", project.characters)` → `c0`、`c1`…

> 注意：会复用被删后空出来的低 id（不是 max+1）。手动构造时按此规则挑 id。
