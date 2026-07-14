# Narrative Canvas 1.2.2

Compared with GitHub release `1.2.1`.

## English

### Improved

- Nodes reached from a Choice branch now show the originating option above the card title as a luminous `Choice: option text` cue. The cue follows the interface language, supports multiple Choice branches converging on one node, and resolves stable option bindings before legacy link labels.
- Choice option text can now be edited directly inside the Choice card. Typing keeps focus in place; Enter or blur commits the edit, Escape restores the original text, and connected link labels and successor cues update together.

## 中文

### 改进

- Choice 分支的后续节点会在卡片标题上方显示带辉光的“选择：选项文本”提示。提示随界面语言切换；多个 Choice 分支汇入同一节点时会全部显示，并优先通过稳定选项绑定解析文字，兼容旧连线标签。
- Choice 卡片中的选项文字可直接原位编辑。输入时保持焦点，回车或失焦提交，Esc 恢复原文字；关联连线标签和后续节点提示会同步更新。
