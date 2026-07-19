# Narrative Canvas 1.2.9

## English

- Dialog nodes can now be split after any selected turn. The new second node preserves the original outgoing connections and relevant node data, while a direct connection is created between both parts. Resolves [#6](https://github.com/ringeringeraja33/NarrativeCanvas/issues/6).
- Dialog turns in the inspector can now be collapsed to reduce visual clutter.
- Added configurable narrative-content fonts, including following the host application, system fonts, Cascadia Code, and a classic serif option. Vietnamese text and other extended Latin characters now use fonts with suitable glyph coverage. Resolves [#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7).
- Improved light-theme contrast for hidden-node labels and canvas statistics.
- Fixed the radial Add menu remaining open after choosing an item, and removed its host focus outline.
- Strengthened form-control and theme-style isolation in the plugin interface.

## 中文

- 对话节点现在可以在任意选定轮次后拆分。新生成的后半节点会继承原有出站连线和相关节点数据，两个节点之间会自动建立直接连线。解决 [#6](https://github.com/ringeringeraja33/NarrativeCanvas/issues/6)。
- 检查器中的“对话轮次”现在可以折叠，方便整理较长对话。
- 新增叙事内容字体设置，可选择跟随宿主应用、系统字体、Cascadia Code 或经典衬线字体；越南语及其他扩展拉丁字符现在会使用具备完整字形覆盖的字体。解决 [#7](https://github.com/ringeringeraja33/NarrativeCanvas/issues/7)。
- 提高浅色主题下隐藏节点标签和画布统计数字的对比度。
- 修复环形“添加”菜单选择项目后仍然显示的问题，并移除宿主样式产生的矩形焦点框。
- 加强插件界面对原生表单控件和宿主主题样式的隔离。
