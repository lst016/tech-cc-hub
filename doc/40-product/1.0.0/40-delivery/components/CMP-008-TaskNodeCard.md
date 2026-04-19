---
doc_id: "PRD-100-CMP-008"
title: "CMP-008-TaskNodeCard"
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
  - "task-node"
---

# CMP-008-TaskNodeCard

## Purpose
定义任务节点卡片在图中的展示与快捷操作边界。

## Interfaces / Types
- Inputs:
  - `task_node`
  - `worker_state`
- Outputs:
  - `task_node_opened`
  - `task_node_action_clicked`

## Behavior / Flow
- 展示标题、状态、AgentOS、摘要
- 支持打开详情
- 支持快捷重试或排队入口

## Acceptance
- 基本信息完整
- 状态清晰
- 快捷动作不混淆

## Observability
- `task_node_opened`
- `task_node_action_clicked`
