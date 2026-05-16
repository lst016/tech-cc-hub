# pro-workflow/rules/quality-gates.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：17

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Enforce quality checks before commits - lint, typecheck, and test affected code
alwaysApply: true
---

Run lint and typecheck before every commit. Test affected code paths.

No `console.log` or `debugger` statements in production code.

No hardcoded secrets, API keys, or credentials in source files. Use environment variables.

Before committing, scan staged changes for:
- Debug statements (console.log, print, debugger)
- TODO/FIXME without ticket references
- Hardcoded secrets matching patterns like `api_key = "..."`
- Leftover test-only code

```
