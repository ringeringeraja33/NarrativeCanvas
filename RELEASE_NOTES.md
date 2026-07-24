# Narrative Canvas 1.3.0

## English

### Narrative Library ([#5](https://github.com/ringeringeraja33/NarrativeCanvas/issues/5))

- Entries now cover Characters, Locations, Items, and Lore, plus **user-defined categories**: the `+` button beside the category tabs creates a new category, and empty custom categories can be removed from their tab. Custom category names round-trip through the markdown `category` frontmatter, so a category typed straight into a note appears in the Library automatically.
- The overview is a card box with fixed-height covers. A cover shows, in order of precedence: the entry's **icon**, a scaled snapshot of its **canvas board**, its **preview-image board layout**, or a category placeholder. Focused entries carry a badge.
- A card opens a detail page: `Referenced nodes` on the left (relation groups expanded by default; collapsed groups are remembered), the entry's fields on the right, one per row.
- Entries support **custom fields** (key–value pairs) that round-trip as plain frontmatter keys, and each category has a **field template** that prefills new entries and backfills existing ones.
- Entries can have an **icon** shown on overview covers, the detail header, and the cast chips on canvas nodes.
- Entries can link **vault files** (synced to the `files` frontmatter array) and hold multiple **preview images** with draggable layout, edge-resize, and a right-click layer menu (bring to front/forward/backward/back) in the focused vision board.
- **Native canvas boards**: `Create board` generates a real Obsidian `.canvas` file seeded with the entry's images and linked files, embeds it at the end of the entry's note, and shows a live read-only snapshot in the detail page (click to open, auto-refreshes when the `.canvas` file changes, `Detach board` reverts). Managed markdown keeps structured fields in frontmatter while preserving the free-form body.
- Typing `@` in node text searches every category and inserts stable ID-based references. Tags are removable tokens with suggestions.

### Nodes and vault files ([#8](https://github.com/ringeringeraja33/NarrativeCanvas/issues/8))

- Nodes can link multiple vault files: search-to-link inputs, open/remove icon buttons, drag-handle reordering (with arrow-key support), and independent Markdown previews on the canvas card. Image files preview as images with an inline size slider on the card row. Frames deliberately have no file links.
- **Drag a file from Obsidian's file explorer onto a node card or the inspector's Vault file section to link it**, with drop-zone highlighting.
- The inspector's `Library references` pickers are comboboxes: click to browse the category-grouped menu or type to search, with full keyboard support; rows reorder by drag handle.

### Canvas, Play, and app behavior

- Single-clicking a canvas node only selects it; double-click centers at 100% and opens inline editing. Node auto-height allows much taller nodes and linked-file sections no longer clamp early.
- Play preview keeps a scrollable log of the last 30 cards, rendered with the variable values of their moment, including linked-image previews; `Return to this card` rewinds. Advancing follows the newest card; reading history keeps your scroll position.
- The AI launcher is a draggable floating ball whose position is remembered. The back-to-top button appears only after scrolling and stays clear of the bottom bar.
- The ribbon adapts to the vault: several `.ncanvas` projects open a picker, exactly one opens directly, none creates a default project. The `Document` tab is renamed `Edit document` and sits below the canvas. The Library tab remembers the last-opened entry detail.

### Theme isolation and reliability ([#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7))

- The plugin view now mounts inside a **Shadow DOM** with its stylesheet inside the shadow tree, so community themes (e.g. Retroma) can no longer restyle or hide the app's text — no `!important` overrides involved. Obsidian's color palette and configured fonts still flow in through CSS variables, and `styles.css` shrank from ~270 KB to under 2 KB of plugin chrome.
- The app observes its own panel size: collapsing Obsidian's sidebars or dragging splits reflows layouts immediately.
- Fixed focused vision-board controls not responding to clicks; fixed linked-file titles rendering centered inside Obsidian; audited every animation-frame callback so focus/scroll restores survive throttled environments; the web app's cache-buster now updates automatically per build.
- Vault writes fall back to `vault.modify` when `vault.process` is unavailable, keeping saves working on Obsidian 1.5.x; the vision-board layer menu no longer leaks its dismiss listener.

