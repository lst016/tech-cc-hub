# doc/40-product/1.0.0/40-delivery/controllers/CTR-010-GovernanceController.md

> 模块：`doc` · 语言：`markdown` · 行数：45

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-CTR-010"
title: "CTR-010-GovernanceController"
doc_type: "controller"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "Product"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "controller"
  - "governance"
---

# CTR-010-GovernanceController

## Purpose
定义权限请求、冲突和人工介入记录的 controller 边界。

## Interfaces / Types
- Inputs:
  - `permission decision`
  - `conflict resolve action`
  - `human intervention record`
- Outputs:
  - `permission summary`
  - `conflict list`
  - `intervention log`

## Acceptance
- 权限请求可决策
- 冲突可收敛和处理
- 人工介入可回放

## Observability
- `permission_requested`
- `permission_decided`
- `conflict_detected`
- `conflict_resolved`
- `human_intervened`

```
