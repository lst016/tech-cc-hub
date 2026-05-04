// Task system types
// Source: Symphony-inspired task management model, adapted for tech-cc-hub

export type TaskProviderId = "lark" | "tb";

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
  maxRetryBackoffMs: number;
  stallTimeoutMs: number;
  defaultDriverId: TaskAgentDriverId;
  defaultReasoningMode: TaskReasoningMode;
  maxCostUsd?: number;
  writeBackEnabled: boolean;
  promptTemplate?: string;
  tbCliCommand?: string;
  tbFetchArgsTemplate?: string;
  tbUpdateArgsTemplate?: string;
  tbCommentArgsTemplate?: string;
};

export type TaskExecutionBundle = {
  taskId: string;
  executions: TaskExecution[];
  logs: TaskExecutionLog[];
  subtasks: TaskSubtask[];
  artifacts: TaskArtifact[];
};

// IPC event types
export type TaskServerEvent =
  | { type: "task.list"; payload: { tasks: StoredTask[] } }
  | { type: "task.updated"; payload: { task: StoredTask } }
  | { type: "task.deleted"; payload: { taskId: string } }
  | { type: "task.execution.started"; payload: { execution: TaskExecution } }
  | { type: "task.execution.completed"; payload: { execution: TaskExecution } }
  | { type: "task.execution.log"; payload: { log: TaskExecutionLog } }
  | { type: "task.execution.bundle"; payload: TaskExecutionBundle }
  | { type: "task.settings"; payload: { settings: TaskWorkflowSettings } }
  | { type: "task.providers"; payload: { providers: TaskProviderState[] } }
  | { type: "task.stats"; payload: { stats: TaskStats } }
  | { type: "task.sync.completed"; payload: { provider: TaskProviderId; count: number } }
  | { type: "task.error"; payload: { message: string } };

export type TaskClientEvent =
  | { type: "task.list"; payload?: { filter?: TaskFilter } }
  | { type: "task.sync"; payload: { provider: TaskProviderId } }
  | { type: "task.execute"; payload: { taskId: string; options?: TaskExecutionOptions } }
  | { type: "task.control"; payload: { taskId: string; action: TaskExecutionControlAction } }
  | { type: "task.delete"; payload: { taskId: string } }
  | { type: "task.markStatus"; payload: { taskId: string; status: ExternalTaskStatus } }
  | { type: "task.settings.get"; payload?: {} }
  | { type: "task.settings.update"; payload: { settings: Partial<TaskWorkflowSettings> } }
  | { type: "task.providers"; payload?: {} }
  | { type: "task.stats"; payload?: {} }
  | { type: "task.execution.logs"; payload: { taskId: string } };

export interface TaskProvider {
  readonly id: TaskProviderId;
  readonly name: string;
  isEnabled?(): boolean;
  getCapabilities?(): TaskProviderCapability[];
  fetchTasks(): Promise<ExternalTask[]>;
  getTask(externalId: string): Promise<ExternalTask | null>;
  updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void>;
  appendTaskComment?(externalId: string, text: string): Promise<void>;
  deleteTask?(externalId: string): Promise<void>;
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
}
