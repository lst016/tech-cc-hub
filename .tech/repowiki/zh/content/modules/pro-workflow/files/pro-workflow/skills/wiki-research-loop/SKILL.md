# pro-workflow/skills/wiki-research-loop/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：145

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: wiki-research-loop
description: Auto-grow a pro-workflow wiki by running a budget-capped BFS research loop over pluggable source fetchers (web, arXiv, GitHub). Each iteration pops a seed from the queue, fetches sources, drafts a wiki page, dedupes claims against existing pages, enqueues follow-up seeds. Halts on budget cap, depth cap, or convergence. Use when the user says "research <topic>", "grow the <slug> wiki", "auto-research", or wants a knowledge base that builds itself overnight.
---

# Wiki Research Loop

Driver that turns a wiki into an auto-grown knowledge base. Layers on top of `wiki-builder` and `wiki-query`.

## Loop semantics

```
seed-queue (pending) → next-seed
  → fetch sources via plugins (web | arxiv | github)
  → extract claims
  → dedupe vs index (FTS5; later vector via 3.3.2)
  → compile new page or amend existing
  → upsert page (auto-FTS-index)
  → enqueue follow-up seeds (max-depth gate)
  → mark seed done
  → if budget OR convergence OR kill-switch → halt
```

## Halt conditions (any one trips)

- `budget_usd` exceeded (loop tracks per-fetcher cost estimate)
- `max_pages_per_run` written
- `max_depth` reached on every active branch
- 3 consecutive pages add < 5 % new claims (convergence)
- File `~/.pro-workflow/STOP` exists (operator kill-switch)
- `wiki.config.md` `auto_research.enabled: false`
- Wiki `private: true` AND any non-local fetcher selected

## Commands

```
node $SKILL_ROOT/scripts/research-loop.js run <slug> [--max-pages N] [--max-depth N] [--budget-usd 0.50] [--fetchers web,arxiv,github]
node $SKILL_ROOT/scripts/research-loop.js seed <slug> "<query>" [--depth 0] [--parent-id N]
node $SKILL_ROOT/scripts/research-loop.js seeds <slug> [--status pending|active|done|failed]
node $SKILL_ROOT/scripts/research-loop.js cancel <slug>
node $SKILL_ROOT/scripts/research-loop.js status
```

CLI flags override `wiki.config.md` for one run only.

## Source fetchers

Pluggable. Each lives at `scripts/source-fetchers/<name>.js`. Interface:

```js
module.exports = {
  name: 'web',
  match: (q) => true,                       // is this fetcher useful?
  estimateCost: (q) => ({ usd: 0, tokens: 0 }),
  fetch: async (q, opts) => [               // returns RawDoc[]
    { url, title, content, fetched_at }
  ]
};
```

Built-in:
- **`web.js`** — Fetches via the user's available `WebFetch` tool through a stdin/stdout shim. Treats result as plain text/markdown.
- **`arxiv.js`** — `https://export.arxiv.org/api/query` (free, public, no key). Returns abstract + metadata.
- **`github.js`** — `https://api.github.com/search/repositories` + README pull (uses `GH_TOKEN` if set, otherwise unauthenticated rate limit).

Drop a new file in `~/.pro-workflow/fetchers/<name>.js` to add a custom fetcher. Loaded at startup if present.

## Budget enforcement

Pre-iteration: sum `estimateCost` across selected fetchers. If projected cumulative cost would exceed `budget_usd`, halt.

Post-iteration: track tokens used by the LLM compile step (Anthropic/OpenAI passthrough). Hard-kill on overrun.

Per-fetcher overrides via env: `WIKI_LOOP_BUDGET_USD`, `WIKI_LOOP_MAX_PAGES`, `WIKI_LOOP_MAX_DEPTH`.

## Seed queue

SQLite-backed via `wiki_seeds` table:

| field | meaning |
|-------|---------|
| `query` | natural-language seed |
| `status` | `pending` → `active` → `done`\|`failed` |
| `parent_id` | seed that produced this one |
| `depth` | BFS depth from root |

Loop pops by `(depth ASC, created_at ASC)` so it explores breadth-first.

## Convergence detection

After each compiled page, compute Jaccard overlap of claim-text tokens vs the prior 3 pages. If `< 5 %` novel content for 3 consecutive pages, halt and report `converged`.

## Kill switch

```
touch ~/.pro-workflow/STOP
```

Loop checks per-iteration and halts gracefully. Remove file to resume next run.

## Privacy guard

If `wiki.config.md` has `private: true`, the loop refuses any non-local fetcher and emits a warning. Only `raw/` ingestion via manual seeds is allowed.

## Reactive trigger (Phase 3.3.4)

`scripts/file-watcher.js` watches `wiki/<slug>/wiki/**/*.md`. On user-edited claim, enqueues a verification seed (`verify: <claim>`) at depth 0. Wired through pro-workfl
... (truncated)
```
