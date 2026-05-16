# doc/40-product/1.0.0/40-delivery/49-控制器索引.md

> 模块：`doc` · 语言：`markdown` · 行数：59

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-49"
title: "49-控制器索引"
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
  - "controller"
  - "index"
---

# 49-控制器索引

## Purpose
把 1.0.0 的后端交付继续细拆到 controller 级颗粒度，供后端继续拆分接口和服务任务。

## Scope
本文件当前优先覆盖 `EP-001 / EP-002` 的主链路 controller，并把 1.0.0 核心控制器全部列出。

## Interfaces / Types
| Controller | File | Primary Responsibility | Related Epic |
|---|---|---|---|
| `CTR-001` | [SessionController.md](./controllers/CTR-001-SessionController.md) | Session 生命周期 | `EP-001` |
| `CTR-002` | [ChatController.md](./controllers/CTR-002-ChatController.md) | 聊天输入与执行状态 | `EP-001` |
| `CTR-003` | [TaskController.md](./controllers/CTR-003-TaskController.md) | TaskNode CRUD | `EP-002` |
| `CTR-004` | [TaskDependencyController.md](./controllers/CTR-004-TaskDependencyController.md) | 依赖管理 | `EP-002` |
| `CTR-005` | [WorkerController.md](./controllers/CTR-005-WorkerController.md) | WorkerRun 状态与控制 | `EP-002` |
| `CTR-006` | [EventController.md](./controllers/CTR-006-EventController.md) | 事件流查询与订阅 | `EP-001`, `EP-002`, `EP-003` |
| `CTR-007` | [ReplayController.md](./controllers/CTR-007-ReplayController.md) | ReplayDocument 生成与读取 | `EP-003` |
| `CTR-008` | [AnalysisController.md](./controllers/CTR-008-AnalysisController.md) | AnalysisReport 生成与读取 | `EP-003` |
| `CTR-009` | [SpecAssetController.md](./controllers/CTR-009-SpecAssetController.md) | SpecAsset 管理与绑定 | `EP-004` |
| `CTR-010` | [GovernanceController.md](./controllers/CTR-010-GovernanceController.md) | 审批、冲突、人工介入 | `EP-005` |

## Behavior / Flow
推荐拆分顺序：
1. `SessionController`
2. `ChatController`
3. `EventController`
4. `TaskController`
5. `TaskDependencyController`
6. `WorkerController`

## Failure Modes
- 如果只拆到 service area，后端仍然要在 controller 边界上重新做产品决策。

## Observability
- 每个 controller 文档至少定义:
  - 主职责
  - 输入/输出对象
  - 失败语义
  - 观测指标

```
