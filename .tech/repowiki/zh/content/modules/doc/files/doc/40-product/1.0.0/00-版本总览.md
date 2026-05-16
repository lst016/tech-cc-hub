# doc/40-product/1.0.0/00-版本总览.md

> 模块：`doc` · 语言：`markdown` · 行数：119

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-00"
title: "00-版本总览"
doc_type: "prd"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-05-11"
owners:
  - "Product"
tags:
  - "claw"
  - "docs"
  - "1.0.0"
  - "product"
  - "prd"
---

# 00-版本总览

## Purpose
定义 CLAW `1.0.0` 版本的产品目标、价值主张、交付范围和文档结构，作为当前版本 PRD 的主入口。

## Scope
本文件覆盖 `1.0.0` 的版本目标和文档导航。
本文件不直接承载详细 FR/NFR 或开发任务拆解。

## Actors / Owners
- Owner: Product
- Readers: 项目负责人、前端、后端、架构、评审者

## Inputs / Outputs
- Inputs: [00-产品定义.md](../../00-overview/00-%E4%BA%A7%E5%93%81%E5%AE%9A%E4%B9%89.md), [04-问题定义与成功指标.md](../../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md), [34-MVP切片与迭代路线图.md](../../30-operations/34-MVP%E5%88%87%E7%89%87%E4%B8%8E%E8%BF%AD%E4%BB%A3%E8%B7%AF%E7%BA%BF%E5%9B%BE.md)
- Outputs: 版本目标、范围声明、版本文档树

## Core Concepts
- `Release 1.0.0`: CLAW 的第一个正式产品化版本，目标是跑通 `交互控制 + 任务编排 + 证据闭环 + Spec 资产沉淀` 的最小强闭环。
- `Primary Interactive Agent`: 聊天界面当前唯一交互 Agent，候选仅 `Claude Code` / `Codex`，默认 `Claude Code`。
- `Evidence Loop`: 事件流、时间线、回放和分析报告形成的证据链。

## Behavior / Flow
### Release Thesis

`1.0.0` 要验证的不是“再造一个 Agent”，而是以下判断：

1. 高频 Agent 用户是否愿意在 CLAW 中而不是终端里治理复杂任务。
2. 可回放的证据链是否显著提高任务可解释性和接管效率。
3. workflow / skills / policies 是否能在产品层沉淀成可复用资产。

### Release Goals

| Goal ID | Goal | Success Signal |
|---|---|---|
| `G1` | 跑通单聊天会话到事件时间线的闭环 | 用户能看到结构化执行过程 |
| `G2` | 跑通 Task Graph + WorkerRun 的复杂任务闭环 | 至少 1 类复杂任务可拆分与合并 |
| `G3` | 跑通 Replay + Analysis 的证据闭环 | 复杂任务可生成回放与分析报告 |
| `G4` | 跑通 SpecAsset 的附着、复用和修订 | 至少形成 3 类可复用资产 |

### Document Package

- [01-发布目标与范围.md](./01-%E5%8F%91%E5%B8%83%E7%9B%AE%E6%A0%87%E4%B8%8E%E8%8C%83%E5%9B%B4.md)
- [02-角色与使用场景.md](./02-%E8%A7%92%E8%89%B2%E4%B8%8E%E4%BD%BF%E7%94%A8%E5%9C%BA%E6%99%AF.md)
- [03-竞品功能点PRD.md](./03-%E7%AB%9E%E5%93%81%E5%8A%9F%E8%83%BD%E7%82%B9PRD.md)
- [04-竞品详细功能PRD.md](./04-%E7%AB%9E%E5%93%81%E8%AF%A6%E7%BB%86%E5%8A%9F%E8%83%BDPRD.md)
- [17-竞品功能拆解索引](./10-requirements/17-%E7%AB%9E%E5%93%81%E5%8A%9F%E8%83%BD%E6%8B%86%E8%A7%A3/00-%E7%AB%9E%E5%93%81%E5%8A%9F%E8%83%BD%E7%B4%A2%E5%BC%95.md)
- [10-需求索引.md](./10-requirements/10-%E9%9C%80%E6%B1%82%E7%B4%A2%E5%BC%95.md)
- [20-NFR-质量属性.md](./20-quality/20-NFR-%E8%B4%A8%E9%87%8F%E5%B1%9E%E6%80%A7.md)
- [30-Epic索引.md](./30-epics/30-Epic%E7%B4%A2%E5%BC%95.md)
- [40-开发索引.md](./40-delivery/40-%E5%BC%80%E5%8F%91%E7%B4%A2%E5%BC%95.md)
- [64-实施计划-执行可观测层详细开发方案.md](./40-delivery/64-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92-%E6%89%A7%E8%A1%8C%E5%8F%AF%E8%A7%82%E6%B5%8B%E5%B1%82%E8%AF%A6%E7%BB%86%E5%BC%80%E5%8F%91%E6%96%B9%E6%A1%88.md)
- [50-需求追踪矩阵.md](./50-traceability/50-%E9%9C%80%E6%B1%82%E8%BF%BD%E8%B8%AA%E7%9F%A9%E9%98%B5.md)

