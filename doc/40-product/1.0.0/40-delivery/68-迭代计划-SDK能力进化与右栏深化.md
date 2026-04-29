---
doc_id: "PRD-100-68"
title: "68-迭代计划-SDK能力进化与右栏深化"
doc_type: "delivery"
layer: "PM"
status: "draft"
version: "1.0.0"
last_updated: "2026-04-29"
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
  task_id: string;
  agent_id?: string;
  summary: string;  // "正在读取配置文件" 之类的一句话描述
  elapsed_seconds?: number;
};
```

**验收**:
- `npm run test:activity-rail-model` 通过。
- 在 Electron 真窗口中，子 Agent 执行时右侧栏出现进度节点。

#### Task 2.2 — `ActivityRail` 支持"进行中"节点样式

**文件**: `src/ui/components/ActivityRail.tsx`

- 进度节点的 statusLabel 为"进行中"时，使用脉冲动画或闪烁指示器。
- 进度节点默认展开，显示进度描述。
- 多条进度消息合并为同一节点（按 `task_id` 去重，更新 summary）。

**验收**:
- 真窗口中进度节点有明显视觉区分（脉冲 / 闪烁）。
- 多条进度不会产生重复节点。

#### Task 2.3 — 子 Agent 执行轨迹独立分组

**文件**: `src/shared/activity-rail-model.ts`、`src/ui/components/ActivityRail.tsx`

- 在 `timeline` 中，子 Agent 的 tool_use 和进度节点归入独立分组。
- `ActivityTimelineItem` 增加 `parentAgentId?: string` 字段。
- 详情抽屉中显示"属于子 Agent: xxx"。

**验收**:
- 真窗口中子 Agent 的执行节点可以追溯到父 Agent。
- 时间线中不同 Agent 的节点有视觉区分。

---

### Phase 3: 结构化输出替换正则解析（预计 1-2 天）

目标：用 `outputFormat` 让 AI 以 JSON 输出任务计划，替代当前脆弱的 `parseExplicitPlan` 正则。

#### Task 3.1 — 按场景启用 `outputFormat`

**文件**: `src/electron/libs/runner.ts`

不是全局打开 `outputFormat`，而是当系统提示中包含"请列出执行计划"时按需启用。更务实的方案是先做一个实验性开关：

```typescript
// 在 agentContext 或 runtime overrides 中新增
outputFormat?: {
  type: "json_schema";
  schema: object;
};
```

**注意**: `outputFormat` 会限制 AI 的输出自由度，不适合所有对话场景。初期只在用户主动要求"列计划"或 system prompt 明确要求结构化输出时启用。

**验收**:
- 在提示中包含"请用 JSON 列出执行步骤"时，AI 返回结构化 JSON。
- 普通聊天不受影响。

#### Task 3.2 — `buildActivityRailModel` 优先使用结构化计划

**文件**: `src/shared/activity-rail-model.ts`

```typescript
function parseStructuredPlan(text: string): ParsedPlan | null {
  // 尝试 JSON.parse(text)
  // 如果失败，回退到 parseExplicitPlan(text)
}
```

`parseExplicitPlan` 保留作为 fallback，但优先尝试从 JSON 中读取。

**验收**:
- 单元测试覆盖 JSON 计划解析和 fallback 路径。
- `npm run test:activity-rail-model` 通过。

---

### Phase 4: 体验打磨（预计 2-3 天）

目标：右侧栏在"中间过程可见"之后，进一步打磨信息密度和交互。

#### Task 4.1 — 时间线增加"执行阶段"分组头

**文件**: `src/ui/components/ActivityRail.tsx`

在 `inspect → implement → verify → deliver` 阶段之间插入分组头，让用户一眼看到任务到了哪个阶段。

#### Task 4.2 — 上下文分布与节点详情联动跳转

**文件**: `src/ui/components/ActivityRail.tsx`

当前上下文分布弹窗中有"跳到节点"按钮，但跳转后弹窗关闭。改为：
- 跳转后弹窗保持打开，被跳转节点高亮。
- 上下文分布中点击某个 bucket 时，时间线自动滚动到关联节点。

#### Task 4.3 — 节点详情中工具输出支持折叠与截断

**文件**: `src/ui/components/ActivityRail.tsx`（`DetailSectionCard`）

- 工具输出超过 500 字符时默认折叠，显示"展开完整输出"。
- Bash 输出保留前 20 行，其余可折叠。
- 减少"原始输入/原始返回"展开后的白色盲区风险（已在上一轮修复 `bg-ink-950` → `bg-ink-900`）。

---

## 改造文件清单

| Phase | 文件 | 改造类型 |
|-------|------|---------|
| 1.1 | `src/electron/libs/runner.ts` | 加选项 |
| 1.2 | `src/electron/libs/runner.ts` | 加选项 |
| 1.3 | `src/electron/libs/runner.ts` | API 迁移 |
| 1.4 | `patches/@anthropic-ai%2Fclaude-agent-sdk@0.2.6.patch` | 删除 |
| 2.1 | `src/shared/activity-rail-model.ts` | 新增消息处理 |
| 2.2 | `src/ui/components/ActivityRail.tsx` | 新增样式 |
| 2.3 | `src/shared/activity-rail-model.ts` + `ActivityRail.tsx` | 扩展类型 + UI |
| 3.1 | `src/electron/libs/runner.ts` | 条件启用 |
| 3.2 | `src/shared/activity-rail-model.ts` | 优先解析 |
| 4.1 | `src/ui/components/ActivityRail.tsx` | 分组头 |
| 4.2 | `src/ui/components/ActivityRail.tsx` | 联动跳转 |
| 4.3 | `src/ui/components/ActivityRail.tsx` | 折叠截断 |

## 交付顺序

```
Phase 1 (1-2 天)
  ├── Task 1.1 agentProgressSummaries
  ├── Task 1.2 forwardSubagentText
  ├── Task 1.3 updatedToolOutput 迁移
  └── Task 1.4 清理旧 patch
        ↓
