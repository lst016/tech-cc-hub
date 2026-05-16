# doc/40-product/1.0.0/10-requirements/17-竞品功能拆解/13-执行可观测层-资源附录.md

> 模块：`doc` · 语言：`markdown` · 行数：274

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-17-13A"
title: "13-执行可观测层-资源附录"
doc_type: "appendix"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "Product"
tags:
  - "observability"
  - "trace"
  - "resource"
  - "benchmark"
sources:
  - "https://docs.langchain.com/langsmith/observability-concepts"
  - "https://docs.langchain.com/langsmith/observability-studio"
  - "https://openai.github.io/openai-agents-python/tracing/"
  - "https://developers.openai.com/api/docs/guides/trace-grading"
  - "https://platform.openai.com/docs/guides/agent-builder"
  - "https://langfuse.com/docs/observability/overview"
  - "https://langfuse.com/docs/observability/data-model"
  - "https://langfuse.com/docs/observability/features/sessions"
  - "https://langfuse.com/docs/observability/features/token-and-cost-tracking"
  - "https://langfuse.com/docs/observability/features/mcp-tracing"
  - "https://langfuse.com/docs/observability/features/agent-graphs"
  - "https://arize.com/docs/phoenix"
  - "https://arize.com/docs/phoenix/tracing/tutorial"
  - "https://arize.com/docs/phoenix/tracing/concepts-tracing/how-tracing-works"
  - "https://adk.dev/integrations/bigquery-agent-analytics/"
  - "https://adk.dev/integrations/cloud-trace/"
  - "https://adk.dev/integrations/freeplay/"
  - "https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/develop/trace-agents-sdk"
  - "https://grafana.com/whats-new/2024-09-24-explore-traces/"
  - "https://grafana.com/docs/grafana/latest/visualizations/explore/trace-integration/"
  - "https://wandb.ai/site/traces/"
  - "https://docs.wandb.ai/weave/guides/tracking/tracing"
  - "https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/"
  - "https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/"
  - "https://arize-ai.github.io/openinference/spec/"
  - "https://arize.com/wp-content/uploads/2023/11/LLM-Observability-Checklist.pdf"
  - "https://arize.com/wp-content/uploads/2023/11/LLM-Observability-101-1.pdf"
---

# 13-执行可观测层-资源附录

## Purpose
这个附录不是单纯的链接仓库，而是给 `13-执行可观测层` 提供一个可持续扩展的资源地图。后面继续“抄”时，优先从这里沿着官方 URL 往下深挖，不需要重新散搜。

## Resource Landscape
外部资源大体可以拆成四类：

1. `对象模型资源`
定义 trace、span、thread、session、run、call、observation 这些核心对象。

2. `产品形态资源`
提供 trace tree、timeline、detail drawer、session replay、agent graph、long text viewer 这些 UI 形态。

3. `指标与聚合资源`
提供 latency、token、cost、RED、会话级聚合、跨 trace 指标等口径。

4. `标准与协议资源`
提供 GenAI attributes、MCP span naming、AI span kind taxonomy 等标准化字段。

## A. 对象模型资源

| 资源 | 关键信息 | 可抄点 | URL |
|---|---|---|---|
| LangSmith Observability Concepts | `trace = 一次操作`，`run = 离散执行单元`，`thread = 多轮会话` | 我们可以把 `任务 / 节点 / 会话` 三层关系做得更稳定 | [docs.langchain.com/langsmith/observability-concepts](https://docs.langchain.com/langsmith/observability-concepts) |
| OpenAI Agents SDK Tracing | `trace` 表示一次端到端 workflow，`span` 表示有开始和结束时间的操作，`group_id` 用于串联同一会话多条 trace | 适合我们为 `sessionId / threadId / traceId` 建内部约束 | [openai.github.io/openai-agents-python/tracing/](https://openai.github.io/openai-agents-python/tracing/) |
| Langfuse Data Model | `observations` 是 trace 里的个体步骤，可嵌套；`sessions` 负责跨 trace 归组 | 我们的“原子节点”可直接对齐 observation | [langfuse.com/docs/observability/data-model](https://langfuse.com/docs/observability/data-model) |
| W&B Ops / Calls / Traces | `Op` 是版本化函数，`Call` 是一次执行，`Trace` 是 call tree，`Thread` 是整个会话 | 很适合我们理解“调用树”与“会话层”分离 | [docs.wandb.ai/weave/guides/tracking/tracing](https://docs.wandb.ai/weave/guides/tracking/tracing) |
| OpenInference Specification | 定义 AI 观测的 trace、span、span kind、attributes | 适合作为我们节点类型和 span kind 的底层语义 | [arize-ai.github.io/openinference/spec/](https://arize-ai.github.io/openinference/spec/) |

## B. 产品形态资源

| 资源 | 关键信息 | 可抄点 | URL |
|---|---|---|---|
| LangSmith Studio Observability | 支持从 trace 进入节点级调试，查看 LLM runs，并把节点加入 dataset | 可借“节点 -> 调试 -> 评估”的闭环结构 | [docs.langchain.com/langsmith/observability-studio](https://docs.langchain.com/langsmith/observability-studio) |
| Langfuse Overview | 页面级就把 `Trace Details / Sessions / Timeline / Agent Graphs / Dashboard` 作为核心入口 | 可借信息架构，不要只做一条时间线 | [langfuse.com/docs/observability/overview](https://langfuse.com/docs/observability/overview) |
| Langfuse Sessions | 支持把多条 trace 聚成一个 session，并做 session replay | 我们后面做“整轮会话复盘”时直接借
... (truncated)
```