## Recent Additions

- [18-PRD-Trace Workbench参考图拆解与页面重构.md](./10-requirements/18-PRD-Trace%20Workbench%E5%8F%82%E8%80%83%E5%9B%BE%E6%8B%86%E8%A7%A3%E4%B8%8E%E9%A1%B5%E9%9D%A2%E9%87%8D%E6%9E%84.md)
- [65-Trace Workbench截图一致性核对表.md](./40-delivery/65-Trace%20Workbench%E6%88%AA%E5%9B%BE%E4%B8%80%E8%87%B4%E6%80%A7%E6%A0%B8%E5%AF%B9%E8%A1%A8.md)
- [66-设计方案-Workflow与Skill回放Benchmark.md](./40-delivery/66-%E8%AE%BE%E8%AE%A1%E6%96%B9%E6%A1%88-Workflow%E4%B8%8ESkill%E5%9B%9E%E6%94%BEBenchmark.md)
- [70-browser-workbench-dev-plan.md](./70-browser-workbench-dev-plan.md)

## Interfaces / Types
版本文档主线：
- `Goals`
- `Scope`
- `Requirements`
- `Epics`
- `Delivery`
- `Traceability`

## Failure Modes
- 若没有版本化 PRD，后续实现会重新回到架构文档里找零散要求。
- 若把版本目标直接等同于全部架构能力，会导致 1.0.0 失焦。

## Observability
- 本版本的主要产品证据:
  - `replay_generation_rate`
  - `spec_asset_reuse_rate`
  - `human_intervention_rate`
  - `cross_agent_task_success_rate`

## Open Questions / ADR Links
- 详细价值假设见 [04-问题定义与成功指标.md](../../00-overview/04-%E9%97%AE%E9%A2%98%E5%AE%9A%E4%B9%89%E4%B8%8E%E6%88%90%E5%8A%9F%E6%8C%87%E6%A0%87.md)

## 软件发布记录

### v0.1.15 (2026-05-11)

- Git Workbench 对齐：默认打开"变更"Tab、Git 模式不再意外关闭左侧栏、变更列表以文件视图展示
- MCP Registry 接入：内置 MCP 注册表统一管理、Figma 官方插件集成
- 认证集成：Codex OAuth 代理支持、Anthropic API 代理
- 浏览器标注优化：标注卡片展示元素内容、hover 显示完整的 target 信息、限制长文本/selector/源码路径
- 设置面板：模型列表可折叠/展开、暂时隐藏不可用的 Figma Agent 引导

### v0.1.14 (2026-05-11)

- Git Workbench 核心：阶段/取消阶段按钮改为 +/- 图标、修复"全部暂存"不移动文件的问题、commit 区域新增 AI 自动填充和默认中文摘要
- 日志页：保持浅色主题、窄布局、限制滚动、修复 graph 线条和 diff 行号
- 浏览器标注桥接：标注卡片携带 element content、组件栈路径、源码候选位置
- 设
... (truncated)
```
