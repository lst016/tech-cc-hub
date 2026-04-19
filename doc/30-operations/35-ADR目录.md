---
doc_id: "35"
title: "35-ADR目录"
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

# 35-ADR目录

## Purpose
定义 CLAW 的架构决策记录机制，避免关键选择只存在于聊天记录或临时备注里。

## Scope
本文件定义 ADR 触发条件、目录约定、状态流转和首批待建 ADR 主题。

## Actors / Owners
- Owner: Architecture
- Readers: 技术负责人、核心实现者、后续维护者

## Inputs / Outputs
- Inputs: 重大架构取舍、长期影响决策
- Outputs: `adr/ADR-xxx-*.md`

## Core Concepts
- `ADR`: Architecture Decision Record
- `Status`: Proposed / Accepted / Superseded / Deprecated
- `Decision Scope`: 影响多个模块、多个阶段或多个实现者的关键选择

## Behavior / Flow
应写 ADR 的场景：
- 引入新的 AgentOS
- 改变统一能力模型
- 调整事件模型兼容策略
- 调整回放与分析的证据链原则
- 改变存储真相来源

目录约定：
- ADR 文件路径: `doc/adr/ADR-xxx-标题.md`
- 模板路径: [../_templates/ADR-000-模板.md](../_templates/ADR-000-%E6%A8%A1%E6%9D%BF.md)

首批建议 ADR：
- `ADR-001`: Claude Code 与 Codex 的统一能力模型策略
- `ADR-002`: 事件优先还是状态优先的混合双核实现方式
- `ADR-003`: 递归任务图的预算与停止策略
- `ADR-004`: RuntimeAsset 的持久化后端替换策略
- `ADR-005`: Workflow / Skills 的版本治理策略

当前已落地 ADR：
- [ADR-001-统一能力模型策略.md](../adr/ADR-001-%E7%BB%9F%E4%B8%80%E8%83%BD%E5%8A%9B%E6%A8%A1%E5%9E%8B%E7%AD%96%E7%95%A5.md)
- [ADR-002-混合双核运行时.md](../adr/ADR-002-%E6%B7%B7%E5%90%88%E5%8F%8C%E6%A0%B8%E8%BF%90%E8%A1%8C%E6%97%B6.md)
- [ADR-003-递归任务图预算与停止策略.md](../adr/ADR-003-%E9%80%92%E5%BD%92%E4%BB%BB%E5%8A%A1%E5%9B%BE%E9%A2%84%E7%AE%97%E4%B8%8E%E5%81%9C%E6%AD%A2%E7%AD%96%E7%95%A5.md)
- [ADR-004-RuntimeAsset真相来源.md](../adr/ADR-004-RuntimeAsset%E7%9C%9F%E7%9B%B8%E6%9D%A5%E6%BA%90.md)
- [ADR-005-SpecAsset版本治理策略.md](../adr/ADR-005-SpecAsset%E7%89%88%E6%9C%AC%E6%B2%BB%E7%90%86%E7%AD%96%E7%95%A5.md)

## Interfaces / Types
- ADR 不承载接口字段细节，字段细节仍回归 owner spec。

## Failure Modes
- 如果关键架构选择不写 ADR，后续规范很容易被口头结论反复推翻。
- 如果普通待办也写成 ADR，会稀释决策记录价值。

## Observability
- 每次重大规范变动应在变更记录中引用相关 ADR。

## Open Questions / ADR Links
- ADR 模板见 [../_templates/ADR-000-模板.md](../_templates/ADR-000-%E6%A8%A1%E6%9D%BF.md)
