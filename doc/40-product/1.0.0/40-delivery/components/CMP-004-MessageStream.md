---
doc_id: "PRD-100-CMP-004"
title: "CMP-004-MessageStream"
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
  - "chat"
---

# CMP-004-MessageStream

## Purpose
定义聊天消息流组件如何承载历史消息与执行反馈。

## Interfaces / Types
- Inputs:
  - `messages[]`
  - `session_state`
- Outputs:
  - `message_anchor_opened`

## Behavior / Flow
- 展示消息历史
- 展示进行中状态
- 支持定位到最新消息或关键响应

## Acceptance
- 新消息按时序追加
- 错误与完成状态不混淆
- 恢复 Session 后能看见历史

## Observability
- `message_stream_scrolled`
