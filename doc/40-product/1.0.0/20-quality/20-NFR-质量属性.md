---
doc_id: "PRD-100-20"
title: "20-NFR-质量属性"
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
  - "nfr"
  - "quality"
---

# 20-NFR-质量属性

## Purpose
定义 1.0.0 的非功能要求，确保产品不仅“能用”，还具备可接受的性能、可靠性和可维护性。

## Scope
本文件覆盖性能、可靠性、安全性、可用性和可维护性要求。

## Actors / Owners
- Owner: Product
- Readers: 架构、前端、后端、测试

## Interfaces / Types
`NFR-001: MUST - 聊天输入后 1 秒内进入可见的执行中状态`

`NFR-002: MUST - Live Timeline 事件展示延迟应控制在 500ms 内（95th percentile）`

`NFR-003: MUST - ReplayDocument 生成成功率在复杂任务上达到 80% 以上`

`NFR-004: MUST - 运行资产落盘失败必须可见且可追踪`

`NFR-005: MUST - 本地工作区路径与产物链接必须保持可解析`

`NFR-006: SHOULD - UI 在 1000+ 事件的时间线下仍能可用浏览`

`NFR-007: MUST - 人工介入、审批和冲突决策必须持久化记录`

`NFR-008: SHOULD - 会话恢复后 2 秒内可重新看到最近的时间线和关键信息`

`NFR-009: MUST - 所有正式文档、回放和分析产物都应有稳定的本地路径`

`NFR-010: MUST - 1.0.0 不得把云端服务设为运行资产真相来源`

`NFR-011: SHOULD - 前端界面在桌面常见分辨率下保持双主轴可操作`

`NFR-012: MUST - 所有需求和功能验收必须可追踪到文档与证据`

## Behavior / Flow
### Category Mapping

| Category | NFR IDs |
|---|---|
| Performance | `001, 002, 006, 008` |
| Reliability | `003, 004, 005` |
| Governance | `007, 012` |
| Architecture Boundary | `009, 010` |
| Usability | `011` |

## Failure Modes
- 如果没有 NFR，Replay 和治理能力会被 UI 完成度掩盖。
- 如果本地路径和落盘语义不稳定，local-first 会被破坏。

## Observability
- NFR 应至少通过以下证据验证:
  - 事件延迟观测
  - Replay 成功率统计
  - 恢复耗时统计
  - 文档与产物链接完整性检查

## Open Questions / ADR Links
- 运行证据口径见 [37-规范验收矩阵.md](../../../30-operations/37-%E8%A7%84%E8%8C%83%E9%AA%8C%E6%94%B6%E7%9F%A9%E9%98%B5.md)
