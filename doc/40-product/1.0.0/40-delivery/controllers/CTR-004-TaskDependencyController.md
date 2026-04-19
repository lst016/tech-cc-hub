---
doc_id: "PRD-100-CTR-004"
title: "CTR-004-TaskDependencyController"
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
  - "dependency"
---

# CTR-004-TaskDependencyController

## Purpose
定义任务依赖关系的 controller 边界。

## Interfaces / Types
- Inputs:
  - `add dependency`
  - `remove dependency`
- Outputs:
  - `dependency list`

## Acceptance
- 依赖增删可用
- 循环依赖会被阻止

## Observability
- `task_dependency_added`
- `task_dependency_removed`
- `task_dependency_rejected`
