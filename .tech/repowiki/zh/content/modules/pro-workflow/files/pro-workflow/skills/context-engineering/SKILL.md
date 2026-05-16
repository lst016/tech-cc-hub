# pro-workflow/skills/context-engineering/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：157

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: context-engineering
description: Master the four operations of context engineering — Write, Select, Compress, Isolate. Manage token budgets, compaction strategies, and context partitioning to keep AI sessions sharp and efficient.
---

# Context Engineering

Four operations control everything about how context flows through an AI coding session. Master them and you control the quality of every response.

## The Four Operations

### 1. Write — Persist Info Outside Context

Move information out of the context window into durable storage so it survives compaction and session boundaries.

**Where to write:**

| Target | When | Example |
|--------|------|---------|
| CLAUDE.md | Permanent project rules | "Always use pnpm, never npm" |
| NOTES.md / scratchpad | Working state for current task | Architecture decisions, open questions |
| `.claude/memory/` | Learnings and patterns | `[LEARN]` rules from corrections |
| External files | Data too large for context | Test plans, migration checklists |

**Pattern — Scratchpad workflow:**
```text
1. Start complex task → create NOTES.md with goals and constraints
2. After research → write findings to NOTES.md
3. After compaction → NOTES.md survives, context does not
4. Resume → read NOTES.md to recover full state
```

### 2. Select — Retrieve Relevant Info

Pull the right information into context at the right time. Precision matters more than volume.

**Methods ranked by precision:**

1. `@file` references — exact file injection
2. `grep` / `Glob` — targeted pattern search
3. Subagent exploration — delegated deep search
4. RAG / embeddings — semantic retrieval for large codebases

**Key principle: Focused 300 tokens > unfocused 113K tokens.**

A surgical grep result that returns the exact function signature beats dumping an entire module into context. Every irrelevant token dilutes attention.

**Pattern — Progressive retrieval:**
```text
1. Start with file names (Glob)
2. Narrow to specific functions (Grep)
3. Read only the relevant lines (Read with offset+limit)
4. Never read entire large files when you need one function
```

### 3. Compress — Reduce Tokens, Preserve Signal

Shrink context without losing the information that matters.

**Compaction strategies:**

| Strategy | How | When |
|----------|-----|------|
| `/compact` with focus | `/compact focus: auth module changes` | Task boundaries |
| Microcompact | Ask Claude to summarize tool output inline | After large reads/searches |
| Head+tail | Read first 20 + last 20 lines of large output | Log analysis, test results |
| Tool result clearing | Subagent results auto-clear after reporting | Heavy exploration |
| Semantic selection | Summarize findings, discard raw data | Research phases |

**Compaction triggers:**

- After planning, before implementation
- After completing a feature or milestone
- When context exceeds 50% (set `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50`)
- Before switching task domains
- After heavy search/read operations

**PostCompact hook — Re-inject critical context:**
```json
{
  "type": "PostCompact",
  "command": "cat .claude/critical-context.md"
}
```

Use this to ensure project rules, current task state, or architecture constraints survive every compaction.

### 4. Isolate — Partition Across Execution Spaces

Don't load everything into one context. Split work across independent execution spaces.

| Method | Isolation Level | Use When |
|--------|----------------|----------|
| Subagents | Forked context | Heavy exploration, test runs, doc generation |
| Worktrees (`claude -w`) | Full repo copy | Parallel features, competing approaches |
| `/btw` (built-in Claude Code) | Temporary overlay | Quick questions without entering conversation history |
| Agent teams | Independent sessions | Cross-layer changes, parallel reviews |
| Fresh session (`/resume`) | Clean slate | Unrelated work, degraded context |

**Pattern — Subagent delegation:**
```text
Main session: planning, coordination, commits
Subagent 1: explore auth module, report findings
Subagent 2: run test suite, report failures
Subagent 3: generate migration script
```

Main context stays clean. Subagents handle the volume.

## Context Budget Planning

Exa
... (truncated)
```
