---
doc_id: "34"
title: "34-MVP切片与迭代路线图"
doc_type: "operations"
layer: "L3"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "L3"
  - "operations"
---

# 34-MVP切片与迭代路线图

## Purpose
把 CLAW 从文档体系映射到实际交付切片，确保可以渐进实现而不是一次性堆全。

## Scope
本文件定义实现阶段、每阶段目标和验收标准。

## Actors / Owners
- Owner: Product + Architecture
- Readers: 项目负责人、核心实现者

## Inputs / Outputs
- Inputs: 全量 1.0.0 规范
- Outputs: 交付切片、阶段目标、验收基线

## Core Concepts
- `Slice`: 可独立验证的最小交付面。
- `Wave`: 文档细化波次。
- `Milestone`: 产品级验收节点。

## Behavior / Flow
建议交付切片：

| Slice | Goal | Product Hypothesis | Evidence |
|---|---|---|---|
| `S0` | 跑通单 Session + 单 AgentOS + 事件入流 | 用户愿意为“看见执行过程”买单 | 能稳定看到事件时间线 |
| `S1` | 跑通 Task Graph + WorkerRun + 回放 | 回放比纯聊天记录更能支撑理解和接管 | 至少一类复杂任务可回放 |
| `S2` | 接入第二个 AgentOS，完成统一能力模型 | 统一视图能降低跨 AgentOS 的心智负担 | 用户能比较两种 AgentOS 的执行证据 |
| `S3` | 引入 Workflow / Skills 版本化和分析报告 | 用户会开始把经验固化为可复用资产 | 出现有效 `SpecAsset` 复用和修订 |
| `S4` | 完成冲突处理、人工介入和双主轴 GUI | 当任务变复杂时，用户更愿意在 CLAW 中治理而不是退回终端 | 冲突处理和人工介入链路完整 |

里程碑标准：
- `M1`: 能看见完整时间线
- `M2`: 能回放一次复杂任务
- `M3`: 能比较两种 AgentOS 的执行证据
- `M4`: 能基于回放修改 SpecAsset 并再次运行

产品成功标准：

| Horizon | Product Success |
|---|---|
| `3 months` | `replay_generation_rate >= 80%`，至少形成 3 类可复用 SpecAsset |
| `6 months` | 相似任务二次执行的人工介入率下降 `20%+` |
| `12 months` | replay coverage 达到 `90%+`，并形成可迁移的 workflow / policy 基线 |

## Interfaces / Types
- 每个 Slice 都要有对应的 spec 覆盖范围和验收脚本。

## Failure Modes
- 如果直接上多 Agent + 多分析视图，容易缺少最小闭环。
- 如果只做 UI 不做回放闭环，后续调优价值有限。

## Observability
- 每个 Slice 都必须有明确可验证的 evidence，而不是只看 demo。

## Open Questions / ADR Links
- 实现排序可根据资源调整，但不应跳过 `S0 -> S1 -> S2` 这条主链。
- 相关价值指标见 [04-问题定义与成功指标.md](../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md)
