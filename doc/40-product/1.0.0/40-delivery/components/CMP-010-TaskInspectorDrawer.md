---
doc_id: "PRD-100-CMP-010"
title: "CMP-010-TaskInspectorDrawer"
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
  - "inspector"
---

# CMP-010-TaskInspectorDrawer

## Purpose
定义节点详情抽屉的职责，用于查看和编辑节点属性。

## Interfaces / Types
- Inputs:
  - `selected_task_node`
- Outputs:
  - `task_updated`
  - `worker_assignment_requested`

## Behavior / Flow
- 展示节点详情
- 编辑标题、目标、说明
- 配置节点级 AgentOS

## Acceptance
- 详情信息完整
- 编辑后状态同步
- AgentOS 配置入口清晰

## Observability
- `task_inspector_opened`
- `worker_assignment_requested`
