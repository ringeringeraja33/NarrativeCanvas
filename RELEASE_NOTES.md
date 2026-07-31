# Narrative Canvas 1.4.0-beta.1

## English

Thank you to everyone who opened the current issues and shared feature suggestions. The requests covered by these issues remain works in progress, and further bug reports, edge cases, and suggestions are welcome in the corresponding issue threads.

- **Characters has become a project Library for characters, locations, items, and lore.** Entries use searchable category/tag filters, managed Markdown files with editable typed frontmatter, freeform note bodies, ordered node references, grouped backlinks, multiple linked Vault files, and compact image boards. Existing character data migrates without losing cast relations; new projects keep the `.ncanvas` file and `Library` folder together ([#5](https://github.com/ringeringeraja33/NarrativeCanvas/issues/5)).
- **Plugin typography and theme isolation are more reliable.** Content can follow the host font or use system, Cascadia Code, or serif presets; native controls and editor colors are isolated inside the plugin shadow root so themes such as Retroma cannot make text unreadable. Vietnamese and other Latin-script content follows the selected font throughout Play and editing surfaces ([#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7)).
- **The AI launcher stays hidden until endpoint, API key, and model are all configured.** Writers who do not connect an LLM no longer need a CSS snippet to remove it ([#9](https://github.com/ringeringeraja33/NarrativeCanvas/issues/9)).
- **Node-body Markdown now renders beyond Play preview.** Canvas node cards, the Node Inspector body field, and the large editor display formatted bold, italic, strikethrough, headings, quotes, lists, code, highlights, and links instead of raw markers. The inspector and large editor show the rendered result by default; click the content to edit its Markdown source, then click away to return to the rendered view ([#10](https://github.com/ringeringeraja33/NarrativeCanvas/issues/10)).
- **The formatting toolbar now supports a fuller Markdown set:** bold, italic, strikethrough, inline code, highlight (`==`), links, H1/H2/H3 headings, quotes, bullet lists, numbered lists, task lists, code blocks, and dividers. Markdown is escaped before rendering so raw HTML is not passed through.
- **Project tabs are handled more reliably in the plugin.** Duplicate tabs showing the same `.ncanvas` project are consolidated, and clicking an already-open project in the file explorer no longer reloads and flickers the canvas.
- **AI connection compatibility has been broadened.** The same endpoint, API key, and model fields work with OpenAI-compatible chat-completions services; no provider-specific selector or preset is required ([#11](https://github.com/ringeringeraja33/NarrativeCanvas/issues/11)).
- **The optional AI craft primer now covers foundational cinematic practice as well as story structure and character.** Its compact guidance includes staging, composition, point of view, shot scale, motivated camera movement, continuity, editing rhythm, sound, and off-screen space. It remains off by default because enabling it adds context tokens to each AI request ([#12](https://github.com/ringeringeraja33/NarrativeCanvas/issues/12)).
- **The multi-project picker now uses project titles.** Search and primary labels come from each project’s internal title, while the `.ncanvas` path remains visible for disambiguation. A **New project** button in the same picker opens the existing named-project creation flow ([#15](https://github.com/ringeringeraja33/NarrativeCanvas/issues/15)).
- **Versioned project backups are available in the plugin.** Automatic backups are off by default and can be enabled explicitly at a 12- or 24-hour interval; retention is configurable, while manual backup and restore remain available at all times. Backups live in the project’s `Backups` folder; restoring first saves the current canvas and creates a safety snapshot ([#13](https://github.com/ringeringeraja33/NarrativeCanvas/issues/13)).
- **The requested branching-authoring improvements are now covered.** Twee uses standard links for plain transitions; Play lists every available outgoing branch; Choice nodes resize with their connected option layout; an optional 16 px snap grid can align node creation, movement, and resizing; timed Choices can count down to a selected fallback; and node effects accept `if … then … else …` assignments with variable-to-variable values. Runtime JSON, Yarn, Ink, Twee, validation, and Play all preserve the new conditional behavior ([#14](https://github.com/ringeringeraja33/NarrativeCanvas/issues/14)).
- **Shared project files now have collaboration-safe overwrite protection in the plugin.** Changes arriving from Relay, a synced folder, Git, or another editor reload automatically while the local project is clean. If local edits are pending, automatic saving pauses; a save writes the local state into the project’s `Conflicts` folder and leaves the shared `.ncanvas` file untouched. This protects asynchronous team workflows; live cursors and CRDT editing still depend on the external collaboration service ([#16](https://github.com/ringeringeraja33/NarrativeCanvas/issues/16)).

### Known risks in 1.4.0-beta.1

- Managed Library Markdown/frontmatter synchronization, preview-image boards, portable text round-trips, and AI-assisted edits are still evolving. Keep project backups and inspect generated files before replacing source material.
- Shared-file protection prevents a whole-file overwrite and preserves local work in `Conflicts`, but it does not merge simultaneous edits or provide live cursors. Conflict copies require manual review.
- Yarn, Ink, and Twee exports preserve the supported condition, effect, and timed-choice subset. Check the export report and test the result in the target runtime.
- Very large PNG exports can use substantial memory. Provider endpoint and model compatibility can also change independently of Narrative Canvas.

## 中文

感谢提交现有 issue 和功能建议的每一位用户。相关需求仍在持续完善；如果遇到问题、边界情况或有进一步建议，欢迎继续在对应 issue 中反馈。

- **角色页已扩展为项目资料库，统一管理人物、地点、物品和设定。** 资料条目支持分类与标签搜索、可管理的 Markdown 文件、可增删的类型化 frontmatter、独立笔记正文、有序节点引用、分组反链、多个库文件关联和紧凑预览图白板。原有角色数据和演员关系会保留；新项目会把 `.ncanvas` 与 `Library` 文件夹放在同一项目目录中（[#5](https://github.com/ringeringeraja33/NarrativeCanvas/issues/5)）。
- **插件端的字体和主题隔离更加可靠。** 正文可跟随宿主字体，也可选择系统字体、Cascadia Code 或衬线字体；原生控件和编辑器颜色封装在插件 shadow root 内，Retroma 等主题不会再造成文字与背景无法区分。越南语及其他拉丁文字会在演示与编辑界面统一使用所选字体（[#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7)）。
- **只有端点、API key 和模型全部配置后才显示 AI 入口。** 不连接 LLM 的用户无需再通过 CSS 片段隐藏按钮（[#9](https://github.com/ringeringeraja33/NarrativeCanvas/issues/9)）。
- **节点正文 Markdown 的渲染范围从演示预览扩展到编辑界面。** 画布节点卡片、节点检查器正文字段和大编辑器会直接显示加粗、斜体、删除线、标题、引用、列表、代码、高亮和链接，不再显示原始标记。检查器和大编辑器默认呈现渲染结果；点击正文进入 Markdown 源码编辑，移开焦点后恢复渲染视图（[#10](https://github.com/ringeringeraja33/NarrativeCanvas/issues/10)）。
- **格式工具栏支持更完整的 Markdown 语法：** 加粗、斜体、删除线、行内代码、高亮（`==`）、链接、H1/H2/H3 标题、引用、无序列表、有序列表、任务列表、代码块和分隔线。Markdown 会在渲染前转义，不会直接执行原始 HTML。
- **插件端的项目页签处理更加可靠。** 同一 `.ncanvas` 项目的重复页签会自动合并；在文件列表中再次点击已打开项目时，不再重复载入画布或产生闪烁。
- **扩展 AI 接口兼容范围。** OpenAI 兼容的聊天补全服务共用 endpoint、API key 和模型字段，无需服务商专用选择器或预设（[#11](https://github.com/ringeringeraja33/NarrativeCanvas/issues/11)）。
- **可选的 AI 创作知识现在覆盖电影化叙事基础。** 在故事结构和人物塑造之外，精简提示还包含场面调度、构图、视点、景别、有动机的摄影机运动、空间连续性、剪辑节奏、声音和画外空间。该功能仍默认关闭，因为开启后会增加每次 AI 请求的上下文 token（[#12](https://github.com/ringeringeraja33/NarrativeCanvas/issues/12)）。
- **多项目选择器改用项目标题。** 搜索范围和主标签读取项目内部标题，同时保留 `.ncanvas` 路径用于区分同名项目；同一窗口新增“新建项目”按钮，可直接进入已有的命名新建流程（[#15](https://github.com/ringeringeraja33/NarrativeCanvas/issues/15)）。
- **插件端新增项目版本备份。** 自动备份默认关闭，用户可自行开启并选择每 12 或 24 小时执行；保留数量可调，立即备份和恢复始终可用。备份存放在项目的 `Backups` 文件夹中；恢复前会先保存当前画布并创建安全快照（[#13](https://github.com/ringeringeraja33/NarrativeCanvas/issues/13)）。
- **补齐分支创作相关改进。** Twee 的普通跳转改用标准链接；演示模式会列出全部可用出线；Choice 节点可随选项布局联动调整尺寸；可选的 16 px 网格吸附覆盖节点新建、移动和缩放；定时 Choice 可倒计时并跳到指定后备分支；节点效果支持带变量引用的 `if … then … else …` 赋值。Runtime JSON、Yarn、Ink、Twee、状态校验和演示模式都会保留新的条件逻辑（[#14](https://github.com/ringeringeraja33/NarrativeCanvas/issues/14)）。
- **插件端为共享项目文件加入协作安全保护。** Relay、同步文件夹、Git 或其他编辑器写入的新版本，会在本地没有改动时自动重新加载；如有未保存改动，自动保存会暂停，手动保存会把本地状态写入项目的 `Conflicts` 文件夹，同时保留共享 `.ncanvas` 文件。该能力保护异步团队工作流；多人光标和 CRDT 同步仍由外部协作服务提供（[#16](https://github.com/ringeringeraja33/NarrativeCanvas/issues/16)）。

### 1.4.0-beta.1 已知风险

- 资料库 Markdown/frontmatter 同步、预览图白板、可迁移文本往返和 AI 修改仍在迭代。请保留项目备份，并在替换源材料前检查生成文件。
- 共享文件保护可阻止整文件覆盖，并将本地内容保存在 `Conflicts` 中，但不会合并同时发生的修改，也不提供多人实时光标；冲突副本需要人工检查。
- Yarn、Ink 和 Twee 仅保留当前支持范围内的条件、效果和定时选项。请查看导出报告，并在目标运行时中测试结果。
- 超大 PNG 导出可能占用较多内存。服务商 endpoint 和模型兼容性也可能独立变化。
