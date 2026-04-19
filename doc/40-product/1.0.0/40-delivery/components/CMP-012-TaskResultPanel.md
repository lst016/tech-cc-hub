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
