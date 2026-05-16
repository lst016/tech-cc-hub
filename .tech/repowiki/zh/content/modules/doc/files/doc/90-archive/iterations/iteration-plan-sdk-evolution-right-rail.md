# doc/90-archive/iterations/iteration-plan-sdk-evolution-right-rail.md

> 模块：`doc` · 语言：`markdown` · 行数：349

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
doc_id: "PRD-100-68"
title: "68-迭代计划-SDK能力进化与右栏深化"
doc_type: "delivery"
layer: "PM"
status: "in-progress"
version: "1.0.0"
last_updated: "2026-04-30"
owners:
  - "Product"
  - "Engineering"
tags:
  - "delivery"
  - "sdk-upgrade"
  - "activity-rail"
  - "observability"
  - "iteration-plan"
sources:
  - "../10-requirements/17-竞品功能拆解/13-执行可观测层.md"
  - "./64-实施计划-执行可观测层详细开发方案.md"
  - "SDK 0.2.114 → 0.2.123 changelog"
---

# 68-迭代计划-SDK能力进化与右栏深化

## Purpose

在 SDK 从 `0.2.114` 升级到 `0.2.123` 的窗口上，把新版本提供的能力接入 tech-cc-hub，并围绕右侧"执行可观测层"做一次有方向的进化。本文定义迭代目标、分相任务、改造文件清单、验收方式和交付顺序。

## Baseline（当前状态）

### SDK 侧
- 版本已从 `0.2.114` 升级到 `0.2.123`。
- `runner.ts` 中 `query()` 调用尚未启用以下新能力：
  - `agentProgressSummaries` — 子 Agent 进度摘要
  - `forwardSubagentText` — 子 Agent 完整思考文本
  - `outputFormat` — 结构化输出约束
  - `sessionStore` — 外部存储双写
  - `managedSettings` — 企业策略管控
- `PostToolUse` hook 中仍使用已弃用的 `updatedMCPToolOutput`，`0.2.121` 已提供新 API `updatedToolOutput`。

### 右栏侧
- `ActivityRail` 已完成节点指标单行表、二级详情抽屉、上下文分布弹窗、结构化详情等改造。
- `buildActivityRailModel` 从 AI 回复里正则解析任务步骤（`parseExplicitPlan`），靠模式匹配，不够可靠。
- 右侧栏目前只能看到节点完成后的结果，中间过程是黑的——子 Agent 在执行什么、当前卡在哪一步，用户完全看不到。
- 时间线缺少子 Agent 维度的执行节点。

## 版本目标

1. 把 SDK 新能力接入 `runner.ts`，不改数据结构的前提下先跑起来。
2. 用 `agentProgressSummaries` 填补右侧栏"执行中间过程不可见"的空白。
3. 用 `outputFormat` 替换脆弱的正则解析，让任务步骤提取更可靠。
4. 把已弃用的 `updatedMCPToolOutput` 迁移到 `updatedToolOutput`。

## 分相任务

### 当前完成状态（截至 2026-04-30）

| Phase | 状态 | commit |
|-------|------|--------|
| Phase 1: SDK 新能力接入 | **已完成** | `46cfae5` |
| Phase 2: ActivityRail 中间过程可视化 | **已完成** | `46cfae5` |
| Phase 3: 结构化输出替换正则解析 | 未开始 | — |
| Phase 4: 体验打磨 | 未开始 | — |

**已知 Bug 修复**（已完成，未 push）:
- `task_updated` 节点状态未覆写导致"运行中任务"区块不消失。修复: `activity-rail-model.ts:2136` 直接覆写 `existing.metrics.status = "success"/"failure"`，不走 `mergeMetrics` 状态推断。

---

### Phase 1: SDK 新能力接入（预计 1-2 天）

目标：`runner.ts` 里加几行选项，不改数据结构，先让新消息流进来。

#### Task 1.1 — 启用 `agentProgressSummaries`

**文件**: `src/electron/libs/runner.ts`

```typescript
// query() options 中新增
agentProgressSummaries: true,
```

**效果**: 每个子 Agent 约每 30 秒产生一条 `task_progress` 消息，包含一句话进度描述。

**验收**:
- 启动 Electron 真窗口，发送一条涉及子 Agent 的请求。
- 在终端 `console.log` 确认 `task_progress` 消息到达 `sendMessage`。
- ActivityRail 当前会忽略未知消息类型，不会崩溃。

#### Task 1.2 — 启用 `forwardSubagentText`

**文件**: `src/electron/libs/runner.ts`

```typescript
forwardSubagentText: true,
```

**效果**: 子 Agent 的思考文本（`thinking` 块）会转发到前端。

**验收**:
- 同上，确认子 Agent 思考文本出现在消息流中。
- ActivityRail 当前对 `thinking` 类型已能处理（`content.type === "thinking"` 分支），子 Agent 思考文本会被计入上下文分布。

#### Task 1.3 — 迁移 `updatedMCPToolOutput` → `updatedToolOutput`

**文件**: `src/electron/libs/runner.ts`

SDK `0.2.121` 废弃了 `updatedMCPToolOutput`，新 API 是 `updatedToolOutput`。`PostToolUse` hook 中有 3 处使用：

- 行 ~1080 `updatedMCPToolOutput: createImageSummaryToolOutput(summary)`
- 行 ~1097 `updatedMCPToolOutput: createImageSummaryToolOutput(fallback)`
- 行 ~1119 `updatedMCPToolOutput: createImageSummaryToolOutput(replacementText)`

```typescript
// 旧
hookSpecificOutput: {
  hookEventName: "PostToolUse",
  additionalContext: "...",
  updatedMCPToolOutput: createImageSummaryToolOutput(summary),
}

// 新
hookSpecificOutput: {
  hookEventName: "PostToolUse",
  additionalContext: "...",
  updatedToolOutput: createImageSummaryToolOutput(summary),
}
```

**验收**: TypeScript 编译通过，`npm run transpile:electron` 无报错。

#### Task 1.4 — 清理失效的 `0.2.6` patch 文件

**文件**: `patches/@anthropic-ai%2Fclaude-agent-sdk@0.2.6.patch`

该 patch 针对旧版 SDK 的 `ProcessTransport.spawn()` → `fork()` 改造，hash 已完全对不上 `0.2.123`。自项目从 `0.2.114` 起就已失效，是一具"尸体"。

**操作**: 删除 `patches/` 目录下该文件，并确认 `package.json` 中无 `patch-package` 相关 postinstall hook 引用它。

**验收**: `npm install` 不报错，`npm run dev` 正常启动。

---

### Phase 2: ActivityRail 中间过程可视化（预计 2-3 天）

目标：让右侧栏在执行过程中展示"正在发生的事情"，而不是只展示已完成节点。

#### Task 2.1 — `activity-rail-model` 新增子 Agent 进度节点类型

**文件**: `src/shared/activity-rail-model.ts`

新增消息类型处理：

```typescript
// 在 buildActivityRailModel 的消息循环中新增
if (message.type === "task_progress") {
  // 产生一条 timeline 节点
  // nodeKind: "handoff" | "lifecycle"
  // statusLabel: "进行中"
  // 包含进度描述文本
}
```

进度消息的概要结构预期（依 SDK 实际返回调整）：

```typescript
type TaskProgressMessage = {
  type: "task_progress";
... (truncated)
```
