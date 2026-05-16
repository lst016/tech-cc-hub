# doc/40-product/1.0.0/30-epics/31-Epic-交互工作台.md

> 模块：`doc` · 语言：`markdown` · 行数：69

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-31"
title: "31-Epic-交互工作台"
doc_type: "epic"
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
  - "epic"
  - "frontend"
---

# 31-Epic-交互工作台

## Purpose
定义聊天主入口、Session 列表和工作区主视图的交付目标。

## Core Concepts
- `EP-001`
- `Chat Workspace`
- `Session Sidebar`
- `Primary Interactive Agent`

## Behavior / Flow
### Business Value
让用户愿意把 CLAW 当成第一入口，而不是“最后才去看的分析面板”。

### Covers
- `FR-CHAT-001 ~ 006`
- `FR-WS-001`
- `FR-WS-003`

### User Stories

`US-001: As a 高频 Agent 用户, I want to start a chat session with a clear active agent so that I know who is executing my request.`

`US-002: As a 高频 Agent 用户, I want to interrupt or resume a session so that I can stay in control during long runs.`

`US-003: As a 高频 Agent 用户, I want a sidebar of recent sessions so that I can switch context without losing evidence.`

`US-004: As a 高频 Agent 用户, I want to jump from the chat view to replay, analysis, and artifacts so that I can understand results without leaving the product loop.`

### Done Criteria
- 新建 Session 可用
- 默认 Agent 选择规则正确
- 聊天流式响应可用
- Session 恢复可用
- 关联回放入口可达

### Decomposition
- Story Pack: [36-StoryPack-EP-001-交互工作台.md](./36-StoryPack-EP-001-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md)
- Delivery Tasks: [46-实施任务单-EP-001-交互工作台.md](../40-delivery/46-%E5%AE%9E%E6%96%BD%E4%BB%BB%E5%8A%A1%E5%8D%95-EP-001-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md)

## Failure Modes
- 如果交互工作台不顺，用户不会进入后续任务图和调优链路。

## Observability
- 关注:
  - `session_created`
  - `chat_agent_selected`
  - `session_resumed`
  - `artifact_opened`

```
