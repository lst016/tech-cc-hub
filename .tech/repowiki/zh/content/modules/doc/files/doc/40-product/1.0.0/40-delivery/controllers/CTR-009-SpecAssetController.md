# doc/40-product/1.0.0/40-delivery/controllers/CTR-009-SpecAssetController.md

> 模块：`doc` · 语言：`markdown` · 行数：42

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
