# doc/40-product/1.0.0/40-delivery/components/CMP-006-ArtifactJumpPanel.md

> 模块：`doc` · 语言：`markdown` · 行数：46

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
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

```
