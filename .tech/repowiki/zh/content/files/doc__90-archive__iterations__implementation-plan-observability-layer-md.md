# doc/90-archive/iterations/implementation-plan-observability-layer.md

> 模块：`doc` · 语言：`markdown` · 行数：739

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-64"
title: "64-实施计划-执行可观测层详细开发方案"
doc_type: "delivery"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "Product"
  - "Engineering"
tags:
  - "delivery"
  - "observability"
  - "activity-rail"
  - "trace"
  - "workbench"
sources:
  - "../10-requirements/17-竞品功能拆解/13-执行可观测层.md"
  - "../10-requirements/17-竞品功能拆解/13-执行可观测层-资源附录.md"
  - "./63-实施计划-会话执行分析与右栏增强.md"
  - "https://openai.github.io/openai-agents-python/tracing/"
  - "https://docs.langchain.com/langsmith/observability-concepts"
  - "https://langfuse.com/docs/observability/data-model"
  - "https://adk.dev/integrations/bigquery-agent-analytics/"
  - "https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/"
  - "https://arize-ai.github.io/openinference/spec/"
---

# 64-实施计划-执行可观测层详细开发方案

## Purpose
把 `13-执行可观测层` 从产品 PRD 继续下压成可以直接拆给前端、共享模型层、Electron 主进程和 QA 执行的实施方案。本文不是竞品分析，也不是泛泛需求说明，而是围绕当前代码现状，给出实际开发路径、文件改造清单、任务切片、验收方式和交付顺序。

## Positioning
这份文档与已有文档的关系如下：

| 文档 | 作用 | 关系 |
|---|---|---|
| [13-执行可观测层.md](../10-requirements/17-%E7%AB%9E%E5%93%81%E5%8A%9F%E8%83%BD%E6%8B%86%E8%A7%A3/13-%E6%89%A7%E8%A1%8C%E5%8F%AF%E8%A7%82%E6%B5%8B%E5%B1%82.md) | 定义产品目标、能力边界和资源入口 | 本文的需求来源 |
| [13-执行可观测层-资源附录.md](../10-requirements/17-%E7%AB%9E%E5%93%81%E5%8A%9F%E8%83%BD%E6%8B%86%E8%A7%A3/13-%E6%89%A7%E8%A1%8C%E5%8F%AF%E8%A7%82%E6%B5%8B%E5%B1%82-%E8%B5%84%E6%BA%90%E9%99%84%E5%BD%95.md) | 保留外部资源与可抄点 | 本文的外部基线 |
| [63-实施计划-会话执行分析与右栏增强.md](./63-%E5%AE%9E%E6%96%BD%E8%AE%A1%E5%88%92-%E4%BC%9A%E8%AF%9D%E6%89%A7%E8%A1%8C%E5%88%86%E6%9E%90%E4%B8%8E%E5%8F%B3%E6%A0%8F%E5%A2%9E%E5%BC%BA.md) | 更偏第一阶段实现计划 | 本文在其基础上扩写并细化 |

## Goal
在不改变项目 `chat-first` 主交互形态的前提下，把右侧栏演进成一个高密度、可复盘、可分析、可扩展的 `agent workbench`，让用户能够在单会话内完成以下动作：

1. 看清任务步骤和真实执行节点。
2. 点开任意节点查看结构化详情与原始内容。
3. 在任务级看到输入、上下文、输出、耗时和成败。
4. 在上下文分布里理解 token / chars 是怎么被吃掉的。
5. 在错误节点、慢节点和长上下文节点之间快速定位问题。

## Delivery Principles
本轮实施必须遵守以下原则：

1. `不新建独立分析页，先把右栏做透`
当前版本优先把主界面右侧的执行可观测层打磨完整，不先引入新的路由页。

2. `共享模型先稳定，再做 UI 花活`
如果 `activity-rail-model` 的对象定义不稳定，所有 UI 改造都会反复返工。

3. `默认高密度，按需展开`
主列表只展示摘要和关键指标，深内容放进抽屉、弹窗和长文本查看器。

