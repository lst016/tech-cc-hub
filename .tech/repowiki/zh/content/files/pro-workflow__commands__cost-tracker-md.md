# pro-workflow/commands/cost-tracker.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：31

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Track session costs, understand token spend, and get optimization tips
---

# /cost-tracker - Cost Awareness

Understand and optimize your session costs.

## Quick Start

Run to see:
- Current session cost estimate
- Top cost drivers
- Optimization suggestions
- Budget guidance for your task type

## Cost Benchmarks

| Task Type | Typical | Budget Alert |
|-----------|---------|-------------|
| Bug fix | $0.10-0.50 | $1.00 |
| Small feature | $0.50-2.00 | $3.00 |
| Large feature | $2.00-8.00 | $10.00 |
| Refactor | $1.00-5.00 | $7.00 |

## Usage

```
/cost-tracker
```

```
