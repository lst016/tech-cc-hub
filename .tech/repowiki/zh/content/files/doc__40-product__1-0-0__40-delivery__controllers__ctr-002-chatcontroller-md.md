# doc/40-product/1.0.0/40-delivery/controllers/CTR-002-ChatController.md

> 模块：`doc` · 语言：`markdown` · 行数：47

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
