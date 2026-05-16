# pro-workflow/skills/learn-rule/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：74

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: learn-rule
description: Capture a correction or lesson as a persistent learning rule with category, mistake, and correction. Stores, categorises, and retrieves rules for future sessions. Use after mistakes or when the user says "remember this", "don't forget", "note this", or "learn from this".
---

# Learn Rule

Capture a lesson from the current session into permanent memory.

## Trigger

Use when the user says "remember this", "add to rules", "don't do that again", or after a mistake is identified.

## Workflow

1. Identify the lesson — what mistake was made? What should happen instead?
2. Format the rule with full context.
3. Propose the addition and wait for user approval.
4. After approval, persist to LEARNED section or project memory.

## Format

```
[LEARN] Category: One-line rule
Mistake: What went wrong
Correction: How it was fixed
```

### Wiki-scoped rules

Append `Wiki: <slug>` to bind the rule to a single pro-workflow wiki. The rule loads only when that wiki is in scope, avoiding cross-project pollution:

```
[LEARN] Editing: Cite a sources.md row before adding any wiki claim.
Wiki: agent-memory
```

The capture hook auto-detects `Wiki: <slug>` and links the learning to that wiki via `learnings_wiki`.

## Categories

| Category | Examples |
|----------|---------|
| Navigation | File paths, finding code, wrong file edited |
| Editing | Code changes, patterns, wrong approach |
| Testing | Test approaches, coverage gaps, flaky tests |
| Git | Commits, branches, merge issues |
| Quality | Lint, types, style violations |
| Context | When to clarify, missing requirements |
| Architecture | Design decisions, wrong abstractions |
| Performance | Optimization, O(n^2) loops, memory |

## Example

```
Recent mistake: Edited wrong utils.ts file

[LEARN] Navigation: Confirm full path when multiple files share a name.

Add to LEARNED section? (y/n)
```

## Guardrails

- Always wait for user approval before persisting.
- Keep rules to one line — specific and actionable.
- Bad: "Write good code". Good: "Always use snake_case for database columns".
- Include the mistake context so the rule makes sense later.

## Output

- The proposed `[LEARN]` rule with category
- Confirmation after persisting

```
