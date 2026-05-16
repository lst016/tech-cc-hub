# doc/_templates/AI-Spec-模板.md

> 模块：`doc` · 语言：`markdown` · 行数：68

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "AI-SPEC-TEMPLATE"
title: "AI-Spec 模板"
doc_type: "template"
layer: "meta"
status: "template"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "template"
  - "ai-spec"
---

# AI-Spec 模板

```yaml
---
doc_id: "XX"
title: "文档标题"
doc_type: "contract"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
---
```

## Purpose
这份规范解决什么问题，为什么现在需要定义它。

## Scope
明确包含内容与不包含内容，避免职责外溢。

## Actors / Owners
列出主要读者、实现方、依赖方与决策 owner。

## Inputs / Outputs
说明输入、输出、持久化产物与上下游依赖。

## Core Concepts
定义关键对象、术语与约束。

## Behavior / Flow
描述主流程、关键状态流转和决策点。

## Interfaces / Types
定义接口、能力、事件、数据结构或文档归属。

## Failure Modes
列出失败、降级、冲突、人工接管与回退策略。

## Observability
定义必须记录的事件、指标、时间线或回放点。

## Open Questions / ADR Links
记录未决策项、后续 ADR 或相关规范链接。

```
