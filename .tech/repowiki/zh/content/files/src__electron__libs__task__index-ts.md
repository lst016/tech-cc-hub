# src/electron/libs/task/index.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：37

## 文件职责

入口文件

## 对外暴露

- `TaskExecutor`
- `TaskRepository`
- `registerTaskProvider`
- `getTaskProvider`
- `listTaskProviders`
- `listTaskProviderStates`
- `ensureProvider`
- `loadTaskWorkflowConfig`
- `createDefaultTaskWorkflowConfig`
- `computeRetryDueAt`
- `loadTaskSettings`
- `saveTaskSettings`
- `createDefaultTaskSettings`
- `applyTaskSettingsToWorkflow`
- `ensureTaskWorkspace`
- `LarkTaskProvider`
- `TbTaskProvider`
- `FeishuProjectTaskProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
export { TaskExecutor } from "./executor.js";
export type { TaskExecutorEvents, TaskExecutorOptions } from "./executor.js";
export { TaskRepository } from "./repository.js";
export { registerTaskProvider, getTaskProvider, listTaskProviders, listTaskProviderStates, ensureProvider } from "./provider-registry.js";
export { loadTaskWorkflowConfig, createDefaultTaskWorkflowConfig, computeRetryDueAt } from "./workflow.js";
export { loadTaskSettings, saveTaskSettings, createDefaultTaskSettings, applyTaskSettingsToWorkflow } from "./settings.js";
export { ensureTaskWorkspace } from "./workspace.js";
export { LarkTaskProvider } from "./providers/lark-provider.js";
export { TbTaskProvider } from "./providers/tb-provider.js";
export { FeishuProjectTaskProvider } from "./providers/feishu-project-provider.js";
export type {
  ExternalTask,
  ExternalTaskStatus,
  LocalTaskStatus,
  StoredTask,
  TaskClaimState,
  TaskClientEvent,
  TaskAgentDriverId,
  TaskArtifact,
  TaskExecution,
  TaskExecutionBundle,
  TaskExecutionControlAction,
  TaskExecutionLog,
  TaskExecutionOptions,
  TaskFilter,
  TaskPriority,
  TaskProvider,
  TaskProviderCapability,
  TaskProviderId,
  TaskProviderState,
  TaskReasoningMode,
  TaskServerEvent,
  TaskStats,
  TaskSubtask,
  TaskWorkflowSettings,
} from "./types.js";

```
