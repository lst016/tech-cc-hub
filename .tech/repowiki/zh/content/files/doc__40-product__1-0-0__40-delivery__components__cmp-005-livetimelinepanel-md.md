# doc/40-product/1.0.0/40-delivery/components/CMP-005-LiveTimelinePanel.md

> 模块：`doc` · 语言：`markdown` · 行数：45

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
