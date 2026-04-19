---
doc_id: "29"
title: "29-AgentOS能力映射矩阵"
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

# 29-AgentOS能力映射矩阵

## Purpose
把 CLAW 的统一能力模型映射到 Claude Code、Codex 等 AgentOS，明确哪些能力已抽平、哪些需要降级、哪些保留扩展位。

## Scope
本文件提供产品级和实现级的映射基线。
本文件不替代具体适配器实现，也不承诺所有底层行为完全同构。

## Actors / Owners
- Owner: Core Runtime
- Readers: Agent 集成实现者、Hub 调度实现者、前端产品实现者

## Inputs / Outputs
- Inputs: `20-AgentOS集成规范.md`, `21-统一能力模型.md`
- Outputs: 能力矩阵、降级策略、UI 暴露规则

## Core Concepts
- `Unified`: CLAW 可以以统一接口直接消费的能力。
- `Bridged`: 能力存在，但需要适配层转换。
- `Degraded`: 能力不完整，需要降级体验。
- `Extension Only`: 仅能以 agent-specific 形式暴露。

## Behavior / Flow
能力处理原则：

1. 优先把能力提升到统一模型。
2. 不能提升到统一模型的，必须定义降级行为。
3. 不能进入主流程的，只能停留在 extension 层。
4. 前端默认不展示底层差异，除非进入高级诊断视图。

## Interfaces / Types
说明：
- 下面矩阵是 CLAW v1 设计目标，不是对任意版本上游 AgentOS 的法律式保证。
- 实际实现时，每项能力都要经过适配器验真并回填状态。

| Unified Capability | Claude Code | Codex | CLAW 统一行为 | Fallback / Notes |
|---|---|---|---|---|
| `interactive_input` | Unified | Unified | 统一作为 Session 输入通道 | 无 |
| `event_stream` | Bridged | Bridged | 统一映射为 `EventEnvelope` 流 | 若底层粒度不足，由 adapter 补充系统事件 |
| `interrupt` | Bridged | Bridged | 统一作为 WorkerRun 中断能力 | 若无法即时中断，需回写 `interrupt_requested` 中间状态 |
| `status_query` | Unified | Unified | 统一查询 Session / Worker 状态 | 无 |
| `subagent` | Bridged | Bridged | 统一映射到 `worker.*` / `agent.subagent.*` | 若底层不显式暴露，则作为 extension 或派生事件 |
| `permission_signal` | Bridged | Bridged | 统一转成 `agent.permission.*` | 若无显式事件，需通过命令执行边界推导 |
| `file_change_signal` | Degraded | Degraded | 尽量统一生成 `artifact.file_change` | 可由 CLAW 侧 diff/监控补偿 |
| `structured_result` | Bridged | Bridged | 统一抽为 `ResultSummary` | 若只返回文本，需解析后结构化 |
| `tool_trace` | Bridged | Bridged | 统一映射 `agent.tool.*` | 原始 payload 进 extension |
| `context_compaction_signal` | Extension Only | Extension Only | 不进入 v1 主流程 | 仅在高级诊断视图可见 |
| `provider_metadata` | Extension Only | Extension Only | 不进入核心契约 | 仅调试使用 |

产品优先级：

| Capability | Product Priority | Why |
|---|---|---|
| `interactive_input` | MVP Must | 没有输入通道就没有控制层产品成立 |
| `event_stream` | MVP Must | 没有事件就没有回放和可观测闭环 |
| `status_query` | MVP Must | 前端无法可靠呈现状态 |
| `interrupt` | MVP Must | 复杂任务不可控，用户无法接管 |
| `structured_result` | Beta Must | 影响总结、回放和后续分析质量 |
| `permission_signal` | Beta Must | 影响企业可控性和人工介入体验 |
| `subagent` | Beta / Later | 对复杂任务很重要，但不是最小价值闭环前提 |
| `file_change_signal` | Beta / Later | 可先由 CLAW 侧补偿，不阻塞 v1 主链路 |
| `tool_trace` | Beta / Later | 重要但可先以较粗粒度落地 |
| `context_compaction_signal` | Later | 更偏高级诊断，不是 v1 主价值 |
| `provider_metadata` | Later | 调试增强，不是产品主卖点 |

UI 暴露策略：

| Layer | What User Sees |
|---|---|
| 默认产品视图 | 统一后的 Session / Task / Timeline / Replay |
| 高级诊断视图 | agent-specific extension 字段 |
| 开发调试视图 | raw mapping 和 normalization 结果 |

## Failure Modes
- 若没有能力矩阵，Hub 会错误假设两个 AgentOS 的行为完全一样。
- 若把 `Degraded` 能力伪装成 `Unified`，会导致产品体验和实现语义脱节。
- 若 extension 直接进入默认 UI，会破坏统一产品心智。

## Observability
- 每次适配器启动时都应输出当前能力声明。
- 若某项能力从 `Unified` 退化到 `Degraded`，必须有清晰事件和告警。

## Open Questions / ADR Links
- 未来引入第三种 AgentOS 时，必须先更新本矩阵再做接入。
- 相关文档:
  - [20-AgentOS集成规范.md](./20-AgentOS%E9%9B%86%E6%88%90%E8%A7%84%E8%8C%83.md)
  - [21-统一能力模型.md](./21-%E7%BB%9F%E4%B8%80%E8%83%BD%E5%8A%9B%E6%A8%A1%E5%9E%8B.md)
  - [04-问题定义与成功指标.md](../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md)
