---
doc_id: "28"
title: "28-关键对象最小Schema"
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

# 28-关键对象最小Schema

## Purpose
为 CLAW 的核心对象提供最小可实现 schema，减少实现阶段对字段边界的反复猜测。

## Scope
本文件只定义最小必需字段、对象关系和实现不变量。
本文件不追求最终全量 schema，也不覆盖数据库或传输层序列化细节。

## Actors / Owners
- Owner: Architecture
- Readers: 后端、前端、回放、分析实现者

## Inputs / Outputs
- Inputs: `21-统一能力模型.md` 中的 owner mapping
- Outputs: 可直接转为 Pydantic / TypeScript / JSON Schema 的最小字段基线

## Core Concepts
- 最小 schema 只保证系统能跑通 `控制 -> 执行 -> 观测 -> 回放 -> 分析` 主链路。
- 任何新增字段都不能破坏本文件定义的对象主键、关联键和生命周期语义。

## Behavior / Flow
字段设计遵循以下规则：

1. 每个对象都要有稳定 ID。
2. 每个运行时对象都要能追溯到 `session_id`。
3. 每个证据对象都要能回链到它所描述的实体或事件。
4. 每个对象只定义最少必填字段，扩展字段进入 `metadata` 或 `extension`。

## Interfaces / Types
### `Session`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `session_id` | string | yes | 会话唯一标识 |
| `title` | string | yes | 用户可读标题 |
| `root_task_id` | string | yes | 根任务 ID |
| `state` | enum | yes | 对应 `25` 中 SessionState |
| `active_agent_set` | string[] | yes | 当前参与的 AgentOS 集合 |
| `spec_refs` | string[] | yes | 关联的 SpecAsset 版本引用 |
| `created_at` | datetime | yes | 创建时间 |
| `updated_at` | datetime | yes | 更新时间 |
| `metadata` | object | no | 扩展字段 |

### `TaskNode`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `task_id` | string | yes | 任务唯一标识 |
| `session_id` | string | yes | 所属会话 |
| `parent_task_id` | string \| null | yes | 父任务 ID |
| `goal` | string | yes | 当前任务目标 |
| `constraints` | object[] | yes | 约束集合 |
| `dependencies` | string[] | yes | 依赖任务 IDs |
| `budget_ref` | string | yes | 预算对象引用 |
| `allowed_paths` | string[] | yes | 文件作用域 |
| `assigned_agent` | string \| null | yes | 目标 AgentOS |
| `status` | enum | yes | 对应 `22` 中 TaskStatus |
| `result_summary_ref` | string \| null | yes | 完成后摘要引用 |

### `WorkerRun`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `worker_run_id` | string | yes | 执行实例唯一标识 |
| `session_id` | string | yes | 所属会话 |
| `task_id` | string | yes | 对应任务 |
| `agent_type` | string | yes | Claude Code / Codex / other |
| `adapter_id` | string | yes | 使用的适配器 |
| `state` | enum | yes | 对应 `25` 中 WorkerRunState |
| `attempt` | int | yes | 第几次尝试 |
| `started_at` | datetime \| null | yes | 开始时间 |
| `ended_at` | datetime \| null | yes | 结束时间 |
| `extension` | object | no | agent-specific 信息 |

### `ContextSnapshot`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `snapshot_id` | string | yes | 快照 ID |
| `session_id` | string | yes | 所属会话 |
| `scope` | enum | yes | `global` / `worker` |
| `owner_id` | string | yes | session 或 worker_run |
| `context_version` | int | yes | 单调递增版本 |
| `task_graph_digest` | string | yes | 当前任务图摘要 |
| `shared_state` | object | yes | 共享上下文内容 |
| `spec_refs` | string[] | yes | 关联 SpecAsset |
| `created_at` | datetime | yes | 快照时间 |

### `ContextDiff`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `diff_id` | string | yes | diff ID |
| `session_id` | string | yes | 所属会话 |
| `base_snapshot_id` | string | yes | 基线快照 |
| `produced_by` | string | yes | hub / worker / system |
| `changes` | object[] | yes | 变更集合 |
| `reason` | string | yes | 同步或回写原因 |
| `created_at` | datetime | yes | 创建时间 |

### `EventEnvelope`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `event_id` | string | yes | 事件唯一标识 |
| `ts` | datetime | yes | 事件时间 |
| `source` | string | yes | 事件来源 |
| `event_type` | string | yes | 标准事件类型 |
| `session_id` | string | yes | 所属会话 |
| `task_id` | string \| null | yes | 关联任务 |
| `worker_run_id` | string \| null | yes | 关联执行实例 |
| `payload` | object | yes | 标准化内容 |
| `trace` | object | yes | trace / parent 关联 |
| `extension` | object | no | agent-specific 信息 |

### `ReplayDocument`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `replay_id` | string | yes | 回放 ID |
| `session_id` | string | yes | 所属会话 |
| `title` | string | yes | 展示标题 |
| `timeline_refs` | string[] | yes | 引用的事件区间 |
| `artifact_path` | string | yes | Markdown 路径 |
| `generated_at` | datetime | yes | 生成时间 |
| `coverage_summary` | object | yes | 覆盖率摘要 |

### `AnalysisReport`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `report_id` | string | yes | 报告 ID |
| `session_id` | string | yes | 所属会话 |
| `replay_id` | string | yes | 关联回放 |
| `metrics` | object | yes | 核心指标 |
| `findings` | object[] | yes | 关键发现 |
| `recommendations` | object[] | yes | 改进建议 |
| `artifact_path` | string | yes | Markdown 路径 |
| `generated_at` | datetime | yes | 生成时间 |

### `SpecAsset`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `asset_id` | string | yes | 资产 ID |
| `asset_type` | enum | yes | workflow / skill / prompt / policy |
| `version` | string | yes | 版本号 |
| `owner` | string | yes | 责任方 |
| `content_ref` | string | yes | 文件或对象引用 |
| `change_reason` | string | yes | 变更原因 |
| `metadata` | object | no | 标签和扩展 |

### `RuntimeAsset`

| Field | Type | Required | Meaning |
|---|---|---|---|
| `asset_id` | string | yes | 资产 ID |
| `asset_type` | enum | yes | event / snapshot / replay / report / conflict |
| `session_id` | string | yes | 所属会话 |
| `source_ref` | string | yes | 源对象引用 |
| `artifact_path` | string \| null | yes | 文件路径 |
| `created_at` | datetime | yes | 创建时间 |
| `metadata` | object | no | 扩展字段 |

## Failure Modes
- 若实现阶段把对象 ID、版本号、关联键做成可选字段，后续回放和分析会断链。
- 若把 agent-specific 信息塞进通用必填字段，会破坏跨 AgentOS 兼容性。

## Observability
- 每个对象至少记录 create / update / consume 三类事件。
- 对象序列化失败必须产生标准错误事件，而不是只写日志。

## Open Questions / ADR Links
- 相关文档:
  - [21-统一能力模型.md](./21-%E7%BB%9F%E4%B8%80%E8%83%BD%E5%8A%9B%E6%A8%A1%E5%9E%8B.md)
  - [24-事件模型与可观测规范.md](./24-%E4%BA%8B%E4%BB%B6%E6%A8%A1%E5%9E%8B%E4%B8%8E%E5%8F%AF%E8%A7%82%E6%B5%8B%E8%A7%84%E8%8C%83.md)
  - [32-回放与分析报告规范.md](../30-operations/32-%E5%9B%9E%E6%94%BE%E4%B8%8E%E5%88%86%E6%9E%90%E6%8A%A5%E5%91%8A%E8%A7%84%E8%8C%83.md)
