# doc/20-specs/27-API与实时通道规范.md

> 模块：`doc` · 语言：`markdown` · 行数：65

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "27"
title: "27-API与实时通道规范"
doc_type: "contract"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L2"
  - "contract"
---

# 27-API与实时通道规范

## Purpose
定义 GUI 与 Backend Runtime 之间的 API 和实时事件通道边界。

## Scope
本文件定义接口组、通道类别和核心交互模式，详细字段留待后续细化。

## Actors / Owners
- Owner: API / Frontend
- Readers: 前端、后端实现者

## Inputs / Outputs
- Inputs: session commands、task graph mutations、query requests
- Outputs: state payloads、event stream、artifact links

## Core Concepts
- `Command API`: 改变状态的命令接口
- `Query API`: 读取状态和产物的查询接口
- `Realtime Channel`: 推送实时事件、状态变化和长任务进度

## Behavior / Flow
接口分组建议：
- `Session API`
- `Task Graph API`
- `SpecAsset API`
- `Replay / Analysis API`
- `Conflict Resolution API`

实时流分组建议：
- session timeline
- worker status
- permission requests
- artifact generation

## Interfaces / Types
建议以资源名而不是技术细节命名接口组，便于后续 REST/WS/IPC 映射。

## Failure Modes
- 若实时流和查询接口语义不一致，前端将难以维护单一状态源。

## Observability
- 记录接口耗时、订阅数、事件积压和重连成功率。

## Open Questions / ADR Links
- 本文件属于 Wave 5，将在实现前补全具体 schema。

```
