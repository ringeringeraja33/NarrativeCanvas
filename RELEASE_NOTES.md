# Narrative Canvas 1.2.1

Compared with GitHub release `1.2.0`.

## English

### Added

- **AI copilot (Beta)** — an experimental canvas assistant, opened from the round **AI** button at the bottom-left of the canvas. Discuss the story and it proposes canvas edits (add / update nodes, add / remove links) that you **Apply to canvas** or **Reject**. The web app and plugin both connect to a user-configured OpenAI-compatible endpoint. The plugin stores its API key in local `data.json` and sends requests through Obsidian's `requestUrl`; its bundled canvas code contains no browser `fetch` or `localStorage` branch. The panel is bilingual and carries a **Beta** tag. Apply / Reject / Send controls remain readable in dark and light themes.

### Improved

- Choice cards now keep long option lists in a vertical scroll area inside the node.
- Dialog cards now keep long turn lists in a vertical scroll area inside the node.

### Fixed

- The floating AI open and close buttons now use dedicated event handlers, preventing intermittent missed clicks when the plugin event scope changes.

## 中文

### 新增

- **AI 助手（测试版）** —— 实验性画布助手，从画布左下角的圆形 **AI** 按钮打开。与它讨论剧情，它会提出画布修改建议（新增/更新节点、新增/删除连线），可**应用到画布**或**拒绝**。网页端与插件端均连接用户配置的 OpenAI 兼容接口。插件端将 API key 保存在本地 `data.json`，通过 Obsidian 的 `requestUrl` 发送请求；插件内嵌的画布代码不包含浏览器 `fetch` 或 `localStorage` 分支。面板支持中英文并带 **Beta** 标记，Apply / Reject / Send 按钮在深色与浅色主题下均保持清晰。

### 改进

- Choice 节点的选项过多时，选项列表在节点卡片内部纵向滚动。
- Dialog 节点的轮次过多时，对话列表在节点卡片内部纵向滚动。

### 修复

- AI 浮动窗的呼出与关闭按钮改用独立事件处理，避免插件事件作用域切换时偶发漏掉点击。
