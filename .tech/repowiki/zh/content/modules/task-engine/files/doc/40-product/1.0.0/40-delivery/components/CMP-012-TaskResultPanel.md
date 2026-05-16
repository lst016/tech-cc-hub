# doc/40-product/1.0.0/40-delivery/components/CMP-012-TaskResultPanel.md

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
doc_id: "PRD-100-CMP-012"
title: "CMP-012-TaskResultPanel"
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
  - "result"
---

# CMP-012-TaskResultPanel

## Purpose
定义节点结果摘要与产物展示面板。

## Interfaces / Types
- Inputs:
  - `task_result`
  - `artifacts`
- Outputs:
  - `task_result_opened`
  - `artifact_opened`

## Behavior / Flow
- 展示节点结果摘要
- 展示关联产物
- 若失败则展示失败摘要

## Acceptance
- 成功/失败都可读
- 产物链接可见
- 适合在任务图中快速浏览

## Observability
- `task_result_opened`
- `artifact_opened`

```