Phase 2 (2-3 天)
  ├── Task 2.1 进度节点类型
  ├── Task 2.2 进行中样式
  └── Task 2.3 子 Agent 分组
        ↓
Phase 3 (1-2 天)
  ├── Task 3.1 outputFormat 条件启用
  └── Task 3.2 优先解析结构化计划
        ↓
Phase 4 (2-3 天)
  ├── Task 4.1 执行阶段分组头
  ├── Task 4.2 上下文联动跳转
  └── Task 4.3 工具输出折叠截断
```

总计 **6-10 个工作日**。

## 验收总则

1. 每个 Phase 完成后，在 Electron 真窗口中走一遍完整对话流程。
2. `npm run build` + `npm run transpile:electron` 通过。
3. `npm run test:activity-rail-model` 通过。
4. 涉及 UI 改动的 Phase，必须用真窗口确认视觉结果，不只看构建结果。
5. Phase 1 完成后，确认子 Agent 消息流正确到达前端再进入 Phase 2。

## 暂不纳入本次迭代

以下 SDK 能力有价值但改动较大或依赖外部条件，留给后续迭代：

| 能力 | 原因 |
|------|------|
| `sessionStore` 双写 | 需要改造 SQLite schema 和 IPC 层，改动面大 |
| `managedSettings` | 等企业部署需求出现 |
| `plugins` | 暂无扩展需求 |
| `connectRemoteControl` | SaaS/Web 端能力，桌面端不需要 |
| `sandbox` | 单用户场景非优先项 |

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| `agentProgressSummaries` 消息频率过高导致右侧栏刷新抖动 | 用 `useDeferredValue` 包裹进度节点列表 |
| `outputFormat` 限制 AI 输出自由度导致回复质量下降 | 不做全局启用，只按需/按场景条件启用 |
| Phase 2 进度节点类型与 SDK 实际消息格式不匹配 | Task 2.1 先 `console.log` 实际消息再编码 |
| `updatedToolOutput` 迁移后行为差异 | 在 `0.2.121` changelog 中确认 API 兼容性，迁移后做 smoke 测试 |
