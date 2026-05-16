# pro-workflow/rules/no-debug-statements.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：14

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Remove debug statements before committing - console.log, print, debugger
globs: "**/*.{ts,tsx,js,jsx,py,go,rs}"
alwaysApply: false
---

Remove all debug statements before committing:
- JavaScript/TypeScript: `console.log()`, `console.debug()`, `console.info()`, `debugger`
- Python: `print()`, `breakpoint()`, `pdb.set_trace()`
- Go: `fmt.Println()` used for debugging
- Rust: `dbg!()`, `println!()` used for debugging

Exceptions: Legitimate logging using a logging framework (winston, pino, logging module) is fine.

```
