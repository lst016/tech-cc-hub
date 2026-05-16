# pro-workflow/commands/safe-mode.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：71

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Prevent destructive operations — cautious (warn), lockdown (restrict edits), or clear
argument-hint: <cautious | lockdown <path> | clear>
---

# /safe-mode - Destructive Operation Protection

Guard against accidental damage during AI coding sessions.

## Usage

### Cautious Mode
```text
/safe-mode cautious
```
Intercepts Bash commands and warns before destructive operations:
- `rm -rf`, `DROP TABLE`, `TRUNCATE`
- `git push --force`, `git reset --hard`, `git clean -f`
- `chmod 777`, `curl|sh`

Warns on stderr. You decide whether to proceed.

### Lockdown Mode
```text
/safe-mode lockdown src/api/
```
Restricts Edit/Write operations to the specified directory. Blocks changes to files outside the path.

Session-scoped. Prevents accidental edits to unrelated code during focused work.

### Both Together
```text
/safe-mode cautious
/safe-mode lockdown src/api/
```
Bash warnings + directory restriction simultaneously.

### Clear All
```text
/safe-mode clear
```
Removes all restrictions for the current session.

## Status Check

Report current safe-mode state:
```text
SAFE MODE STATUS
  Cautious: ACTIVE (warns on destructive Bash commands)
  Lockdown: ACTIVE (restricted to src/api/)
```

Or:
```text
SAFE MODE STATUS
  No restrictions active.
```

## When to Use

| Situation | Command |
|-----------|---------|
| Production-adjacent code | `/safe-mode cautious` |
| Focused refactoring | `/safe-mode lockdown <path>` |
| Unfamiliar codebase | `/safe-mode cautious` |
| Done with restrictions | `/safe-mode clear` |

---

**Trigger:** Use when starting risky work, refactoring a specific module, or wanting guardrails on AI operations.

```
