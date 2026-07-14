# Narrative Canvas 1.2.3

Compared with GitHub release `1.2.2`.

## English

### Added

- AI assistant replies now appear progressively as they arrive. Streaming can be stopped at any time, requests time out cleanly, and non-streaming providers use a short progressive reveal instead of inserting a full paragraph at once.
- Dialogue lines can be edited directly on Dialog cards. The speaker and dialogue columns can be resized per card by dragging the colon separator.
- Centered Play and Inspector windows can be moved and resized from every edge and corner.

### Improved

- Hovering a link highlights both endpoint cards. Hovering a node highlights its immediate upstream and downstream links and cards. Hovering a Choice option isolates its own outgoing link and successor card.
- Graph emphasis now uses a brighter purple glow. The light theme uses neutral white and light-gray surfaces with coordinated purple accents.
- Choice successors show the originating option above the title, and Choice option text remains directly editable on the card.

### Fixed

- AI open and close controls remain responsive during repeated use. Streaming updates are batched per animation frame to avoid repaint stalls, and requests can be cancelled without leaving the panel locked.
- Playbook JSON search centers matches immediately and retries after layout, preventing missed jumps when the document has just opened.
- Smoke-test interactions around virtualized Choice cards, radial-menu blank space, and frame context menus are more deterministic.

## 中文

### 新增

- AI 助手回复会随内容到达逐步显示。生成期间可随时停止，请求超时后会正常退出；不支持流式返回的服务也会短时逐字呈现，不再整段突然出现。
- Dialog 卡片中的角色名和每行对话可直接编辑；拖动冒号分隔位置，可为每张卡片调整角色栏与对话栏宽度。
- 居中的演示窗口和检查器窗口可拖动，并可从四边及四角调整大小。

### 改进

- 光标移到连线上时强调两端节点；移到节点上时强调一层上下游连线与卡片；移到 Choice 选项上时，仅强调该选项对应的连线与后续卡片。
- 画布强调效果统一为更亮的紫色辉光；浅色主题改用白色、浅灰表面与协调的紫色强调色。
- Choice 后续节点继续在标题上方显示来源选项，Choice 选项文字可直接在卡片中编辑。

### 修复

- AI 按钮反复呼出和关闭时保持响应。流式内容按动画帧合并更新，降低重绘卡顿；停止请求后不会残留锁定状态。
- Playbook JSON 搜索会先立即居中，再在布局完成后复核，避免文档刚打开时定位失效。
- 提高虚拟化 Choice 卡片、径向菜单空白点和框架右键菜单相关 smoke 测试的稳定性。
