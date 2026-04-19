---
doc_id: "PRD-100-CTR-005"
title: "CTR-005-WorkerController"
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
  - "worker"
---

# CTR-005-WorkerController

## Purpose
定义 WorkerRun 状态查询、重试、排队和结果回写的 controller 边界。

## Interfaces / Types
- Inputs:
  - `assign worker`
  - `retry task`
  - `requeue task`
- Outputs:
  - `worker state`
  - `task result summary`

## Acceptance
- 节点级 AgentOS 分配可用
- Worker 状态实时可查询
- 重试与重新排队可用
- 结果回写可读

## Observability
- `worker_assigned`
- `worker_state_changed`
- `task_requeued`
- `task_result_written`
