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
