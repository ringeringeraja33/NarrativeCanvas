# 真实节点样本（references/samples.md）

> 按需读取：想看各类节点的完整写法时直接复制改造。
> 提炼自 `NarrativeCanvas/tests/fixtures/*.ncanvas`（去冗余，保留关键字段）。这些是**归一化后**的形态——即插件加载再保存后的样子，也就是你写文件应该对齐的样子。

---

## 1. Entry 入口节点（最简）

```jsonc
{
  "id": "n0",
  "type": "Entry",
  "title": "Start",
  "body": "Coins before: {inventory_coins}. Nested coins: {nested_inventory.coins}.",
  "x": 80,
  "y": 80
}
```

> 注意：fixture 里入口节点可以极简（连 ports/frameId 都不写），加载时自动补默认。但**新建节点时建议写全** ports 和 `frameId:""`，更稳（见 SKILL.md 规则 2）。

---

## 2. Choice 节点（含选项 + 效果 + 门槛，重点样本）

```jsonc
{
  "id": "n1",
  "type": "Choice",
  "title": "Bribe check",
  "body": "Coins before choice: {inventory_coins}. Suspicion: {guard_suspicion}.",
  "choices": [
    "Slip two coins to the Brakeman",
    "Keep moving"
  ],
  "choiceOptions": [
    {
      "id": "opt_bribe",
      "label": "Slip two coins to the Brakeman",
      "requires": "(guard_suspicion >= 1 && (inventory_coins >= 2 || ticket_phrase === \"red && blue\")) && flag_watch_missing && flag_tokens.includes(\"boarding\") && nested_inventory.coins >= 3 && !flag_boarding_denied",
      "requiresMode": "all",
      "effects": [
        { "trigger": "onChoose", "op": "subtract", "key": "inventory_coins", "value": "2" },
        { "trigger": "onChoose", "op": "subtract", "key": "guard_suspicion", "value": "1" }
      ]
    },
    {
      "id": "opt_keep",
      "label": "Keep moving",
      "requires": "",
      "requiresMode": "all",
      "effects": []
    }
  ],
  "customFields": { "readout": "Custom field coins: {inventory_coins}" },
  "x": 330,
  "y": 80,
  "ports": {
    "input":  { "side": "left",  "t": 0.3 },
    "output": { "side": "right", "t": 0.7 }
  }
}
```

要点：
- `choices[]` 与 `choiceOptions[].label` **逐字镜像、顺序一致**。
- 选项 `id` 这里用了语义名（`opt_bribe`），合法只要唯一；不指定时按 `opt_1/opt_2`。
- `requires` 是表达式字符串，`requiresMode: "all"`。
- `effects` 的 `value` 是字符串 `"2"`。

---

## 3. Content 节点（带自定义字段模板）

```jsonc
{
  "id": "n2",
  "type": "Content",
  "title": "Bribe accepted",
  "body": "Coins after: {inventory_coins}. Suspicion after: {guard_suspicion}.",
  "customFields": { "readout": "Custom field after: {inventory_coins}" },
  "x": 600,
  "y": 80
}
```

---

## 4. Dialog 节点（带 turns）

```jsonc
{
  "id": "n3",
  "type": "Dialog",
  "title": "Mara scene",
  "body": "We need to keep moving.",
  "turns": [
    { "speaker": "Mara",  "line": "We need to keep moving." },
    { "speaker": "Brakeman", "line": "Not without a ticket." }
  ],
  "cast": [ { "characterId": "c0", "role": "Speaker" } ],
  "x": 80,
  "y": 300,
  "frameId": "",
  "ports": { "input": { "side": "top", "t": 0.5 }, "output": { "side": "bottom", "t": 0.5 } }
}
```

要点：
- `turns` 仅 Dialog 有，每项 `{speaker, line}`。
- 若角色名与某 Character.name 一致，归一化会自动把该角色加进 `cast`（role=Speaker）。手动写 `cast` 也行。
- speaker 为空串时表示旁白。

---

