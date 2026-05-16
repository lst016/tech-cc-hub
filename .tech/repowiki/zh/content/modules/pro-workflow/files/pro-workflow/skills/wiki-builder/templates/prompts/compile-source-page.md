# pro-workflow/skills/wiki-builder/templates/prompts/compile-source-page.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：17

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Compile source page — {{TITLE}}

Given a single source (paper, blog, video transcript, doc), produce `wiki/<type>/<slug>.md` with:

1. **Front-matter**: title, source_id, page_type, last_verified.
2. **One-paragraph TL;DR** in plain language.
3. **Key claims** as bulleted list, each suffixed `[^src-id]`.
4. **Method / argument summary** — what the source actually does, not editorial.
5. **Open questions raised** — feed back into wiki seeds.
6. **Cross-links** — relative links to existing pages in this wiki when topics overlap.

Rules:
- Never paraphrase without citing.
- Never copy long verbatim quotes. Two sentences max per quote.
- If source is paywalled or `private: true`, skip web verification.
- Mark inferences with `> SPECULATION:`.

```
