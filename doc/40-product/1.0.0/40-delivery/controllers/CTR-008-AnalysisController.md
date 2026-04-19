---
doc_id: "PRD-100-CTR-008"
title: "CTR-008-AnalysisController"
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
  - "analysis"
---

# CTR-008-AnalysisController

## Purpose
定义 AnalysisReport 生成与读取的 controller 边界。

## Interfaces / Types
- Inputs:
  - `generate analysis request`
  - `get analysis request`
- Outputs:
  - `analysis summary`
  - `analysis report`

## Acceptance
- 可生成基础分析报告
- 报告能回链到 Session / Task

## Observability
- `analysis_generated`
- `analysis_generation_failed`
