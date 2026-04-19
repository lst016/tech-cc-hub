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
