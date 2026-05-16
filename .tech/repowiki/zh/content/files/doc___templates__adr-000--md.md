# doc/_templates/ADR-000-模板.md

> 模块：`doc` · 语言：`markdown` · 行数：37

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "ADR-000-TEMPLATE"
title: "ADR-000: 标题"
doc_type: "template"
layer: "meta"
status: "template"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "meta"
  - "template"
---

# ADR-000: 标题

- Status: Proposed
- Date: 2026-04-19
- Owners: CLAW Core

## Context
做这个决策时面临的背景、约束和备选路径。

## Decision
最终选择的方案，以及为什么选它。

## Consequences
这项决策带来的收益、代价和后续影响。

## Links
- 相关规范
- 相关 issue / note

```
