---
doc_id: "26"
title: "26-存储与Markdown产物规范"
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

# 26-存储与Markdown产物规范

## Purpose
定义 CLAW 的本地文件系统布局，以及哪些 Markdown 是规范资产、哪些是运行时产物。

## Scope
本文件覆盖目录约定、命名规则、文档产物分层和保留策略。

## Actors / Owners
- Owner: Storage
- Readers: 后端、前端、文档生成实现者

## Inputs / Outputs
- Inputs: SpecAsset、EventEnvelope、Session state、AnalysisReport
- Outputs: 本地目录布局、MD 产物命名规则

## Core Concepts
- `spec/`: 可版本化规范资产
- `runtime/`: 运行时状态和事件
- `artifacts/`: 回放、分析、冲突、导出产物
- `docs/`: 项目级静态架构文档

## Behavior / Flow
建议目录：

```text
claw/
  docs/
  spec/
    workflows/
    skills/
    prompts/
    policies/
  runtime/
    sessions/
    events/
    snapshots/
    task-graphs/
  artifacts/
    replay/
    analysis/
    conflicts/
```

## Interfaces / Types
Markdown 产物分类：

| Type | Example | Nature |
|---|---|---|
| `ArchitectureDoc` | 系统上下文图、集成规范 | 静态 spec |
| `ReplayDocument` | session 回放 | 运行时证据 |
| `AnalysisReport` | 执行分析 | 运行时结论 |
| `ConflictNote` | 冲突说明 | 运行时证据 |
| `WorkflowSpec` | 流程定义文档 | 静态 spec |

命名原则：
- 用稳定 ID 命名运行时资产，避免只用自然语言标题
- Markdown 文件标题对人友好，文件名对机器稳定
- 静态 spec 与运行时产物必须放在不同根目录

## Failure Modes
- 如果把架构文档和运行时回放放在同一路径，文档仓库会失去可维护性。
- 如果回放命名依赖用户自由文本，会导致资产检索困难。

## Observability
- 存储层要记录写入失败、命名冲突、生成耗时和资产链路。

## Open Questions / ADR Links
- 未来若引入数据库，只替换持久化后端，不改资产分层语义。
