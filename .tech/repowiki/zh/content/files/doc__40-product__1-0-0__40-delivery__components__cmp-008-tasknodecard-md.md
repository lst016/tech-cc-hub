# doc/40-product/1.0.0/40-delivery/components/CMP-008-TaskNodeCard.md

> 模块：`task-engine` · 语言：`markdown` · 行数：45

## 文件职责

源码文件

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
