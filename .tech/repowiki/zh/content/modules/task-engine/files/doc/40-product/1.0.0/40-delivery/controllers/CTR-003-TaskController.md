# doc/40-product/1.0.0/40-delivery/controllers/CTR-003-TaskController.md

> 模块：`task-engine` · 语言：`markdown` · 行数：42

## 文件职责

源码文件

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
