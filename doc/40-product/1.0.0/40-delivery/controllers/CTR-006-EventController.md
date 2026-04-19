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
