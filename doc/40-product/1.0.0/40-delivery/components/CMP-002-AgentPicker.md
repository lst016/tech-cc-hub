---
doc_id: "PRD-100-CMP-002"
title: "CMP-002-AgentPicker"
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
  - "agent"
---

# CMP-002-AgentPicker

## Purpose
定义聊天主 Agent 选择器的组件边界。

## Scope
本组件只负责聊天界面的交互主 Agent 选择，不负责 TaskNode 级 Agent 指定。

## Interfaces / Types
- Inputs:
  - `selected_agent`
  - `available_agents = [Claude Code, Codex]`
- Outputs:
  - `chat_agent_selected`

## Behavior / Flow
- 默认选中 `Claude Code`
- 仅允许 `Claude Code / Codex` 二选一
- 切换时需要明确反馈

## Acceptance
- 初始值正确
- 不支持多选
- 切换写入事件流

## Observability
- `chat_agent_selected`
