---
doc_id: "PRD-100-CTR-003"
title: "CTR-003-TaskController"
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
  - "task"
---

# CTR-003-TaskController

## Purpose
定义 TaskNode 的 CRUD controller 边界。

## Interfaces / Types
- Inputs:
  - `create task`
  - `update task`
  - `delete task`
- Outputs:
  - `task summary`
  - `task detail`

## Acceptance
- 节点 CRUD 可用
- 节点归属 Session 明确
- 变更可回放

## Observability
- `task_created`
- `task_updated`
- `task_deleted`
