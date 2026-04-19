---
doc_id: "PRD-100-CTR-009"
title: "CTR-009-SpecAssetController"
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
  - "spec"
---

# CTR-009-SpecAssetController

## Purpose
定义 SpecAsset 创建、绑定、版本与比较的 controller 边界。

## Interfaces / Types
- Inputs:
  - `create spec`
  - `bind spec`
  - `revise spec`
- Outputs:
  - `spec summary`
  - `spec version history`

## Acceptance
- 四类资产可管理
- 资产可绑定到 Session / Task
- 版本历史可读

## Observability
- `spec_created`
- `spec_bound`
- `spec_revised`