## 5. Frame 节点（容器，如 Event / StorySequence）

```jsonc
{
  "id": "n10",
  "type": "StorySequence",
  "title": "第一幕 · 车站",
  "body": "",
  "x": 40,
  "y": 40,
  "frameId": "",
  "collapsed": false,
  "layout": "free",
  "width": 540,
  "height": 400,
  "ports": { "input": { "side": "left", "t": 0.5 }, "output": { "side": "right", "t": 0.5 } },
  "customFields": {
    "location": "车站",
    "timeWeather": "夜 / 雨",
    "questEpisode": "EP01",
    "status": "进行中"
  }
}
```

要点：
- Frame 类型有 `collapsed` / `layout`；`kind:"frame"` 的类型才保留这两个字段。
- 子节点通过自己的 `frameId: "n10"` 归属到此 Frame。
- `customFields` 的 key 对应该类型 `fields[]` 定义（StorySequence：location/timeWeather/questEpisode/status）。
- 事件表类型（Event/StorySequence/ConversationFrame/InvestigationEvent）还会有事件列字段（act/chapter/eventType/beatList/eventDescription/characterEncountered），按需填。

---

## 6. 连线（普通边 + Choice 分支边）

普通边：
```jsonc
{ "id": "l0", "from": "n0", "to": "n1" }
```

Choice 分支边（带选项引用）：
```jsonc
{
  "id": "l1",
  "from": "n1",
  "to": "n2",
  "label": "Slip two coins to the Brakeman",
  "choiceIndex": 0,
  "choiceOptionId": "opt_bribe"
}
```

要点：
- `choiceOptionId` 优先于 `choiceIndex`；两者并存最稳。
- 方向恒为 output→input（`from` 是源 Choice，`to` 是目标节点）。

---

## 7. 角色（`project.characters[]`）

```jsonc
{
  "id": "c0",
  "name": "Mara",
  "role": "Lead",
  "voice": "Precise",
  "notes": "主角，前侦探。",
  "hidden": false
}
```

要点：
- Character 的 `role` 是**自由文本**（"Lead"/"Antagonist"…）。
- 节点 `cast[].role` 才是枚举：`POV`/`Speaker`/`Present`/`Mentioned`/`Target`/`Owner`。
- id 用 `c0`、`c1`…（最小空闲值）。

---

## 8. 一个最小完整新项目骨架（顶层）

```jsonc
{
  "version": 1,
  "savedAt": "2026-06-17T08:30:12.405Z",
  "project": {
    "title": "Untitled",
    "workflowMode": "canvas",
    "notes": "",
    "variables": {},
    "script": {
      "nodeTypes": {},
      "actions": [],
      "playRules": {
        "startNode":     { "enabled": true,  "value": "Start" },
        "endCondition":  { "enabled": false, "value": "" },
        "visitTracking": { "enabled": false, "value": true },
        "debugMode":     { "enabled": false, "value": false }
      }
    },
    "eventSheet": { "columns": [], "hiddenColumns": [] },
    "eventRowOrder": {},
    "nodeTypes": [ /* 16 种系统类型定义 — 从现有文件复制，勿手写 */ ],
    "customNodeTypes": [],
    "characters": [],
    "deletedNodes": [],
    "nodes": [
      { "id": "n0", "type": "Entry", "title": "Start", "body": "Adventure Begins", "x": 120, "y": 120 }
    ],
    "links": []
  },
  "ui": {
    "selectedNodeId": "n0",
    "selectedLinkId": null,
    "panel": "project",
    "activeFileId": "adventure",
    "view": { "x": 0, "y": 0, "scale": 0.5 },
    "search": "",
    "characterSearch": "",
    "eventSearch": "",
    "playbookJsonOpen": false
  }
}
```

> **新建 .ncanvas 文件时**：不要从零手写 `nodeTypes[]` 的 16 项——从任意现有 `.ncanvas` 文件（如 `Try.ncanvas`）复制 `project.nodeTypes[]` 整段过来，只改 `project` 其余内容。系统类型定义很长且必须精确。