## 中文

### 资料库（[#5](https://github.com/ringeringeraja33/NarrativeCanvas/issues/5)）

- 条目分为人物、地点、物品、设定四类，并支持**自定义分类**：分类页签旁的「+」可新增分类，空的自定义分类可从页签上删除。自定义分类名通过 markdown 的 `category` frontmatter 原名往返——直接在笔记里写一个新分类，资料库会自动出现对应页签。
- 总览是等高封面的名片盒。封面按优先级显示：条目**图标** → **画板缩略快照** → **预览图板布局** → 分类占位；聚焦中的条目带高亮标记。
- 点击卡片进入详情页：左列「被引用的节点」（关系分组默认展开，折叠状态会被记住），右列字段表单，一行一个字段。
- 条目支持**自定义字段**（键值对，作为普通 frontmatter 键双向同步），每个分类还有**字段模板**，预填新条目并补齐同类现有条目。
- 条目可设置**图标**，显示在总览封面、详情页头部和画布节点的资料 chips 上。
- 条目可关联**库文件**（同步到 frontmatter `files` 数组），并可挂多张**预览图**：聚焦视觉板中支持拖动布局、拖角缩放和右键图层菜单（置顶/上移/下移/置底）。
- **原生画板**：「创建画板」生成真正的 Obsidian `.canvas` 文件（现有图片与库文件自动迁入），嵌入条目笔记末尾，并在详情页显示可点击的只读快照（.canvas 外部修改自动刷新，「解除画板」可退回）。托管 markdown 把结构化字段写入 frontmatter，正文保留给自由内容。
- 节点正文输入 `@` 可搜索全部分类并插入基于稳定 ID 的引用；标签为可删除的胶囊并带建议菜单。

### 节点与库文件（[#8](https://github.com/ringeringeraja33/NarrativeCanvas/issues/8)）

- 节点可关联多个库文件：搜索即关联的输入框、打开/移除符号按钮、拖拽把手重排（支持方向键）、画布卡片上的独立 Markdown 预览。图片文件以图片形式预览，卡片行内滑块调节显示大小。框架类节点不带库文件功能。
- **从 Obsidian 文件列表直接拖文件到节点卡片或检查器库文件栏即可关联**，落点有高亮提示。
- 检查器「资料」栏的条目选择为组合框：点击浏览分类分组菜单或输入搜索，完整键盘支持；引用行以拖拽把手重排。

### 画布、演示与应用行为

- 画布单击节点只选中；双击居中到 100% 并进入行内编辑。节点自动高度上限大幅放宽，库文件区不再提前截断。
- 演示预览保留最近 30 张卡片的可滚动记录，按当时变量值渲染并显示关联图片预览；「回到此卡片」一键回溯。前进自动跟随最新卡片，翻阅历史不打断滚动位置。
- AI 助手按钮为可拖动悬浮球，位置会被记住；回顶按钮只在滚动后出现并避开底栏。
- ribbon 按钮按库内项目数量调整行为：多个 `.ncanvas` 弹选择列表、一个直接打开、没有则新建。「文档」页签更名「编辑文档」并移到画布正下方。资料库页签记住上次打开的条目详情。

### 主题隔离与可靠性（[#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7)）

- 插件视图挂载在 **Shadow DOM** 中、样式注入 shadow 内部——社区主题（如 Retroma）再也无法改写或隐藏应用文字，且不依赖任何 `!important` 覆盖；Obsidian 的配色与字体设置仍通过 CSS 变量正常流入，`styles.css` 从约 270 KB 缩减到 2 KB 以内。
- 应用监听自身面板尺寸：折叠 Obsidian 侧栏或拖动分栏立即触发布局重排。
- 修复聚焦视觉板按钮点击无响应、节点卡片库文件标题居中显示的问题；全面审计动画帧回调，焦点/滚动恢复在受限环境下不再间歇失效；网页端缓存参数改为每次构建自动更新。
- Vault 写入在 `vault.process` 不可用时回退到 `vault.modify`，保证 Obsidian 1.5.x 上保存正常；修复视觉板图层菜单的 dismiss 监听泄漏。
