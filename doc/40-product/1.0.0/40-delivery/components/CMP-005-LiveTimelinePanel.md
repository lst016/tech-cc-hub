---
doc_id: "PRD-100-CMP-005"
title: "CMP-005-LiveTimelinePanel"
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
  - "timeline"
---

# CMP-005-LiveTimelinePanel

## Purpose
定义时间线面板组件的职责、过滤和跳转语义。

## Interfaces / Types
- Inputs:
  - `event_stream`
  - `filters`
- Outputs:
  - `timeline_filtered`
  - `timeline_event_opened`

## Behavior / Flow
- 展示实时事件列表
- 支持按对象或事件类型过滤
- 支持跳转到关联 Session / Task / Replay

## Acceptance
- 新事件可增量可见
- 过滤后结果正确
- 跳转链路可用

## Observability
- `timeline_filtered`
- `timeline_event_opened`
