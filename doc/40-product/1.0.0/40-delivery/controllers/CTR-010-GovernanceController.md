---
doc_id: "PRD-100-CTR-010"
title: "CTR-010-GovernanceController"
doc_type: "controller"
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
  - "controller"
  - "governance"
---

# CTR-010-GovernanceController

## Purpose
定义权限请求、冲突和人工介入记录的 controller 边界。

## Interfaces / Types
- Inputs:
  - `permission decision`
  - `conflict resolve action`
  - `human intervention record`
- Outputs:
  - `permission summary`
  - `conflict list`
  - `intervention log`

## Acceptance
- 权限请求可决策
- 冲突可收敛和处理
- 人工介入可回放

## Observability
- `permission_requested`
- `permission_decided`
- `conflict_detected`
- `conflict_resolved`
- `human_intervened`
