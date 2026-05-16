# doc/40-product/1.0.0/40-delivery/components/CMP-003-ChatComposer.md

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

```
