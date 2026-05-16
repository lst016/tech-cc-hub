# pro-workflow/skills/pro-workflow/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：562

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: pro-workflow
description: Complete AI coding workflow system. Orchestration patterns, 18 hook events, 5 agents, cross-agent support, reference guides, and searchable learnings. Works with Claude Code, Cursor, and 32+ agents.
---

# Pro Workflow

Complete AI coding workflow system from production use. Orchestration patterns, reference guides, and battle-tested habits that compound over time.

**Works with:** Claude Code, Cursor, Codex, Gemini CLI, and 32+ AI coding agents via SkillKit. Sections marked *(Claude Code)* use features specific to Claude Code — Cursor users can skip those or use the noted alternatives.

## The Core Insight

> "80% of my code is written by AI, 20% is spent reviewing and correcting it." — Karpathy

This skill optimizes for that ratio. Every pattern here reduces correction cycles.

---

## 1. The Self-Correction Loop

**The single most powerful pattern.** Your CLAUDE.md trains itself through corrections.

### How It Works

When you correct Claude:
1. Claude acknowledges the mistake
2. Proposes a rule to prevent it
3. You approve → rule goes into memory
4. Future sessions avoid the same mistake

### Add to CLAUDE.md

```markdown
## Self-Correction Protocol

When the user corrects me or I make a mistake:
1. Acknowledge specifically what went wrong
2. Propose a concise rule: `[LEARN] Category: One-line rule`
3. Wait for approval before adding to LEARNED section

### LEARNED
<!-- Auto-populated through corrections -->
```

### Trigger Phrases

- "Add that to your rules"
- "Remember this"
- "Don't do that again"

### Example Flow

```text
User: You edited the wrong file
Claude: I edited src/utils.ts when you meant src/lib/utils.ts.

[LEARN] Navigation: Confirm full path before editing files with common names.

Should I add this?
```

---

## 1b. Pre-Flight Discipline

**Self-correction catches mistakes after the fact. This catches them before.**

Karpathy's [observations on LLM coding pitfalls](https://x.com/karpathy/status/2015883857489522876) name the upstream failures: silent assumptions, overcomplicated diffs, drive-by edits, vague success criteria. Four rules prevent each one.

| Rule | Prevents |
|------|----------|
| **Surface, don't assume** | Wrong interpretation, hidden confusion, missing tradeoffs |
| **Minimum viable code** | 200-line diffs that should be 50, speculative abstractions |
| **Stay in your lane** | Drive-by refactors, "improvements" to adjacent code |
| **Verifiable goals** | Endless re-clarification, "make it work" loops |

Full rules in `rules/pre-flight-discipline.mdc` (`alwaysApply: true`). Pairs with self-correction: pre-flight stops the mistake, self-correction captures the lesson when one slips through.

### Add to CLAUDE.md

```markdown
## Pre-Flight Discipline
Before coding: state assumptions, present ambiguity, push back if simpler exists.
Every changed line traces to the request - no drive-by edits.
Convert imperatives to verifiable goals: "fix bug" → "failing test → make it pass".
```

---

## 2. Parallel Sessions with Worktrees

**Zero dead time.** While one Claude thinks, work on something else.

### Setup

**Claude Code:**
```bash
claude --worktree    # or claude -w (auto-creates isolated worktree)
```

**Cursor / Any editor:**

```bash
git worktree add ../project-feat feature-branch
git worktree add ../project-fix bugfix-branch
```

### Background Agent Management *(Claude Code)*

- `Ctrl+F` — Kill all background agents (two-press confirmation)
- `Ctrl+B` — Send task to background
- Subagents support `isolation: worktree` in agent frontmatter

### When to Parallelize

| Scenario | Action |
|----------|--------|
| Waiting on tests | Start new feature in worktree |
| Long build | Debug issue in parallel |
| Exploring approaches | Try 2-3 simultaneously |

### Add to CLAUDE.md

```markdown
## Parallel Work
When blocked on long operations, use `claude -w` for instant parallel sessions.
Subagents with `isolation: worktree` get their own safe working copy.
```

---

## 3. The Wrap-Up Ritual

End sessions with intention. Capture learnings, verify state.

### /wrap-up Checklist

1. **Changes Audit** - List modified files, uncommitted changes
2. **State Check** -
... (truncated)
```
