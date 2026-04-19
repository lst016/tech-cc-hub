---
doc_id: "PRD-100-30"
title: "30-Epic索引"
doc_type: "index"
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
  - "index"
---

# 30-Epic索引

## Purpose
将 1.0.0 的需求组织成可实现、可排期、可验收的 Epic 集合。

## Scope
本文件定义 Epic 列表及其覆盖范围。

## Interfaces / Types
| Epic | File | Covers |
|---|---|---|
| `EP-001` | [31-Epic-交互工作台.md](./31-Epic-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md) | `FR-CHAT-*`, 部分 `FR-WS-*` |
| `EP-002` | [32-Epic-任务编排与Worker.md](./32-Epic-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md) | `FR-GRAPH-*` |
| `EP-003` | [33-Epic-证据闭环.md](./33-Epic-%E8%AF%81%E6%8D%AE%E9%97%AD%E7%8E%AF.md) | `FR-EVID-*`, 部分 `NFR-*` |
| `EP-004` | [34-Epic-Spec资产中心.md](./34-Epic-Spec%E8%B5%84%E4%BA%A7%E4%B8%AD%E5%BF%83.md) | `FR-SPEC-*` |
| `EP-005` | [35-Epic-治理与系统能力.md](./35-Epic-%E6%B2%BB%E7%90%86%E4%B8%8E%E7%B3%BB%E7%BB%9F%E8%83%BD%E5%8A%9B.md) | `FR-GOV-*`, 部分 `FR-WS-*`, 部分 `NFR-*` |

Story Packs:
- [36-StoryPack-EP-001-交互工作台.md](./36-StoryPack-EP-001-%E4%BA%A4%E4%BA%92%E5%B7%A5%E4%BD%9C%E5%8F%B0.md)
- [37-StoryPack-EP-002-任务编排与Worker.md](./37-StoryPack-EP-002-%E4%BB%BB%E5%8A%A1%E7%BC%96%E6%8E%92%E4%B8%8EWorker.md)

## Behavior / Flow
推荐实现顺序：
1. `EP-001`
2. `EP-002`
3. `EP-003`
4. `EP-004`
5. `EP-005`

建议继续拆分顺序：
1. 先写 Epic
2. 再写对应 Story Pack
3. 最后落地为页面 / API / 任务单

## Failure Modes
- 若 Epic 不对齐 FR，版本将无法被稳定拆排期。

## Observability
- 每个 Epic 都应产出:
  - 用户故事
  - 验收口径
  - 依赖说明

## Open Questions / ADR Links
- 交付计划见 [43-迭代计划与发布验收.md](../40-delivery/43-%E8%BF%AD%E4%BB%A3%E8%AE%A1%E5%88%92%E4%B8%8E%E5%8F%91%E5%B8%83%E9%AA%8C%E6%94%B6.md)
