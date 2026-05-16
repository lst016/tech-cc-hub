# doc/40-product/1.0.0/40-delivery/controllers/CTR-004-TaskDependencyController.md

> 模块：`task-engine` · 语言：`markdown` · 行数：39

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
