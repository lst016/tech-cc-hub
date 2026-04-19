---
doc_id: "PRD-100-37"
title: "37-StoryPack-EP-002-任务编排与Worker"
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
  - "story-pack"
  - "ep-002"
---

# 37-StoryPack-EP-002-任务编排与Worker

## Purpose
把 `EP-002` 拆成可进入设计、开发和测试的任务编排故事包。

## Scope
本文件覆盖 Task Graph、WorkerRun、节点控制和结果回写相关故事。

## Actors / Owners
- Owner: Product
- Readers: 前端、后端、测试

## Inputs / Outputs
- Inputs: [32-Epic-任务编排与Worker.md](./32-Epic-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)
- Outputs: Story Pack、验收标准、依赖关系

## Behavior / Flow
### Story List

`US-101: MUST - As a 高频 Agent 用户, I want to create task nodes so that I can structure a complex objective.`
Acceptance Criteria:
- 可创建、编辑、删除 TaskNode
- 节点至少包含标题、目标、状态
- 节点变化进入事件流

`US-102: MUST - As a 高频 Agent 用户, I want to define dependencies between nodes so that the graph reflects execution order.`
Acceptance Criteria:
- 可创建前置依赖
- 循环依赖被阻止
- 依赖关系可在 UI 中可视化

`US-103: MUST - As a 高频 Agent 用户, I want to assign Claude Code or Codex per node so that I can route work intentionally.`
Acceptance Criteria:
- 节点级 AgentOS 可配置
- 聊天主 Agent 不覆盖节点配置
- 分配动作进入事件流

`US-104: MUST - As a 高频 Agent 用户, I want to see Worker state changes so that I can monitor graph progress.`
Acceptance Criteria:
- 节点显示 `queued / running / blocked / completed / failed`
- 状态变化实时更新
- 失败原因可查看

`US-105: SHOULD - As a 高频 Agent 用户, I want to retry or requeue nodes so that I can recover from partial failures.`
Acceptance Criteria:
- 节点控制支持重试 / 重新排队
- 控制动作有结果反馈
- 控制动作进入事件流

`US-106: MUST - As a 高频 Agent 用户, I want completed nodes to write back summaries so that I can understand the graph state quickly.`
Acceptance Criteria:
- 节点完成后有结果摘要
- 若有产物可附带链接
- 父任务可看到子任务摘要聚合

### Dependencies

| Story | Depends On |
|---|---|
| `US-101` | 无 |
| `US-102` | `US-101` |
| `US-103` | `US-101` |
| `US-104` | `US-101`, `US-103` |
| `US-105` | `US-104` |
| `US-106` | `US-104` |

### Suggested Delivery Split
- Frontend-first: `US-101`, `US-102`, `US-104`
- Backend-first: `US-103`, `US-105`, `US-106`
- Joint verification: `US-104`, `US-106`

## Failure Modes
- 如果图结构和执行状态脱节，Task Graph 会沦为静态草图。

## Observability
- 关键事件:
  - `task_created`
  - `task_dependency_added`
  - `worker_assigned`
  - `worker_state_changed`
  - `task_requeued`
  - `task_result_written`

## Open Questions / ADR Links
- 关联任务单见 [47-实施任务单-EP-002-任务编排与Worker.md](../40-delivery/47-%E5%AE%9E%E6%96%BD%E4%BB%BB%E5%8A%A1%E5%8D%95-EP-002-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)
