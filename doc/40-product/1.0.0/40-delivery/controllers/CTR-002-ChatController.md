---
doc_id: "PRD-100-CTR-002"
title: "CTR-002-ChatController"
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
  - "chat"
---

# CTR-002-ChatController

## Purpose
定义聊天输入、执行状态和中断控制的 controller 边界。

## Interfaces / Types
- Inputs:
  - `chat input`
  - `active agent selection`
  - `interrupt request`
- Outputs:
  - `execution status`
  - `chat response stream`

## Behavior / Flow
- 接收输入并路由到当前聊天 Agent
- 返回执行状态
- 响应中断请求

## Acceptance
- 能按当前主 Agent 正确路由
- 执行状态可查询
- 中断后状态一致

## Observability
- `chat_agent_selected`
- `user_input_submitted`
- `session_interrupted`
