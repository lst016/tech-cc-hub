# doc/40-product/1.0.0/40-delivery/controllers/CTR-005-WorkerController.md

> 模块：`doc` · 语言：`markdown` · 行数：44

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
