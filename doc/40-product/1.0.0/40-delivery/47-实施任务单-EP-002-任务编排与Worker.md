---
doc_id: "PRD-100-47"
title: "47-实施任务单-EP-002-任务编排与Worker"
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
  - "tasks"
  - "ep-002"
---

# 47-实施任务单-EP-002-任务编排与Worker

## Purpose
把 `EP-002` 进一步拆成前后端可执行任务单，便于进入任务编排主链路实现。

## Scope
本文件聚焦 Task Graph 与 Worker 相关任务，不覆盖 Replay / Spec / Governance 深化能力。

## Behavior / Flow
### Frontend Tasks

| Task ID | Task | Depends On |
|---|---|---|
| `FE-EP002-01` | 实现 Task Graph 画布基础结构 | 无 |
| `FE-EP002-02` | 实现 TaskNode 创建 / 编辑 / 删除交互 | `FE-EP002-01` |
| `FE-EP002-03` | 实现依赖关系配置与显示 | `FE-EP002-02` |
| `FE-EP002-04` | 实现节点级 AgentOS 分配入口 | `FE-EP002-02` |
| `FE-EP002-05` | 实现 Worker 状态展示与节点控制按钮 | `FE-EP002-03`, `FE-EP002-04` |
| `FE-EP002-06` | 实现节点结果摘要与失败详情面板 | `FE-EP002-05` |

### Backend Tasks

| Task ID | Task | Depends On |
|---|---|---|
| `BE-EP002-01` | 提供 TaskNode CRUD 和依赖管理 | 无 |
| `BE-EP002-02` | 提供节点级 AgentOS 分配与 WorkerRun 建模 | `BE-EP002-01` |
| `BE-EP002-03` | 提供 Worker 状态流与节点结果回写 | `BE-EP002-02` |
| `BE-EP002-04` | 提供节点重试 / 重新排队接口 | `BE-EP002-03` |
| `BE-EP002-05` | 写入任务图相关事件族 | `BE-EP002-01`, `BE-EP002-03`, `BE-EP002-04` |

### QA Tasks

| Task ID | Task | Depends On |
|---|---|---|
| `QA-EP002-01` | 验证 TaskNode 生命周期 | `FE-EP002-02`, `BE-EP002-01` |
| `QA-EP002-02` | 验证依赖阻止循环 | `FE-EP002-03`, `BE-EP002-01` |
| `QA-EP002-03` | 验证节点级 AgentOS 分配不受聊天 Agent 干扰 | `FE-EP002-04`, `BE-EP002-02` |
| `QA-EP002-04` | 验证 Worker 状态与失败恢复链路 | `FE-EP002-05`, `BE-EP002-04` |
| `QA-EP002-05` | 验证结果回写与摘要聚合 | `FE-EP002-06`, `BE-EP002-03` |

## Interfaces / Types
- Story Pack: [37-StoryPack-EP-002-任务编排与Worker.md](../30-epics/37-StoryPack-EP-002-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)
- UI Map: [44-页面与交互映射.md](./44-%E9%A1%B5%E9%9D%A2%E4%B8%8E%E4%BA%A4%E4%BA%92%E6%98%A0%E5%B0%84.md)
- API Map: [45-API与服务映射.md](./45-API%E4%B8%8E%E6%9C%8D%E5%8A%A1%E6%98%A0%E5%B0%84.md)
- Component Docs: [48-组件索引.md](./48-%E7%BB%84%E4%BB%B6%E7%B4%A2%E5%BC%95.md)
- Controller Docs: [49-控制器索引.md](./49-%E6%8E%A7%E5%88%B6%E5%99%A8%E7%B4%A2%E5%BC%95.md)

## Failure Modes
- 如果任务图和 Worker 状态实现不同步，用户会迅速失去对系统的信任。

## Observability
- EP-002 完成时至少验证:
  - `task_created`
  - `task_dependency_added`
  - `worker_assigned`
  - `worker_state_changed`
  - `task_result_written`
