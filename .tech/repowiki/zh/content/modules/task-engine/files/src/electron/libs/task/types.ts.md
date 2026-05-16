# src/electron/libs/task/types.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：241

## 文件职责

源码文件

## 关键符号

- `TaskProviderId@3 - `
- `ExternalTaskStatus@5 - `
- `LocalTaskStatus@11 - `
- `TaskPriority@20 - `
- `TaskClaimState@22 - `
- `TaskAgentDriverId@30 - `
- `TaskReasoningMode@32 - `
- `TaskExecutionControlAction@34 - `
- `TaskExecutionOptions@36 - `
- `ExternalTask@45 - `
- `StoredTask@60 - `
- `TaskExecution@81 - `
- `TaskExecutionLog@102 - `
- `TaskFilter@111 - `
- `TaskStats@118 - `
- `TaskSubtaskStatus@132 - `

## 对外暴露

- `TaskProviderId`
- `ExternalTaskStatus`
- `LocalTaskStatus`
- `TaskPriority`
- `TaskClaimState`
- `TaskAgentDriverId`
- `TaskReasoningMode`
- `TaskExecutionControlAction`
- `TaskExecutionOptions`
- `ExternalTask`
- `StoredTask`
- `TaskExecution`
- `TaskExecutionLog`
- `TaskFilter`
- `TaskStats`
- `TaskSubtaskStatus`
- `TaskSubtask`
- `TaskArtifactKind`
- `TaskArtifact`
- `TaskProviderCapability`
- `TaskProviderState`
- `TaskWorkflowSettings`
- `TaskExecutionBundle`
- `TaskServerEvent`
- `TaskClientEvent`
- `TaskProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Task system types
// Source: Symphony-inspired task management model, adapted for tech-cc-hub

export type TaskProviderId = "lark" | "tb" | "feishu-project";

export type ExternalTaskStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "cancelled";

export type LocalTaskStatus =
  | ExternalTaskStatus
  | "queued"       // queued by scheduler, waiting for available concurrency
  | "executing"    // AI has picked up and is running
  | "retrying"     // execution failed but is queued for retry
  | "paused"       // paused by user, will not auto-dispatch
  | "completed"    // AI execution completed successfully
  | "failed";      // AI execution failed

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export type TaskClaimState =
  | "unclaimed"
  | "claimed"
  | "queued"
  | "running"
  | "retrying"
  | "released";

export type TaskAgentDriverId = "claude" | "codex-app-server";

export type TaskReasoningMode = "disabled" | "low" | "medium" | "high" | "xhigh";

export type TaskExecutionControlAction = "pause" | "resume" | "cancel" | "cancel-retry";

export type TaskExecutionOptions = {
  model?: string;
  reasoningMode?: TaskReasoningMode;
  workspacePath?: string;
  driverId?: TaskAgentDriverId;
  maxCostUsd?: number;
  promptTemplate?: string;
};

export type ExternalTask = {
  id: string;
  externalId: string;
  provider: TaskProviderId;
  title: string;
  description?: string;
  status: ExternalTaskStatus;
  assignee?: string;
  priority: TaskPriority;
  dueDate?: number;
  sourceData: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
};

export type StoredTask = ExternalTask & {
  localStatus: LocalTaskStatus;
  claimState: TaskClaimState;
  retryAttempt: number;
  retryDueAt?: number;
  lastError?: string;
  workspacePath?: string;
  driverId?: TaskAgentDriverId;
  model?: string;
  reasoningMode?: TaskReasoningMode;
  maxCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  cancelRequestedAt?: number;
  pausedAt?: number;
  lastSyncedAt: number;
  lastExecutedAt?: number;
  executionSessionId?: string;
};

export type TaskExecution = {
  id: string;
  taskId: string;
  sessionId: string;
  status: "running" | "completed" | "failed" | "cancelled";
  attempt?: number;
  driverId?: TaskAgentDriverId;
  model?: string;
  reasoningMode?: TaskReasoningMode;
  maxCostUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  startedAt: number;
  completedAt?: number;
  lastEventAt?: number;
  terminalReason?: string;
  result?: string;
  error?: string;
};

export type TaskExecutionLog = {
  id: string;
  executionId: string;
  taskId: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: number;
};

export type TaskFilter = {
  provider?: TaskProviderId;
  status?: LocalTaskStatus;
  priority?: TaskPriority;
  query?: string;
};

export type TaskStats = {
  total: number;
  pending: number;
  queued: number;
  executing: number;
  retrying: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
  estimatedCostUsd: number;
  byProvider: Record<TaskProviderId, number>;
};

export type TaskSubtaskStatus = "pending" | "in_progress" | "done" | "blocked";

export type TaskSubtask = {
  id: string;
  taskId: string;
  executionId?: string;
  title: string;
  detail?: string;
  status: TaskSubtaskStatus;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type TaskArtifactKind = "file" | "directory" | "summary";

export type TaskArtifact = {
  id: string;
  taskId: string;
  executionId?: string;
  path: string;
  kind: TaskArtifactKind;
  summary?: string;
  createdAt: number;
  updatedAt: number;
};

export type TaskProviderCapability =
  | "fetch"
  | "status-writeback"
  | "comment-writeback"
  | "delete"
  | "cli-configurable";

export type TaskProviderState = {
  id: TaskProviderId;
  name: string;
  enabled: boolean;
  valid: boolean;
  error?: string;
  capabilities: TaskProviderCapability[];
};

export type TaskWorkflowSettings = {
  pollingIntervalMs: number;
  maxConcurrentAgents: number;
  maxAutoRetries: number;
  maxRetryBackoff
... (truncated)
```
