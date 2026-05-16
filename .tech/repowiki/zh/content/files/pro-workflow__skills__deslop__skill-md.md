# pro-workflow/skills/deslop/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：56

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: deslop
description: Remove AI-generated code slop, unnecessary comments, and over-engineering from the current branch diff. Cleans up boilerplate, simplifies abstractions, and strips defensive code. Use when cleaning up code, simplifying, removing boilerplate, or before committing.
---

# Remove AI Code Slop

Check the diff against main and remove AI-generated slop introduced in the branch.

## Trigger

Use after completing changes, before committing, or when code feels over-engineered.

## Commands

```bash
git fetch origin main
git diff origin/main...HEAD --stat
git diff origin/main...HEAD
```

## Workflow

1. Run diff commands to see all changes on the branch.
2. Identify slop patterns from the focus areas below.
3. Apply minimal, focused edits to remove slop.
4. Re-run `git diff origin/main...HEAD` to verify only slop was removed.
5. Run tests or type-check to confirm behaviour unchanged: `npm test -- --changed --passWithNoTests 2>&1 | tail -10`
6. Summarise what was cleaned.

## Focus Areas

- Extra comments that state the obvious or are inconsistent with local style
- Defensive try/catch blocks that are abnormal for trusted internal code paths
- Casts to `any` used only to bypass type issues
- Over-engineered abstractions for one-time operations (premature helpers, factories)
- Deeply nested code that should be simplified with early returns
- Backwards-compatibility hacks (renamed `_vars`, re-exports, `// removed` comments)
- Features, refactoring, or "improvements" beyond what was requested
- Added docstrings, type annotations, or comments on code that wasn't changed
- Error handling for scenarios that can't happen in trusted internal paths

## Guardrails

- Keep behavior unchanged unless fixing a clear bug.
- Prefer minimal, focused edits over broad rewrites.
- Three similar lines of code is better than a premature abstraction.
- If you remove something, verify it's truly unused first.
- Keep the final summary concise (1-3 sentences).

## Output

- List of slop patterns found with file locations
- Edits applied
- One-line summary of what was cleaned

```
