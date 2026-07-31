# Narrative Canvas 1.4.1

## English

Narrative Canvas 1.4.1 expands multi-system story authoring, adds engine-oriented rich text and export formats, and fixes several Play and interface consistency issues found after 1.4.0.

- **One canvas can now contain multiple playable Entry nodes.** When more than one Entry exists, Play opens a system picker so the player can choose which storyline or subsystem to enter. Story includes the graph reachable from every Entry, while a single Entry still starts immediately as before.
- **The Play system picker now stays synchronized with the canvas.** Deleting an Entry immediately removes it from an already-open picker, and stale or invalid entries cannot be launched.
- **Link labels can be edited directly on the canvas.** Double-click a link or its existing label, type the new name, and press Enter or click away to save. Escape cancels, and an empty value clears the label. Choice-link labels remain synchronized with their bound Choice options.
- **Rich-text authoring now supports five target languages:** Markdown, HTML, Unity TextMeshPro, Godot / Ren'Py BBCode, and Unreal RichTextBlock. The language can be changed from Narrative Canvas plugin settings or the expanded editor. Switching formats converts existing node bodies, dialog lines, and project notes.
- **The expanded-editor toolbar adapts completely to the selected language.** Bold, italic, strikethrough, inline code, links, headings, quotes, lists, tasks, code blocks, dividers, text color, and highlight color now emit target-specific markup and display matching syntax hints.
- **Engine-oriented exports have been expanded.** Godot projects can export a Dialogic 2 `.dtl` timeline, and Unreal projects can export a CommonConversation-oriented `.conversation.json` adapter payload. Yarn Spinner and Ink remain the primary narrative-script targets for Unity integrations.
- **Rich-text previews are safer and clearer.** HTML preview is sanitized, Unreal markup uses `NC*` style/decorator tags for importer-side mapping, and highlighted text has improved contrast in dark themes.
- **Interface polish fixes localized controls and removes duplicate settings.** Hidden-node “Show” buttons stay on one line in narrow sidebars, and the redundant rich-text selector was removed from the in-canvas Project panel.

### Notes and limitations

- Rich-text conversion preserves the formatting supported by Narrative Canvas. Custom or engine-specific markup outside that shared subset may require manual review after conversion; keep a project backup before converting a large existing project.
- Unreal conversation graphs are assets rather than a universal standalone script format. The exported adapter JSON requires a matching Editor Utility, plugin, or custom importer.
- Dialogic and Unreal exports preserve supported routes, choices, conditions, and state operations. Review the export report and test generated content in the target engine.

## 中文

Narrative Canvas 1.4.1 扩展了多系统叙事创作、面向游戏引擎的富文本与导出能力，并修复 1.4.0 发布后发现的演示和界面一致性问题。

- **一个画布现在可以包含多个可演示的 Entry 节点。** 检测到多个 Entry 时，点击“演示”会先打开系统选择器，让玩家选择进入哪条故事线或子系统；“故事”会合并展示从所有 Entry 可到达的结构。只有一个 Entry 时仍会像以前一样直接开始。
- **演示系统选择器会与画布实时同步。** 删除 Entry 后，已经打开的候选列表会立即移除对应项目；失效或已经删除的入口也无法被启动。
- **连线标签可以直接在画布中编辑。** 双击连线或已有标签即可输入名称；按 Enter 或点击其他位置保存，Esc 取消，留空则清除标签。Choice 连线的标签仍会与绑定的 Choice 选项同步。
- **富文本创作新增五种目标语言：** Markdown、HTML、Unity TextMeshPro、Godot / Ren'Py BBCode、Unreal RichTextBlock。可在 Narrative Canvas 插件设置或大编辑弹窗中切换；切换时会转换当前项目已有的节点正文、对话台词和项目备注。
- **大编辑器的整条工具栏会随目标语言适配。** 加粗、斜体、删除线、行内代码、链接、标题、引用、列表、任务、代码块、分隔线、字色和高亮色都会写入对应语言的标记，并显示相应语法提示。
- **扩展面向引擎的导出能力。** Godot 可导出 Dialogic 2 `.dtl` timeline；Unreal 可导出面向 CommonConversation 的 `.conversation.json` 适配数据。Unity 集成仍以 Yarn Spinner 和 Ink 作为主要剧情脚本目标。
- **富文本预览更加安全清晰。** HTML 会在预览前进行安全过滤；Unreal 使用 `NC*` 样式 / Decorator 标签供 importer 映射；深色主题下的高亮文字对比度也得到改善。
- **界面细节进一步整理。** 窄侧栏中的隐藏节点“显示”按钮不再折成两行，并移除了画布项目面板里重复的富文本语言入口。

### 注意事项与限制

- 富文本转换会保留 Narrative Canvas 支持的格式。超出公共转换范围的自定义或引擎专用标记可能需要转换后人工检查；对大型现有项目转换前建议先创建备份。
- Unreal 对话图属于 Asset，并不存在统一的独立脚本格式；导出的适配 JSON 需要配套 Editor Utility、插件或自定义 importer。
- Dialogic 与 Unreal 导出会保留当前支持范围内的路线、选项、条件和状态操作。请查看导出报告，并在目标引擎中测试生成内容。
