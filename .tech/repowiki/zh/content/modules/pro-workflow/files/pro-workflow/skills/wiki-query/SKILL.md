# pro-workflow/skills/wiki-query/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：73

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: wiki-query
description: Query pro-workflow wikis via SQLite FTS5 BM25 retrieval. Returns top-K passages with citations. Use when answering a question that any of the user's wikis already covers, when the user says "what does the wiki say about X", "ask wiki", "search wikis", or before drafting a new wiki page (to avoid duplication).
---

# Wiki Query

FTS5 BM25 retrieval over wiki pages indexed by `wiki-builder`.

## When to use

- Before writing any new wiki page → check coverage first
- User asks a domain question that may already live in a wiki
- "Ask the <slug> wiki: <question>"
- Verifying citations before quoting a claim
- `SessionStart` auto-load when prompt matches a known wiki topic

## Commands

```
node $SKILL_ROOT/scripts/query.js search "<query>" [--wiki <slug>] [--limit 10] [--json]
node $SKILL_ROOT/scripts/query.js related <slug> <rel-path> [--limit 5]
node $SKILL_ROOT/scripts/query.js show <slug> <rel-path>
```

`search` with no `--wiki` ranks across all wikis. `related` finds adjacent pages by reusing the page's title + summary as the query.

## Output

JSON-friendly. Each hit:

```
{
  "page_id": 12,
  "wiki_slug": "agent-memory",
  "rel_path": "wiki/concepts/episodic-memory.md",
  "title": "Episodic Memory",
  "snippet": "... [time-stamped] traces, distinct from semantic ...",
  "rank": -3.21
}
```

Lower (more negative) rank = better BM25 match.

## Citing back

Every wiki hit must be cited as:

```
[wiki:<slug>] <title> — `<rel_path>`
```

Do not paraphrase a hit without showing the source.

## SessionStart integration

When `pro-workflow`'s SessionStart hook detects wiki-relevant terms in the user prompt, it runs `query.js search "<prompt>" --limit 3` and injects top hits into the session as a hint:

```
[wiki-query] 3 relevant pages:
- agent-memory · wiki/concepts/episodic-memory.md
- agent-memory · wiki/papers/park-2023-generative-agents.md
- ...
```

Helps Claude recall existing knowledge instead of redoing research.

## Limits (Phase 3.3.0)

- BM25 only. Vector search arrives 3.3.2 with sqlite-vec.
- No re-ranking. MMR diversity arrives with the research loop in 3.3.1.
- Snippet window is 16 tokens around match — tune via `--snippet-len`.

```