4. `优先对齐行业对象模型，不重新造轮子`
内部命名可以中文化，但数据语义尽量贴近 `trace / step / node / observation / span / session`。

5. `Electron 真窗口验收优先于纯构建成功`
尤其是原始内容区、抽屉层级、滚动体验、虚拟列表和明暗对比，必须在 Electron 真窗口确认。

## Current Baseline
结合当前代码与项目接力上下文，现状如下。

### 已有实现
- 右栏已有 `ActivityRail` 主组件。
- 已有 `VirtualizedRailList` 支撑大列表滚动。
- `buildActivityRailModel` 已能生成 `timeline`、`taskSteps`、`executionSteps`、`analysisCards`、`contextDistribution`。
- 节点详情已从底部区域迁移到右侧抽屉。
- 工具详情已从直接展示 JSON 改为结构化 `detailSections`。
- 指标已用单行表格式展示 `输入 | 上下文 | 输出 | 耗时 | 成败`。
- 上下文分布弹窗已存在。

### 已知问题
- `ActivityRail.tsx` 仍偏大，渲染职责混在一个文件里。
- 原子节点类型虽然已有 tone / layer / filterKey / stageKind，但缺少更稳定的 `node kind taxonomy`。
- 结构化详情的工具类型特化还不够细，`Read / Edit / Bash / Browser / MCP` 的摘要仍有提升空间。
- 上下文分布目前更偏 UI 模型，尚未完全对齐外部语义标准。
- 会话级聚合和 session replay 还没有真正做起来。
- 指标层还没有成本、重试、error rate、tool provenance 等更细维度。

### 当前关键文件
| 文件 | 当前角色 | 本轮责任 |
|---|---|---|
| `src/shared/activity-rail-model.ts` | 共享模型层，负责从消息流构建右栏 view model | 本轮核心改造文件 |
| `src/ui/components/ActivityRail.tsx` | 右栏 UI 容器与大部分渲染逻辑 | 本轮需要拆分职责 |
| `src/ui/components/VirtualizedRailList.tsx` | 通用虚拟列表组件 | 需要适配滚动定位与动态高度场景 |
| `src/ui/store/useAppStore.ts` | SessionView 与消息流状态承载 | 需要承接更稳定的右栏输入 |
| `src/electron/ipc-handlers.ts` | 会话历史和事件流分发 | 需要评估是否补充会话级 analytics 事件 |
| `src/electron/libs/session-store.ts` | better-sqlite3 存储层 | 需要评估是否记录额外聚合字段 |
| `src/electron/types.ts` | 前后端事件与消息类型 | 需要预留可观测层事件契约 |
| `src/electron/activity-rail-model.test.ts` | 当前模型层单测 | 需要扩容更多 case |

## Target Deliverables
本轮交付物不是一个组件，而是一整套执行可观测层能力包。

### 必交付
- 稳定的 `ActivityRailModel` 对象模型
- 高密度 `任务步骤 + 原子节点` 双层视图
- 结构化 `工具输入 / 输出` 详情
- 统一的 `节点详情抽屉`
- 可点击的 `上下文分布`
- 更细的模型层单测
- Electron 真窗口 QA 清单与截图验证结论

### 建议一并交付
- 节点专属摘要生成器
- 节点长文本查看器
- session 级聚合底座
- 成本 / provenance 预留字段

## External Borrow Strategy
不是所有外部能力都要现在做，但实现时应该有明确借法。

| 来源 | 我们直接借的东西 | 本轮是否落地 |
|---|---|---|
| OpenAI Tracing | `trace / span / group_id` 语义 | 是，落到内部模型命名 |
| LangSmith | `trace / run / thread` 三层关系 | 是，落到任务/节点/会话分层 |
| Langfuse | observation-centric 模型、sessions、agent graph | 是，先落 observation-centric 思路与 session 预留 |
| OpenTelemetry GenAI | tool args/result、mess
... (truncated)
```
