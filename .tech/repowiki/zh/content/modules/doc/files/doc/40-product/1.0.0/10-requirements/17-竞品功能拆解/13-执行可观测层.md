# doc/40-product/1.0.0/10-requirements/17-竞品功能拆解/13-执行可观测层.md

> 模块：`doc` · 语言：`markdown` · 行数：497

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-17-13"
title: "13-执行可观测层"
doc_type: "prd"
layer: "PM"
status: "active"
version: "1.0.0"
last_updated: "2026-04-21"
owners:
  - "Product"
tags:
  - "zcode"
  - "observability"
  - "timeline"
  - "trace"
sources:
  - "https://zhipu-ai.feishu.cn/wiki/Qr2SwyBsTiSlaYkqBECcxCWnn4c"
  - "https://docs.langchain.com/langsmith/observability-concepts"
  - "https://openai.github.io/openai-agents-python/tracing/"
  - "https://developers.openai.com/api/docs/guides/trace-grading"
  - "https://langfuse.com/docs/observability/overview"
  - "https://arize.com/docs/phoenix/tracing/tutorial"
  - "https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/"
  - "https://arize-ai.github.io/openinference/spec/"
---

# 13-执行可观测层

## Goal
把 Agent 执行过程从“聊天黑盒”变成“可复盘、可解释、可定位、可优化”的执行工作台。右栏不是装饰，不是消息补充，也不是调试面板的堆砌，而是用户理解 Agent 是否靠谱的第一现场。

## Why This Matters
执行可观测层是竞品里最值得我们抄的一层，因为它同时解决了四个问题：

1. `信任问题`
用户不只想知道答案是什么，还想知道 Agent 做了什么、看了什么、调了什么工具、为什么失败。

2. `排障问题`
没有任务步骤、原子节点、工具输入输出和指标，用户与研发都只能盯着最终回复猜原因。

3. `优化问题`
没有分层指标和上下文分布，就无法知道一次任务为什么慢、为什么贵、为什么绕远路。

4. `产品差异问题`
普通聊天产品默认把“过程”藏起来；Agent 工作台的核心价值恰恰是把“过程”结构化地公开出来。

## Problem
传统聊天界面只关心最终回复，但 Agent 产品的真实价值来自执行过程。竞品这层的关键不是视觉效果，而是它能让用户立刻回答下面这些问题：

- 做了哪些任务步骤
- 哪些步骤是计划，哪些步骤真实执行了
- 调用了哪些工具、文件、检索、浏览器、终端动作
- 每个节点的输入是什么、输出是什么、有没有错误
- 花了多少时间、多少上下文、多少输出、多少成本
- 问题出在哪个节点、哪一段上下文、哪一个工具调用

## Product Thesis
我们的执行可观测层应该坚持以下判断：

1. `会话` 是用户入口，但 `执行轨迹` 才是 Agent 价值主体。
2. `任务步骤` 用来解释“意图推进”，`原子节点` 用来解释“真实执行”。
3. `指标` 不是单独页面，而是每个任务、每个节点都应该自带的二级语言。
4. `详情` 不应该沉到底部打断阅读，而应该通过右侧二级抽屉按需展开。
5. `上下文分布` 不是后端埋点附属报表，而是帮助用户理解“为什么这次调用变贵、变慢、变乱”的产品视图。

## Resource Registry
当前这一功能点已经有一批可以直接参考的外部资源，后续继续深挖时优先从这些入口继续：

| 类型 | 资源 | 我们能借什么 |
|---|---|---|
| 官方竞品来源 | [Z Code 官方 wiki](https://zhipu-ai.feishu.cn/wiki/Qr2SwyBsTiSlaYkqBECcxCWnn4c) | 竞品功能口径、命名、页面范围 |
| 官方 Agent tracing | [OpenAI Agents SDK Tracing](https://openai.github.io/openai-agents-python/tracing/) | trace/span 模型、默认采集范围、group_id 设计 |
| 官方 trace 评估 | [OpenAI Trace Grading](https://developers.openai.com/api/docs/guides/trace-grading) | trace 级评分、错误定位、回归验证 |
| 追踪数据模型 | [LangSmith Observability Concepts](https://docs.langchain.com/langsmith/observability-concepts) | trace/run/thread 三层模型 |
| 交互式调试形态 | [LangSmith Studio Observability](https://docs.langchain.com/langsmith/observability-studio) | 节点级调试、从 trace 回到 node |
| LLM 观测工作台 | [Langfuse Observability Overview](https://langfuse.com/docs/observability/overview) | trace 详情、sessions、timeline、cost |
| 会话重放 | [Langfuse Sessions](https://langfuse.com/docs/observability/features/sessions) | 跨 trace 的 session replay |
| 成本与 token 口径 | [Langfuse Token & Cost Tracking](https://langfuse.com/docs/observability/features/token-and-cost-tracking) | token/cost 统计维度 |
| 观察对象模型 | [Langfuse Data Model](https://langfuse.com/docs/observability/data-model) | observation-centric 模型 |
| MCP 链路串联 | [Langfuse MCP Tracing](https://langfuse.com/docs/observability/features/mcp-tracing) | client/server trace 串联 |
| Agent 图形视图 | [Langfuse Agent Graphs](https://langfuse.com/docs/observability/features/agent-graphs) | agent 图推断和嵌套呈现 |
| AI 观测与评估 | [Phoenix Tracing Tutorial](https://arize.com/docs/phoenix/tracing/tutorial) | trace + session + eval 三联动 |
| tracing 基础原理 | [Phoenix How Tracing Works](https://arize.com/docs/phoenix/tracing/concepts-tracing/how-tracing-works) | instrumentation/exporter/collector |
| 高密度事件分析 | [ADK BigQuery Agent Analytics](https://adk.dev/integrations/bigquery-agent-analytics/) | 事件 schema、trace_id/span_id、tool provenance |
| 云端 tracing | [ADK Cloud Trace](https://adk.dev/integrations/cloud-trace/) | 云上 trace 归集与分布式串联 |
| 观测平台接入 | [ADK Freeplay](https://adk.dev/integrations/freeplay/) | 观测、prompt、eval 一体化入口 |
| 企业平台观测 | [Azure AI Foundry Tracing](https://learn.microsoft.com/en-us/azure/foundry-classic/how-to/develop/trace-agents-sdk) | 多框架 tracing 接入口径 |
| 通用 trace 产品形态 | [Grafana Explore Traces](https://grafana.com/whats-new/2024-09-24-explore-traces/) | RED 指标、查询less 下钻、异常对比 |
| 通用 trace 联动 | [Grafana Trace View](https://grafana.com/docs/grafana/latest/visualizations/explore/trace-integration/) | trace-to-logs / metrics / profiles |
| 长文本 trace 详情 | [W&B Weave Traces](https://wandb.ai/site/traces/) | 长文本
... (truncated)
```
