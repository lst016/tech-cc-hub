# doc/10-architecture/16-用量与上下文采集架构.md

> 模块：`doc` · 语言：`markdown` · 行数：364

## 文件职责

描述执行用量采集（SDKResultMessage）和上下文构成采集（Prompt buckets/segments）的完整链路

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "16"
title: "16-用量与上下文采集架构"
doc_type: "architecture"
layer: "L1"
status: "active"
version: "1.0.0"
last_updated: "2026-05-06"
owners:
  - "tech-cc-hub Core"
tags:
  - "tech-cc-hub"
  - "usage"
  - "telemetry"
  - "architecture"
  - "L1"
---

# 用量与上下文采集架构

## 1. 概述

本文档描述 tech-cc-hub 中"用量数据"的完整采集链路。用量数据包含两个维度：

| 维度 | 说明 | 典型字段 |
|------|------|---------|
| **执行用量** | Agent 每次运行的资源消耗 | input/output tokens、消耗金额(USD)、耗时(ms) |
| **上下文构成** | 发送给模型的 Prompt 由哪些部分组成，每部分大小 | buckets/segments 结构，按来源分类的字符数和 token 估算 |

两者互相独立但互补：执行用量回答"花了多少"，上下文构成回答"花在哪里"。

---

## 2. 执行用量采集

### 2.1 数据来源

执行用量的原始数据来自 **Claude Agent SDK** 的 `SDKResultMessage`。SDK 在每次 `query()` 调用完成后返回该消息，包含：

```
SDKResultMessage
 ├── duration_ms          // 总运行时长（毫秒）
 ├── total_cost_usd       // 总估算成本（美元）
 ├── usage
 │    ├── input_tokens
 │    ├── output_tokens
 │    ├── cache_read_input_tokens
 │    ├── cache_creation_input_tokens
 │    └── web_search_requests
 ├── modelUsage           // 按模型细分的用量（Record<string, ModelUsage>）
 └── num_turns            // 交互轮数
```

> 引用：`node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` L3119-3162

### 2.2 主链路：会话消息流

这是用量采集的**主路径**，覆盖每一次聊天会话的执行。

```
┌──────────────────┐
│  Claude Agent SDK │  query() 执行完成后 yield SDKResultMessage
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  runner.ts       │  runClaude() — 通过 for await (const message of q) 接收
│  (src/electron/  │  将每条 SDKMessage 通过 onEvent() 广播出去
│   libs/runner.ts)│
└────────┬─────────┘
         │  onEvent({ type: "stream.message", payload: { sessionId, message } })
         ▼
┌──────────────────┐
│  ipc-handlers.ts │  emit() 函数 — 两条并行路径：
│  (src/electron/  │
│   ipc-handlers.ts│  ┌─► session-store.recordMessage() → SQLite sessions.db
│   L423-492)       │  │   messages 表 (id, session_id, data JSON, created_at)
│                   │  │   data 列包含完整的 SDKResultMessage（含 usage 字段）
│                   │  │
│                   │  └─► broadcast() → webContents.send("server-event", ...)
│                   │       → 渲染进程接收后用于实时 UI 展示
└──────────────────┘
```

**代码引用**：

- `runner.ts` L438-458：`for await` 循环 yield SDKMessage，L449 检测到 `message.type === "result"` 时发送 `session.status`。
- `ipc-handlers.ts` L423-492：`emit()` 函数，先 persist 再 broadcast。
- `session-store.ts` L413-434：`recordMessage()` 将消息 JSON 写入 SQLite。

### 2.3 子链路：任务系统用量

任务系统（/task 功能）独立跟踪每个执行任务的 token 和成本。

```
┌──────────────────┐
│  task/executor.ts │  extractUsage() — 从每条 SDK 消息中扫描 usage 字段
│  L772-786         │  查找 input_tokens / output_tokens / total_cost_usd
└────────┬─────────┘
         │  每次检测到新用量时调用 repo.recordUsage()
         ▼
┌──────────────────┐
│  task/repository │  更新 tasks 和 task_executions 表的
│  .ts L742-769     │  input_tokens / output_tokens / estimated_cost_usd 列
└──────────────────┘
```

任务数据库 schema（`repository.ts` L40-86）：

```sql
CREATE TABLE tasks (
  ...
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  ...
);

CREATE TABLE task_executions (
  ...
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd REAL NOT NULL DEFAULT 0,
  ...
);
```

> `executor.ts` L396-400：`this.repo.recordUsage({ inputTokens, outputTokens, estimatedCostUsd })`

### 2.4 UI 侧用量提取

渲染进程通过 `ActivityRailModel` 从已持久化的会话消息中重建用量指标。

```
src/shared/activity-rail-model.ts L1968-1975:

if (message.type === "result") {
  const result = message as SDKResultMessage;
  latestDurationMs = result.duration_ms ?? latestDurationMs;
  latestInputTokens = result.usage?.input_tokens ?? latestInputTokens;
  latestOutputTokens = result.usage?.output_tokens ?? latestOutputTokens;
  latestCostUsd = result.total_cost_usd ?? latestCostUsd;
}
```

这些值聚合到 `ActivityRailModel.summary`（L2642-2683），产出：
- `durationLabel` — 格式化耗时
- `inputLabel` / `contextLabel` / `outputLabel` — 字符和 token 计数
- `costLabel` — 格式化 USD 成本
- `successCount` / `failureCount`

---

## 3. 上下文构成采集（Prompt Ledger）

### 3.1 设计目的

每一次 `session.start` / `session.continue` 请求发送到 SDK 之前，系统会分析即将发送的 Prompt 的**组成结构**，生成一张"构成清单"。这张清单回答：

- 总字符数和估算 token 数是多少？
- 系统指令占多少？历史对话占多少？用户输入占多少？
- 哪些部分可能存在优化空间（过长、歧义引用、工具载荷过大）？

### 3.2
... (truncated)
```
