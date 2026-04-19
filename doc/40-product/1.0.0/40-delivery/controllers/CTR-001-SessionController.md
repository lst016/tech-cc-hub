---
doc_id: "PRD-100-CTR-001"
title: "CTR-001-SessionController"
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
  - "session"
---

# CTR-001-SessionController

## Purpose
定义 SessionController 的产品职责和对外边界。

## Scope
负责 Session 创建、查询、恢复、停止等生命周期动作。

## Interfaces / Types
- Inputs:
  - `create session request`
  - `resume session request`
  - `stop session request`
- Outputs:
  - `session summary`
  - `session state`

## Behavior / Flow
- 创建 Session
- 查询 Session 列表
- 恢复 Session
- 停止 Session

## Acceptance
- Session 生命周期动作可用
- 每个 Session 能关联主 Agent
- 恢复后保留关键上下文信息

## Observability
- `session_created`
- `session_resumed`
- `session_stopped`
