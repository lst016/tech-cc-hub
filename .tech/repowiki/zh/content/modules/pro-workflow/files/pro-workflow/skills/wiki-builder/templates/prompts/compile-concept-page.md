# pro-workflow/skills/wiki-builder/templates/prompts/compile-concept-page.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：16

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Compile concept page — {{TITLE}}

Synthesize a single idea across multiple sources. Output `wiki/concepts/<slug>.md`:

1. **One-line definition** that future-you will trust.
2. **Why it matters** — when this concept changes a decision.
3. **Variants / related concepts** with cross-links.
4. **Evidence** — bulleted claims `[^src-id]`, multi-source where possible.
5. **Counter-evidence** — claims that contradict, also cited.
6. **Status**: `stable | contested | speculative`.

Rules:
- A concept page that cites only one source is suspect; flag in the page header.
- Prefer multi-source synthesis over single-source restatement.
- Link to relevant `paper/<key>.md` pages instead of restating the paper.

```
