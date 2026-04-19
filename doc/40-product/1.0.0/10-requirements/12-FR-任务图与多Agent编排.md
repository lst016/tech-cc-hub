---
doc_id: "PRD-100-12"
title: "12-FR-任务图与多Agent编排"
doc_type: "requirement"
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
  - "requirements"
  - "task-graph"
---

# 12-FR-任务图与多Agent编排

## Purpose
定义 Task Graph、WorkerRun 和跨 AgentOS 任务治理在 1.0.0 的功能要求。

## Scope
本文件覆盖聊天驱动的任务节点生成、依赖、分配、执行状态和回写。

## Actors / Owners
- Owner: Product
- Readers: 后端、前端、架构、测试

## Inputs / Outputs
- Inputs: 复杂任务场景、递归拆分规范
- Outputs: `FR-GRAPH-*`

## Interfaces / Types
`FR-GRAPH-001: MUST - 系统必须从聊天与 AgentOS 执行自动生成 TaskNode`
Acceptance Criteria:
- 每次聊天 turn 至少生成一个可治理的 TaskNode
- 自动生成的 TaskNode 至少包含标题、目标、状态、所属 Session
- TaskNode 变化写入事件流

`FR-GRAPH-001A: SHOULD - 用户可以在治理面板中编辑 TaskNode，但这不是主输入方式`
Acceptance Criteria:
- 默认工作流仍然是聊天，不要求用户先手工录入标题和目标
- TaskNode 可以在治理面板中做修正、依赖补录和状态治理
- 手工修改不会替代聊天作为主入口

`FR-GRAPH-002: MUST - 用户可以为 TaskNode 建立依赖关系`
Acceptance Criteria:
- 至少支持前置依赖
- UI 中能明确展示节点关系
- 循环依赖必须被阻止并提示

`FR-GRAPH-003: MUST - 用户可以为 TaskNode 指定目标 AgentOS`
Acceptance Criteria:
- 每个 TaskNode 可独立指定 `Claude Code` 或 `Codex`
- 未显式指定时可继承默认策略
- 任务级 Agent 选择不受聊天主 Agent 限制

`FR-GRAPH-004: MUST - 用户可以看到每个 WorkerRun 的实时状态`
Acceptance Criteria:
- 至少显示 `queued / running / blocked / completed / failed`
- Worker 状态变化进入时间线
- 失败节点可回溯失败原因

`FR-GRAPH-005: SHOULD - 系统支持在预算约束下的递归拆分`
Acceptance Criteria:
- 递归拆分至少受 token、时间或深度限制之一约束
- 子任务必须可追溯到父任务
- 超预算时系统必须给出可理解反馈

`FR-GRAPH-006: MUST - 用户可以对节点执行重试、暂停或重新排队`
Acceptance Criteria:
- 节点控制动作有明确入口
- 控制动作进入事件流
- 节点历史保留执行轨迹

`FR-GRAPH-007: SHOULD - 任务完成后系统可展示结构化回写摘要`
Acceptance Criteria:
- 节点结果至少包含摘要、状态和产物链接
- 父任务可以聚合子任务结果
- 若有冲突，结果需进入冲突队列而不是直接静默覆盖

## Failure Modes
- 如果用户必须先手工创建节点，Task Graph 会违背 chat-first 主路径。
- 如果任务图只是静态展示，用户仍然无法治理复杂任务。
- 如果任务结果没有回写语义，Task Graph 会变成一次性可视化。

## Observability
- 必须记录:
  - `task_created`
  - `task_dependency_added`
  - `worker_assigned`
  - `worker_state_changed`
  - `task_requeued`
  - `task_result_written`

## Open Questions / ADR Links
- 相关架构约束见 [22-任务图与递归拆分规范.md](../../../20-specs/22-%E4%BB%BB%E5%8A%A1%E5%9B%BE%E4%B8%8E%E9%80%92%E5%BD%92%E6%8B%86%E5%88%86%E8%A7%84%E8%8C%83.md)
