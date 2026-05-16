# pro-workflow/rules/self-correction.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：16

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Self-correction protocol - capture mistakes as learnings, compound improvements over time
alwaysApply: true
---

When corrected or when a mistake is identified:
1. Acknowledge specifically what went wrong
2. Propose a concise rule: `[LEARN] Category: One-line rule`
3. Wait for approval before persisting the learning

Categories: Navigation, Editing, Testing, Git, Quality, Context, Architecture, Performance

Learnings compound over time. A correction today prevents the same mistake tomorrow.

Trigger phrases that indicate a correction: "remember this", "add to rules", "don't do that again"

```
