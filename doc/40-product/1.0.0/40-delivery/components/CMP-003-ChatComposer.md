---
doc_id: "PRD-100-CMP-003"
title: "CMP-003-ChatComposer"
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

# CMP-003-ChatComposer

## Purpose
定义聊天输入组件的职责和状态切换。

## Interfaces / Types
- Inputs:
  - `active_session`
  - `execution_state`
- Outputs:
  - `user_input_submitted`
  - `session_interrupted`

## Behavior / Flow
- 支持发送输入
- 执行中显示不可重复提交状态
- 提供停止按钮

## Acceptance
- 发送动作明确
- 执行中状态可见
- 停止动作可触发

## Observability
- `user_input_submitted`
- `session_interrupted`
