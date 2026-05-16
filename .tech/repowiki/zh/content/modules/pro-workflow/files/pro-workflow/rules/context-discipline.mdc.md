# pro-workflow/rules/context-discipline.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：25

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Manage AI context window efficiently - read before write, no re-reads, tool-call budgets, one-pass discipline
alwaysApply: true
---

Read before write: always read a file before editing or writing it. Never modify a file you have not read in this session.

No re-reads: do not re-read a file already read in this session unless it was modified since the last read.

One-pass coding: for simple-to-medium tasks, write the complete solution in one pass. Run tests once. If tests pass, stop immediately. Do not refactor, improve, or polish passing code. Never iterate more than twice on the same failure.

Tool-call budgets: track tool calls per session. Quick fix: 20 calls. Bug fix: 30. Feature: 50. Large feature: 80. At 80% of budget, wrap up current task.

Use plan mode for changes touching more than 3 files, architecture decisions, or unclear requirements.

Compact context at task boundaries: after planning, after completing a feature, when switching domains.

Keep MCP servers under 10 enabled and total tools under 80.

Use subagents to isolate high-volume output (test runs, log analysis, documentation searches).

Summarize exploration findings before acting on them.

Read tests before coding: understand what the tests assert before writing implementation code.

```
