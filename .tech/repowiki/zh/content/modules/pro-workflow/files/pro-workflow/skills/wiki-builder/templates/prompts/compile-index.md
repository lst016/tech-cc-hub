# pro-workflow/skills/wiki-builder/templates/prompts/compile-index.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：17

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Compile index — {{TITLE}}

Refresh `wiki/index.md` so it stays the entry point.

1. List sections by type (concepts, papers, questions...).
2. Within each section, link pages alphabetically by slug.
3. Surface 3-5 "open questions" pulled from `question/` pages with status `open`.
4. Top of file: 2-line orientation paragraph.
5. Bottom: link to `sources.md` and `logs/maintenance-log.md`.

Never delete user prose at the top; only update the generated section bounded by:
```
<!-- BEGIN GENERATED INDEX -->
...
<!-- END GENERATED INDEX -->
```

```
