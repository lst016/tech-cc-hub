# pro-workflow/skills/parallel-worktrees/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：90

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: parallel-worktrees
description: Create and manage git worktrees for parallel coding sessions with zero dead time. Use when blocked on tests, builds, wanting to work on multiple branches, context switching, or exploring multiple approaches simultaneously.
---

# Parallel Worktrees

Zero dead time. While one session runs tests, work on something else.

## Trigger

Use when waiting on tests, long builds, exploring approaches, or needing to review and develop simultaneously.

## Quick Start

**Claude Code:**
```bash
claude --worktree    # or claude -w (auto-creates isolated worktree)
```

**Cursor / Any editor:**
```bash
git worktree add ../project-feat feature-branch
# Open the new worktree folder in a second editor window
```

Both approaches create an isolated working copy where changes don't interfere with your main session.

## Claude Code Extras

These features are Claude Code-specific (skip if using Cursor):

- `claude -w` auto-creates and cleans up worktrees
- Subagents support `isolation: worktree` in agent frontmatter
- `Ctrl+F` kills all background agents (two-press confirmation)
- `Ctrl+B` sends a task to background

## Workflow

1. Show current worktrees: `git worktree list`
2. Create a worktree for the parallel task.
3. Open a new editor/terminal session in the worktree.
4. When done, clean up the worktree.

## Commands

```bash
git worktree list

git worktree add ../project-feat feature-branch
git worktree add ../project-fix bugfix-branch
git worktree add ../project-exp -b experiment

git worktree remove ../project-feat
git worktree prune
```

## Usage Pattern

```
Terminal 1: ~/project          → Main work
Terminal 2: ~/project-feat     → Feature development
Terminal 3: ~/project-fix      → Bug fixes
```

Each worktree runs its own AI session independently.

## When to Parallelize

| Scenario | Action |
|----------|--------|
| Tests running (2+ min) | Start new feature in worktree |
| Long build | Debug issue in parallel |
| Exploring approaches | Compare 2-3 simultaneously |
| Review + new work | Reviewer in one, dev in other |
| Waiting on CI | Start next task in worktree |

## Guardrails

- Each worktree is a full working copy — changes are isolated.
- Before removing a worktree, verify changes are committed: `git -C ../project-feat status`
- Don't forget to clean up worktrees when done (`git worktree prune`).
- Avoid editing the same files in multiple worktrees simultaneously.

## Output

- Current worktree list
- Created worktree path and branch
- Instructions for opening a new session

```
