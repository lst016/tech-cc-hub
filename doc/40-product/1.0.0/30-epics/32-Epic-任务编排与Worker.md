---
doc_id: "PRD-100-32"
title: "32-Epic-任务编排与Worker"
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
  - "task-graph"
---

# 32-Epic-任务编排与Worker

## Purpose
定义 Task Graph、WorkerRun 和跨 AgentOS 调度的产品目标。

## Behavior / Flow
### Business Value
把复杂任务从“聊天消息堆积”提升为可治理的任务图。

### Covers
- `FR-GRAPH-001 ~ 007`

### User Stories

`US-101: As a 高频 Agent 用户, I want to split a complex task into visible nodes so that I can manage dependencies explicitly.`

`US-102: As a 高频 Agent 用户, I want to assign Claude Code or Codex per node so that I can use the right AgentOS for each subtask.`

`US-103: As a 高频 Agent 用户, I want to see Worker status in real time so that I know which part is blocked or failing.`

`US-104: As a 高频 Agent 用户, I want to retry or requeue failed nodes so that I can keep the graph moving without starting over.`

`US-105: As a 高频 Agent 用户, I want completed nodes to write back structured summaries so that the graph stays intelligible.`

### Done Criteria
- 节点创建、依赖、分配可用
- Worker 状态可见
- 基础节点控制可用
- 结果回写可见

### Decomposition
- Story Pack: [37-StoryPack-EP-002-任务编排与Worker.md](./37-StoryPack-EP-002-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)
- Delivery Tasks: [47-实施任务单-EP-002-任务编排与Worker.md](../40-delivery/47-%E5%AE%9E%E6%96%BD%E4%BB%BB%E5%8A%A1%E5%8D%95-EP-002-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)

## Observability
- 关注:
  - `task_created`
  - `task_dependency_added`
  - `worker_assigned`
  - `task_result_written`
