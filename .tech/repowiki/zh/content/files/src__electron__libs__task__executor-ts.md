# src/electron/libs/task/executor.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：1015

## 文件职责

源码文件。依赖：fs、path、./repository.js、./provider-registry.js、./types.js

## 关键符号

- `parseSubtasks@923 - `
- `snapshotWorkspace@941 - `
- `collectArtifacts@949 - `
- `walkWorkspace@963 - `
- `shouldSkipPath@995 - `
- `numberValue@1006 - `
- `TaskExecutor@88 - `
- `INTERRUPTED_EXECUTION_ERROR@83 - `
- `DEFAULT_EXECUTION_TIMEOUT_MS@85 - `
- `DEFER_RETRY_MS@86 - `
- `MAX_ARTIFACTS@87 - `
- `loadedWorkflow@111 - `
- `provider@141 - `
- `tasks@152 - `
- `stored@154 - `
- `message@164 - `

## 依赖输入

- `fs`
- `path`
- `./repository.js`
- `./provider-registry.js`
- `./types.js`
- `../runner.js`
- `../claude-settings.js`
- `./workflow.js`
- `./workspace.js`
- `./settings.js`
- `../../types.js`
- `../session-store.js`

## 对外暴露

- `TaskExecutorEvents`
- `TaskExecutorOptions`
- `TaskExecutor`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import { existsSync, readdirSync, statSync, type Stats } from "fs";
import { relative, resolve } from "path";
import { TaskRepository } from "./repository.js";
import { ensureProvider, getTaskProvider, listTaskProviderStates } from "./provider-registry.js";
import type {
  ExternalTaskStatus,
  LocalTaskStatus,
  StoredTask,
  TaskAgentDriverId,
  TaskArtifact,
  TaskExecution,
  TaskExecutionControlAction,
  TaskExecutionLog,
  TaskExecutionOptions,
  TaskFilter,
  TaskProviderId,
  TaskProviderState,
  TaskReasoningMode,
  TaskStats,
  TaskSubtask,
  TaskWorkflowSettings,
} from "./types.js";
import { runClaude, type RunnerHandle } from "../runner.js";
import { getCurrentApiConfig } from "../claude-settings.js";
import { computeRetryDueAt, loadTaskWorkflowConfig, type TaskWorkflowConfig } from "./workflow.js";
import { ensureTaskWorkspace } from "./workspace.js";
import { applyTaskSettingsToWorkflow, loadTaskSettings, saveTaskSettings } from "./settings.js";
import type { ServerEvent } from "../../types.js";
import type { Session, SessionStore } from "../session-store.js";

export type TaskExecutorEvents = {
  onTaskUpdated?: (task: StoredTask) => void;
  onTaskDeleted?: (taskId: string) => void;
  onExecutionStarted?: (execution: TaskExecution) => void;
  onExecutionCompleted?: (execution: TaskExecution) => void;
  onExecutionLog?: (log: TaskExecutionLog) => void;
  onStatsChanged?: (stats: TaskStats) => void;
  onSyncCompleted?: (provider: TaskProviderId, count: number) => void;
  onError?: (message: string) => void;
};

export type TaskExecutorOptions = {
  sessionStore?: SessionStore;
  emitServerEvent?: (event: ServerEvent) => void;
  workflowConfig?: TaskWorkflowConfig;
  userDataPath?: string;
  cwd?: string;
};

type CompletionResult = {
  success: boolean;
  error?: string;
  terminalReason?: string;
  executionStatus?: TaskExecution["status"];
  localStatus?: LocalTaskStatus;
};

type UsageSnapshot = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

type RunningExecution = {
  taskId: string;
  executionId: string;
  sessionId: string;
  attempt: number;
  lastEventAt: number;
  usage: UsageSnapshot;
  assistantText: string[];
  baselineFiles: Map<string, number>;
  workspacePath: string;
  finish: (result: CompletionResult) => void;
  handle?: RunnerHandle;
};

type ExecuteOptions = TaskExecutionOptions & {
  attempt?: number;
  manual?: boolean;
  queued?: boolean;
};

const INTERRUPTED_EXECUTION_ERROR = "应用已重启，上一轮任务执行进程已中断。";
const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFER_RETRY_MS = 5000;
const MAX_ARTIFACTS = 80;

export class TaskExecutor {
  private repo: TaskRepository;
  private events: TaskExecutorEvents;
  private sessionStore?: SessionStore;
  private emitServerEvent?: (event: ServerEvent) => void;
  private workflow: TaskWorkflowConfig;
  private settings: TaskWorkflowSettings;
  private userDataPath?: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private executingTasks = new Set<string>();
  private runningExecutions = new Map<string, RunningExecution>();
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private reapCounter = 0;

  constructor(repo: TaskRepository, events: TaskExecutorEvents = {}, options: TaskExecutorOptions = {}) {
    this.repo = repo;
    this.events = events;
    this.sessionStore = options.sessionStore;
    this.emitServerEvent = options.emitServerEvent;
    this.userDataPath = options.userDataPath;
    this.settings = loadTaskSettings(options.userDataPath);
    const loadedWorkflow = options.workflowConfig ?? loadTaskWorkflowConfig({
      userDataPath: options.userDataPath,
      cwd: options.cwd,
    });
    this.workflow = applyTaskSettingsToWorkflow(loadedWorkflow, this.settings);
  }

  // ---- Settings / providers ----

  getSettings(): TaskWorkflowSettings {
    return this.settings;
  }

  updateSettings(settings: Partial<TaskWorkflowSettings>): TaskWorkflowSettings {
    this.settings = saveTaskSettings(settings, this.userDataPath);
    this.workflow = applyTaskSettingsToWorkflow(this.workflow, this.settings);
    if (this.pollTimer) {
... (truncated)
```
