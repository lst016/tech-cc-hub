---
doc_id: "DOC-SPEC-EVENTS"
title: "应用事件与 Agent 执行事件模型 Spec"
doc_type: "spec"
layer: "L2"
status: "active"
version: "1.0.0"
last_updated: "2026-05-01"
owners:
  - "tech-cc-hub Core"
audience:
  - "frontend"
  - "electron"
source_of_truth: true
supersedes: []
superseded_by: null
tags:
  - "tech-cc-hub"
  - "contracts"
  - "events"
  - "spec"
---

# 应用事件与 Agent 执行事件模型 Spec

## Purpose

定义 tech-cc-hub 中两类事件的完整类型体系：应用层生命周期事件（IPC 层）和 Agent 执行轨迹事件（ActivityRail 层）。

## Scope

- 应用层事件：`ServerEvent` / `ClientEvent` 联合类型（详参 [IPC Spec](../ipc/spec.md)），本文档只列枚举
- Agent 执行轨迹事件：`ActivityNode` 类型体系，包括 `NodeKind`、`NodeStatus`、`ActivityExecutionMetrics`
- 不在本文档范围：SDK 原始 `SDKMessage` 字段定义

## Interfaces / Types

### 应用层会话状态

定义位置：`src/electron/types.ts:68`

```typescript
type SessionStatus = "idle" | "running" | "completed" | "error";
```

状态转换见 [Session Lifecycle Spec](../session-lifecycle/spec.md)。

### 应用层运行时配置

定义位置：`src/electron/types.ts:5-39`

| 类型 | 值域 | 说明 |
|------|------|------|
| `RuntimeReasoningMode` | `"disabled"` `"low"` `"medium"` `"high"` `"xhigh"` | 推理深度 |
| `AgentRunSurface` | `"development"` `"maintenance"` | Agent 运行场景 |
| `RuntimeOverrides.model` | `string` | 模型覆盖 |
| `RuntimeOverrides.permissionMode` | `"default"` `"bypassPermissions"` `"plan"` | 权限模式 |
| `RuntimeOverrides.outputFormat` | `"json"` `"none"` | 结构化输出格式 |

### Agent 执行轨迹节点

定义位置：`src/shared/activity-rail-model.ts`

#### NodeKind 枚举

| 值 | 含义 | 典型来源 |
|----|------|---------|
| `context` | 上下文注入 | prompt ledger |
| `plan` | 计划/思考 | assistant message |
| `assistant_output` | Assistant 文本输出 | assistant message |
| `tool_input` | 工具调用 | tool_use |
| `retrieval` | 检索操作 | 文件读取/grep |
| `file_read` | 文件读取 | read 工具 |
| `file_write` | 文件写入 | write/edit 工具 |
| `terminal` | 终端命令 | bash 工具 |
| `browser` | 浏览器操作 | browser 工具 |
| `memory` | 记忆操作 | memory 工具 |
| `mcp` | MCP 工具调用 | MCP 协议工具 |
| `handoff` | 子 Agent 交接 | task/task_updated |
| `evaluation` | 评估/验证 | 结果检查 |
| `error` | 错误 | 异常/失败 |
| `lifecycle` | 生命周期 | session start/stop |
| `permission` | 权限请求 | permission.request |
| `hook` | Hook 触发 | pre/post hooks |
| `omitted` | 省略/折叠 | 大量重复工具 |
| `agent_progress` | Agent 进度 | agent_progress 事件 |

#### Tool Provenance 枚举

```typescript
type ActivityToolProvenance = "local" | "mcp" | "sub_agent" | "a2a" | "transfer_agent" | "unknown";
```

#### ActivityExecutionMetrics

```typescript
type ActivityExecutionMetrics = {
  inputChars: number;
  contextChars: number;
  outputChars: number;
  durationMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  successCount: number;
  failureCount: number;
  totalCount: number;
  status: ActivityMetricStatus; // "neutral" | "running" | "success" | "failure"
};
```

#### ActivityRail 辅助类型

| 类型 | 值域 | 说明 |
|------|------|------|
| `ActivityRailTone` | `"neutral"` `"info"` `"success"` `"warning"` `"error"` | 节点视觉语调 |
| `ActivityRailLayer` | `"上下文"` `"工具"` `"结果"` `"流程"` | 节点所属层 |
| `ActivityRailFilterKey` | `"all"` `"attention"` `"context"` `"tool"` `"result"` `"flow"` | 过滤器键 |
| `ActivityStageKind` | `"inspect"` `"implement"` `"verify"` `"deliver"` `"plan"` `"other"` | 阶段类型 |
| `ActivityTaskStepStatus` | `"pending"` `"running"` `"completed"` | 任务步骤状态 |
| `ActivityPlanStepStatus` | `"pending"` `"running"` `"completed"` `"drifted"` | 计划步骤状态 |

## Data Flow

```
SDKMessage (raw)
  → activity-rail-model.ts 解析/分类
    → ActivityNode[] (typed & enriched)
      → ActivityRail.tsx 渲染
```

## Error Handling

- `error` NodeKind 用于捕获所有异常情况
- `ActivityMetricStatus.failure` 表示一个阶段的最终状态为失败
- runner.error IPC 事件独立于 ActivityNode 体系，用于通知 UI 层的执行错误

## Compatibility

- 新增 `NodeKind` 值时：需同步更新 `ActivityRail.tsx` 的渲染映射和 `activity-rail-model.ts` 的分类逻辑
- `ActivityExecutionMetrics` 字段只增不减
- `ActivityRailTone` / `ActivityRailLayer` 的映射关系在 `activity-rail-model.ts` 中定义

## Acceptance Criteria

- [ ] 所有 NodeKind 值在 UI 层有对应的视觉呈现
- [ ] ActivityExecutionMetrics 的 status 字段在每次指标合并时正确计算
- [ ] 新增 SDK 事件类型时，同步更新本文档的映射表
