# doc/40-product/1.0.0/40-delivery/components/CMP-011-WorkerStatusBadge.md

> 模块：`doc` · 语言：`markdown` · 行数：41

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-CMP-011"
title: "CMP-011-WorkerStatusBadge"
doc_type: "component"
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
  - "component"
  - "worker"
---

# CMP-011-WorkerStatusBadge

## Purpose
定义 Worker 状态标记组件的语义和显示范围。

## Interfaces / Types
- Inputs:
  - `worker_state`
  - `failure_reason`
- Outputs:
  - `worker_state_opened`

## Behavior / Flow
- 展示标准状态
- 对失败态提供额外入口

## Acceptance
- 状态颜色/文案区分清晰
- 失败态可进一步查看

## Observability
- `worker_state_opened`

```
