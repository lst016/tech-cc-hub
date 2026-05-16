# doc/40-product/1.0.0/30-epics/33-Epic-证据闭环.md

> 模块：`doc` · 语言：`markdown` · 行数：54

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-33"
title: "33-Epic-证据闭环"
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
  - "evidence"
---

# 33-Epic-证据闭环

## Purpose
定义时间线、Replay 和 Analysis 作为版本核心差异化能力的交付目标。

## Behavior / Flow
### Business Value
让任务不仅“执行过”，而且“可以解释、比较、复盘和改进”。

### Covers
- `FR-EVID-001 ~ 006`
- `NFR-001 ~ 004`

### User Stories

`US-201: As a 高频 Agent 用户, I want a live timeline so that I can see what the system is doing right now.`

`US-202: As a 高频 Agent 用户, I want a replay document after a complex task so that I can understand the path to the result.`

`US-203: As a 高频 Agent 用户, I want a basic analysis report so that I can see intervention and failure patterns.`

`US-204: As a 高频 Agent 用户, I want to compare two runs so that I can tell whether my spec changes helped.`

### Done Criteria
- 时间线可用
- Replay 生成可用
- Analysis 生成可用
- 同类运行对比至少支持基础指标

## Observability
- 关注:
  - `event_normalized`
  - `replay_generated`
  - `analysis_generated`
  - `replay_compare_requested`

```
