# doc/40-product/1.0.0/40-delivery/components/CMP-009-DependencyEditor.md

> 模块：`doc` · 语言：`markdown` · 行数：45

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-CMP-009"
title: "CMP-009-DependencyEditor"
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
  - "dependency"
---

# CMP-009-DependencyEditor

## Purpose
定义依赖配置组件的职责。

## Interfaces / Types
- Inputs:
  - `candidate_nodes`
  - `current_dependencies`
- Outputs:
  - `task_dependency_added`
  - `task_dependency_removed`

## Behavior / Flow
- 添加前置依赖
- 删除依赖
- 阻止循环依赖

## Acceptance
- 依赖创建可用
- 循环依赖被阻止
- 变更立即反映到图结构

## Observability
- `task_dependency_added`
- `task_dependency_removed`

```
