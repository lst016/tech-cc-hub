# doc/adr/ADR-005-SpecAsset版本治理策略.md

> 模块：`doc` · 语言：`markdown` · 行数：49

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "ADR-005"
title: "ADR-005-SpecAsset版本治理策略"
doc_type: "decision"
layer: "adr"
status: "active"
version: "1.0.0"
last_updated: "2026-04-19"
owners:
  - "CLAW Core"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "adr"
  - "spec-assets"
---

# ADR-005-SpecAsset版本治理策略

- Status: Accepted
- Date: 2026-04-19
- Owners: CLAW Core

## Context
CLAW 的核心差异之一是把 workflow、skills、prompts、policies 做成可复用的 SpecAsset。如果这些资产没有版本治理，它们很快会退化成另一堆散落的 markdown 和 prompt 片段。

## Decision
采用显式版本治理策略：
- 所有正式 `SpecAsset` 必须有稳定 `asset_id` 和 `version`
- 每次显著改动都必须记录 `change_reason`
- Session 必须记录消费了哪些 SpecAsset 版本
- 分析结论应尽量回链到相关 `SpecRevision`
- 一次性的 prompt 成功经验不得直接升级为 workflow

## Consequences
- 好处：
  - 可真正验证“调优前后”差异
  - 便于形成方法资产，而不是一次性经验
  - 为团队化和策略治理提供基础
- 代价：
  - 文档与实现层都需要维护版本和引用关系
  - 需要明确资产升级标准，避免泛化过度

## Links
- [31-Workflow与Skills体系规范.md](../30-operations/31-Workflow%E4%B8%8ESkills%E4%BD%93%E7%B3%BB%E8%A7%84%E8%8C%83.md)
- [04-问题定义与成功指标.md](../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md)
- [36-端到端场景样例.md](../30-operations/36-%E7%AB%AF%E5%88%B0%E7%AB%AF%E5%9C%BA%E6%99%AF%E6%A0%B7%E4%BE%8B.md)

```
