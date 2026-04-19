---
doc_id: "PRD-100-45"
title: "45-API与服务映射"
doc_type: "delivery"
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
  - "delivery"
  - "api-map"
---

# 45-API与服务映射

## Purpose
把 PRD 中的核心能力映射为后端服务和外部接口边界，供后端和架构继续细拆。

## Scope
本文件是产品级 API / Service 地图，不定义最终协议字段。

## Interfaces / Types
| Service / API Area | Primary Responsibility | Related FR / Epic |
|---|---|---|
| `Session Service` | 创建、恢复、停止、列出 Session | `FR-CHAT-*`, `EP-001` |
| `Agent Adapter Layer` | 统一 Claude Code / Codex 适配 | `FR-CHAT-001`, `FR-GRAPH-003`, `EP-001`, `EP-002` |
| `Task Service` | 节点、依赖、结果回写 | `FR-GRAPH-*`, `EP-002` |
| `Worker Orchestration` | WorkerRun 状态、重试、排队 | `FR-GRAPH-004 ~ 006`, `EP-002` |
| `Event Service` | 事件归一、存储、订阅 | `FR-EVID-001 ~ 002`, `EP-003` |
| `Replay Service` | ReplayDocument 生成和读取 | `FR-EVID-003`, `EP-003` |
| `Analysis Service` | AnalysisReport 生成和读取 | `FR-EVID-004 ~ 005`, `EP-003` |
| `Spec Service` | SpecAsset 创建、绑定、版本 | `FR-SPEC-*`, `EP-004` |
| `Governance Service` | 权限请求、冲突、人工介入记录 | `FR-GOV-*`, `EP-005` |
| `Workspace Service` | 工作区绑定、文件树、产物索引 | `FR-WS-*`, `EP-001`, `EP-005` |

## Behavior / Flow
优先实现顺序：
1. `Session Service`
2. `Agent Adapter Layer`
3. `Event Service`
4. `Task Service`
5. `Replay / Analysis`
6. `Spec / Governance / Workspace`

### Controller Expansion
- 具体 controller 拆分见 [49-控制器索引.md](./49-%E6%8E%A7%E5%88%B6%E5%99%A8%E7%B4%A2%E5%BC%95.md)

## Failure Modes
- 如果接口边界不稳定，后端实现会反复在 Session / Task / Event 之间摇摆。

## Observability
- 每个 service area 都至少要有:
  - 输入对象
  - 输出对象
  - 失败事件
  - 度量指标
