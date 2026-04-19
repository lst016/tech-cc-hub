---
doc_id: "PRD-100-35"
title: "35-Epic-治理与系统能力"
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
  - "governance"
---

# 35-Epic-治理与系统能力

## Purpose
定义权限、冲突、人工介入和工作区边界的交付目标。

## Behavior / Flow
### Business Value
让用户能在风险和复杂度提升时仍然留在 CLAW 内完成治理。

### Covers
- `FR-GOV-001 ~ 006`
- `FR-WS-002 ~ 006`
- `NFR-005, 007, 009, 010, 012`

### User Stories

`US-401: As a 高频 Agent 用户, I want to approve or reject risky actions explicitly so that I stay in control.`

`US-402: As a 高频 Agent 用户, I want conflicts collected in one place so that I do not miss recovery work.`

`US-403: As a 高频 Agent 用户, I want every manual intervention captured as evidence so that analysis remains trustworthy.`

`US-404: As a 高频 Agent 用户, I want workspace files and artifacts linked to execution so that I can trust what changed.`

### Done Criteria
- 权限请求可见可决策
- 冲突列表可处理
- 人工介入有证据
- 工作区文件和产物能回链

## Observability
- 关注:
  - `permission_requested`
  - `permission_decided`
  - `conflict_detected`
  - `human_intervened`
