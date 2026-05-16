# doc/40-product/1.0.0/40-delivery/48-组件索引.md

> 模块：`doc` · 语言：`markdown` · 行数：58

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-48"
title: "48-组件索引"
doc_type: "index"
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
  - "index"
---

# 48-组件索引

## Purpose
把 1.0.0 的前端交付继续细拆到组件级颗粒度，供前端继续拆分页面内任务。

## Scope
本文件当前优先覆盖 `EP-001 / EP-002` 相关组件。

## Interfaces / Types
| Component | File | Surface | Related Epic |
|---|---|---|---|
| `CMP-001` | [SessionSidebar.md](./components/CMP-001-SessionSidebar.md) | `Session Sidebar` | `EP-001` |
| `CMP-002` | [AgentPicker.md](./components/CMP-002-AgentPicker.md) | `Chat Workspace` | `EP-001` |
| `CMP-003` | [ChatComposer.md](./components/CMP-003-ChatComposer.md) | `Chat Workspace` | `EP-001` |
| `CMP-004` | [MessageStream.md](./components/CMP-004-MessageStream.md) | `Chat Workspace` | `EP-001` |
| `CMP-005` | [LiveTimelinePanel.md](./components/CMP-005-LiveTimelinePanel.md) | `Live Timeline` | `EP-001`, `EP-003` |
| `CMP-006` | [ArtifactJumpPanel.md](./components/CMP-006-ArtifactJumpPanel.md) | `Replay / Analysis Access` | `EP-001` |
| `CMP-007` | [TaskGraphCanvas.md](./components/CMP-007-TaskGraphCanvas.md) | `Task Graph` | `EP-002` |
| `CMP-008` | [TaskNodeCard.md](./components/CMP-008-TaskNodeCard.md) | `Task Graph` | `EP-002` |
| `CMP-009` | [DependencyEditor.md](./components/CMP-009-DependencyEditor.md) | `Task Graph` | `EP-002` |
| `CMP-010` | [TaskInspectorDrawer.md](./components/CMP-010-TaskInspectorDrawer.md) | `Task Graph` | `EP-002` |
| `CMP-011` | [WorkerStatusBadge.md](./components/CMP-011-WorkerStatusBadge.md) | `Task Graph` | `EP-002` |
| `CMP-012` | [TaskResultPanel.md](./components/CMP-012-TaskResultPanel.md) | `Task Graph` | `EP-002` |

## Behavior / Flow
推荐拆分顺序：
1. 容器组件
2. 交互关键组件
3. 状态 / 展示组件
4. 辅助组件

## Failure Modes
- 如果只拆到页面级，前端实现仍然会在组件边界反复讨论。

## Observability
- 每个组件文档至少定义:
  - 输入状态
  - 输出事件
  - 错误态

```
