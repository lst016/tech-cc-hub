# doc/40-product/1.0.0/40-delivery/components/CMP-004-MessageStream.md

> 模块：`doc` · 语言：`markdown` · 行数：43

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
