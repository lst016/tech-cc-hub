---
doc_id: "PRD-100-CMP-001"
title: "CMP-001-SessionSidebar"
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
  - "session"
---

# CMP-001-SessionSidebar

## Purpose
定义 Session Sidebar 组件的职责、状态和验收口径。

## Scope
本组件负责展示 Session 列表、当前选中状态和最近活动摘要。

## Interfaces / Types
- Inputs:
  - `sessions[]`
  - `active_session_id`
  - `session_status`
- Outputs:
  - `session_selected`
  - `new_session_requested`

## Behavior / Flow
- 展示最近 Session 列表
- 显示当前选中 Session
- 支持点击切换 Session
- 支持进入新建 Session 动作

## Acceptance
- 能区分当前 Session
- 能展示最近活动时间
- 点击切换后主视图同步更新

## Observability
- `sidebar_session_opened`
- `session_selected_from_sidebar`
