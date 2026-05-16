# pro-workflow/skills/wiki-builder/templates/prompts/query-and-file.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：12

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Query and file — {{TITLE}}

When a user asks a question that the wiki should answer:

1. Search the wiki via `wiki-query` (FTS5).
2. If a page already covers the answer, cite it directly. Do not duplicate.
3. If coverage is partial, draft an addendum to the existing page.
4. If no coverage, create the appropriate page type (concept/paper/question/...).
5. If still uncertain, file a `question/<slug>.md` and append it as a seed for the research loop (Phase 3.3.1+).

Always echo the answer with citations. Never fabricate citations.

```
