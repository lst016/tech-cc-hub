---
doc_id: "PRD-100-CMP-006"
title: "CMP-006-ArtifactJumpPanel"
doc_type: "component"
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
  - "component"
  - "artifact"
---

# CMP-006-ArtifactJumpPanel

## Purpose
定义从聊天主视图进入 Replay / Analysis / Artifacts 的跳转面板。

## Interfaces / Types
- Inputs:
  - `artifact_summary`
- Outputs:
  - `replay_opened`
  - `analysis_opened`
  - `artifact_opened`

## Behavior / Flow
- 展示可用产物入口
- 对未生成产物展示明确状态
- 支持从同一面板进入不同产物

## Acceptance
- 入口可见
- 状态区分清晰
- 打开动作可回放

## Observability
- `replay_opened`
- `analysis_opened`
- `artifact_opened`
