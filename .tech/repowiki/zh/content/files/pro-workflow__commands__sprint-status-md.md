# pro-workflow/commands/sprint-status.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：51

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Show status across active parallel sessions
---

# /sprint-status - Parallel Session Tracker

Report status across all active Claude Code sessions.

## Process

1. **Detect active sessions:**
   ```bash
   pgrep -af "claude" | grep -v "$$" | head -10
   git worktree list 2>/dev/null
   ls $TMPDIR/pro-workflow/sessions/ 2>/dev/null | tail -5
   ```

2. **Report current session:**
   ```text
   SESSION: <project> | branch: <branch> | task: <current task>
   STATUS: COMPLETE | COMPLETE_WITH_NOTES | BLOCKED | NEEDS_INFO
   ```

3. **Compile sprint view** (if multiple sessions detected):
   ```text
   SPRINT STATUS
     Session 1: feat/auth       STATUS: COMPLETE         (ready to merge)
     Session 2: feat/upload     STATUS: BLOCKED          (waiting on S3 creds)
     Session 3: fix/login-bug   STATUS: COMPLETE_WITH_NOTES (needs perf review)
   ```

## Status Definitions

| Status | Meaning |
|--------|---------|
| `COMPLETE` | Done, ready to commit or merge |
| `COMPLETE_WITH_NOTES` | Done, but flagging observations |
| `BLOCKED` | Cannot proceed, needs input or external dep |
| `NEEDS_INFO` | Missing context, asking before guessing |

## When to Use

- Before switching between terminal tabs/sessions
- At the end of a work phase
- When asking "where was I?"
- To orient after being away

---

**Trigger:** Use when running parallel sessions, resuming work, or wanting a quick snapshot of progress across branches.

```
