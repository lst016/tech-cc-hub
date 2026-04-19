---
doc_id: "PRD-100-CTR-007"
title: "CTR-007-ReplayController"
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
  - "replay"
---

# CTR-007-ReplayController

## Purpose
定义 ReplayDocument 生成与读取的 controller 边界。

## Interfaces / Types
- Inputs:
  - `generate replay request`
  - `get replay request`
- Outputs:
  - `replay summary`
  - `replay document`

## Acceptance
- 可为复杂任务生成 Replay
- 读取 Replay 可用
- 失败原因可见

## Observability
- `replay_generated`
- `replay_generation_failed`
