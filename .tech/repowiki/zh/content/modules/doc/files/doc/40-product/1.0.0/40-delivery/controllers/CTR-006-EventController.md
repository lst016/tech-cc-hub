# doc/40-product/1.0.0/40-delivery/controllers/CTR-006-EventController.md

> 模块：`doc` · 语言：`markdown` · 行数：40

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-CTR-006"
title: "CTR-006-EventController"
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
  - "event"
---

# CTR-006-EventController

## Purpose
定义事件流查询与订阅 controller 的职责。

## Interfaces / Types
- Inputs:
  - `event query`
  - `timeline subscription`
- Outputs:
  - `event list`
  - `event stream`

## Acceptance
- 可按 Session / Task 查询事件
- 可用于实时订阅时间线
- 事件归属信息完整

## Observability
- `event_normalized`
- `timeline_subscription_started`

```
