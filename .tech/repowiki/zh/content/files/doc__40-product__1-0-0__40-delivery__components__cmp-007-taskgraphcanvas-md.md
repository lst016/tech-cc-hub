# doc/40-product/1.0.0/40-delivery/components/CMP-007-TaskGraphCanvas.md

> 模块：`task-engine` · 语言：`markdown` · 行数：44

## 文件职责

源码文件

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-CMP-007"
title: "CMP-007-TaskGraphCanvas"
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
  - "task-graph"
---

# CMP-007-TaskGraphCanvas

## Purpose
定义任务图主画布容器的职责。

## Interfaces / Types
- Inputs:
  - `task_nodes`
  - `task_edges`
- Outputs:
  - `task_canvas_opened`
  - `task_node_selected`

## Behavior / Flow
- 承载节点与依赖关系可视化
- 支持节点选中
- 支持空态和基础布局

## Acceptance
- 节点与边关系可见
- 节点选中后明确信息聚焦

## Observability
- `task_graph_opened`
- `task_node_selected`

```
