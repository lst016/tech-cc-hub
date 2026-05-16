# doc/40-product/1.0.0/40-delivery/components/CMP-001-SessionSidebar.md

> 模块：`session-engine` · 语言：`markdown` · 行数：50

## 文件职责

SessionSidebar组件产品规范

## 关键符号

- `职责@0 - 展示Session列表、当前选中状态、最近活动摘要，支持切换和新建`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
