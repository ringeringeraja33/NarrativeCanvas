# Narrative Canvas 1.3.3

## English

- The Play preview now **renders the Markdown** produced by the node editor's formatting toolbar — bold, italic, strikethrough, `##`/`###` headings, `>` quotes, and `-` bullet lists show as formatted text for the reader instead of literal markers ([#10](https://github.com/ringeringeraja33/NarrativeCanvas/issues/10)). The markup is escaped before conversion, so no raw HTML passes through; node bodies remain plain text in the inspector and exports.
- Fixed a CI-only smoke-test timeout in the large-editor check.

## 中文

- 演示预览现在会**渲染节点编辑器格式工具栏生成的 Markdown**——加粗、斜体、删除线、`##`/`###` 标题、`>` 引用和 `-` 无序列表会以格式化文本呈现给读者，而不再显示字面标记（[#10](https://github.com/ringeringeraja33/NarrativeCanvas/issues/10)）。标记会先转义再转换，不会有原始 HTML 通过；节点正文在检查器和导出中仍为纯文本。
- 修复大编辑器检查在 CI 环境下的冒烟测试超时。
