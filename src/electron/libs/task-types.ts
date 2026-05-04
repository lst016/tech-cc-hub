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
  | "executing"    // AI has picked up and is running
  | "completed"    // AI execution completed successfully
  | "failed";      // AI execution failed

export type TaskPriority = "low" | "medium" | "high" | "urgent";

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
  lastSyncedAt: number;
  lastExecutedAt?: number;
  executionSessionId?: string;
};

export type TaskExecution = {
  id: string;
  taskId: string;
  sessionId: string;
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
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
  executing: number;
  completed: number;
  failed: number;
  byProvider: Record<TaskProviderId, number>;
};

// IPC event types
export type TaskServerEvent =
  | { type: "task.list"; payload: { tasks: StoredTask[] } }
  | { type: "task.updated"; payload: { task: StoredTask } }
  | { type: "task.deleted"; payload: { taskId: string } }
  | { type: "task.execution.started"; payload: { execution: TaskExecution } }
  | { type: "task.execution.completed"; payload: { execution: TaskExecution } }
  | { type: "task.execution.log"; payload: { log: TaskExecutionLog } }
  | { type: "task.stats"; payload: { stats: TaskStats } }
  | { type: "task.sync.completed"; payload: { provider: TaskProviderId; count: number } }
  | { type: "task.error"; payload: { message: string } };

export type TaskClientEvent =
  | { type: "task.list"; payload?: { filter?: TaskFilter } }
  | { type: "task.sync"; payload: { provider: TaskProviderId } }
  | { type: "task.execute"; payload: { taskId: string } }
  | { type: "task.delete"; payload: { taskId: string } }
  | { type: "task.markStatus"; payload: { taskId: string; status: ExternalTaskStatus } }
  | { type: "task.stats"; payload?: {} }
  | { type: "task.execution.logs"; payload: { taskId: string } };

export interface TaskProvider {
  readonly id: TaskProviderId;
  readonly name: string;
  fetchTasks(): Promise<ExternalTask[]>;
  getTask(externalId: string): Promise<ExternalTask | null>;
  updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void>;
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
}
