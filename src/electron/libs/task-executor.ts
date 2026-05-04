import { TaskRepository } from "./task-repository.js";
import { getTaskProvider, ensureProvider } from "./task-provider.js";
import type {
  StoredTask,
  TaskExecution,
  TaskExecutionLog,
  TaskProviderId,
  TaskStats,
  TaskFilter,
  ExternalTaskStatus,
} from "./task-types.js";
import { runClaude } from "./runner.js";
import { getCurrentApiConfig } from "./claude-settings.js";

export type TaskExecutorEvents = {
  onTaskUpdated?: (task: StoredTask) => void;
  onExecutionStarted?: (execution: TaskExecution) => void;
  onExecutionCompleted?: (execution: TaskExecution) => void;
  onExecutionLog?: (log: TaskExecutionLog) => void;
  onStatsChanged?: (stats: TaskStats) => void;
  onSyncCompleted?: (provider: TaskProviderId, count: number) => void;
  onError?: (message: string) => void;
};

export class TaskExecutor {
  private repo: TaskRepository;
  private events: TaskExecutorEvents;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private executingTasks = new Set<string>();
  private reapCounter = 0;

  constructor(repo: TaskRepository, events: TaskExecutorEvents = {}) {
    this.repo = repo;
    this.events = events;
  }

  // ---- Sync ----

  async syncProvider(providerId: TaskProviderId, options: { silentErrors?: boolean } = {}): Promise<number> {
    const provider = getTaskProvider(providerId);
    if (!provider) {
      if (!options.silentErrors) {
        this.events.onError?.(`Provider ${providerId} not registered`);
      }
      return 0;
    }

    try {
      const tasks = await provider.fetchTasks();
      for (const task of tasks) {
        const stored = this.repo.upsertTask(task);
        this.detectStatusTransition(stored);
      }
      for (const staleTask of this.repo.markProviderTasksMissing(providerId, tasks.map((task) => task.externalId))) {
        this.events.onTaskUpdated?.(staleTask);
      }
      this.events.onSyncCompleted?.(providerId, tasks.length);
      return tasks.length;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!options.silentErrors) {
        this.events.onError?.(`Sync ${providerId} failed: ${message}`);
      }
      return 0;
    }
  }

  async syncAll(options: { silentErrors?: boolean } = {}): Promise<void> {
    const { listTaskProviders } = await import("./task-provider.js");
    for (const provider of listTaskProviders()) {
      await this.syncProvider(provider.id, options);
    }
  }

  // ---- Polling ----

  startPolling(intervalMs = 30000): void {
    if (this.pollTimer) return;

    // Initial sync
    void this.syncAll({ silentErrors: true });

    this.pollTimer = setInterval(() => {
      if (this.polling) return;
      void this.syncAll({ silentErrors: true });

      // Reap completed tasks older than 30 days every ~24 cycles (≈12h at 30s interval)
      this.reapCounter++;
      if (this.reapCounter >= 24) {
        this.reapCounter = 0;
        try {
          const reaped = this.repo.reapCompletedTasks(30);
          if (reaped > 0) {
            this.emitLog("__system__", "__system__", "info", `清理了 ${reaped} 个已完成的旧任务`);
          }
        } catch {
          // reap is best-effort
        }
      }
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  // ---- Status Transition Detection ----

  private detectStatusTransition(task: StoredTask): void {
    // When a human marks a task as "done" in the external system,
    // auto-pick it up for AI execution
    if (task.status === "done" && task.localStatus === "pending") {
      // Find tasks that were just marked "done" (external status changed to done)
      // We check the previous execution to avoid re-running already-executed tasks
      const latestExecution = this.repo.getLatestExecution(task.id);
      if (!latestExecution || latestExecution.status === "failed") {
        void this.executeTask(task);
        return;
      }
    }

    this.events.onTaskUpdated?.(task);
  }

  // ---- Execution ----

  async executeTask(task: StoredTask): Promise<TaskExecution | null> {
    if (task.localStatus === "executing") {
      this.events.onError?.(`Task ${task.title} is already executing`);
      return null;
    }

    if (this.executingTasks.has(task.id)) {
      this.events.onError?.(`Task ${task.title} is already queued for execution`);
      return null;
    }

    this.executingTasks.add(task.id);

    const config = getCurrentApiConfig();
    if (!config) {
      this.events.onError?.("No API config available for task execution");
      return null;
    }

    const prompt = this.buildExecutionPrompt(task);
    const session = {
      id: `task-${crypto.randomUUID()}`,
      title: `[任务] ${task.title}`,
      status: "idle" as const,
      cwd: process.cwd(),
      runSurface: "development" as const,
      pendingPermissions: new Map(),
    };

    const execution = this.repo.createExecution({
      taskId: task.id,
      sessionId: session.id,
      status: "running",
      startedAt: Date.now(),
    });

    this.repo.setExecuting(task.id, session.id);
    this.events.onExecutionStarted?.(execution);
    this.emitLog(execution.id, task.id, "info", `开始执行任务: ${task.title}`);

    // Track completion via a promise that resolves when session.status event arrives
    let resolveCompletion: (result: { success: boolean; error?: string }) => void;
    const completionPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
      resolveCompletion = resolve;
    });

    try {
      const handle = await runClaude({
        prompt,
        session,
        onEvent: (event) => {
          if (event.type === "session.status") {
            const statusPayload = event.payload as { sessionId: string; status: string; error?: string };
            if (statusPayload.sessionId === session.id) {
              if (statusPayload.status === "completed") {
                resolveCompletion({ success: true });
              } else if (statusPayload.status === "error") {
                resolveCompletion({ success: false, error: statusPayload.error ?? "Unknown error" });
              }
            }
          }
          if (event.type === "stream.message") {
            const text = this.extractMessageText(event.payload.message);
            if (text) {
              this.emitLog(execution.id, task.id, "info", text.slice(0, 500));
            }
          }
          if (event.type === "runner.error") {
            this.emitLog(execution.id, task.id, "error", event.payload.message);
          }
        },
        onSessionUpdate: (_updates) => {
          // no-op for task sessions
        },
      });

      // Wait for completion with 30-minute timeout
      const result = await Promise.race([
        completionPromise,
        new Promise<{ success: boolean; error?: string }>((resolve) =>
          setTimeout(() => resolve({ success: false, error: "Task execution timed out after 30 minutes" }), 1800000)
        ),
      ]);

      if (!result.success) {
        handle.abort();
      }

      this.repo.completeExecution(execution.id, result.success ? "Task execution completed" : undefined, result.error);
      this.repo.updateLocalStatus(task.id, result.success ? "completed" : "failed");

      const completedExecution = {
        ...execution,
        status: result.success ? ("completed" as const) : ("failed" as const),
        completedAt: Date.now(),
        result: result.success ? "Task execution completed" : undefined,
        error: result.error,
      };
      this.events.onExecutionCompleted?.(completedExecution);
      this.emitLog(execution.id, task.id, result.success ? "info" : "error",
        result.success ? "任务执行完成" : `任务执行失败: ${result.error}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.repo.completeExecution(execution.id, undefined, message);
      this.repo.updateLocalStatus(task.id, "failed");

      const completedExecution = {
        ...execution,
        status: "failed" as const,
        completedAt: Date.now(),
        error: message,
      };
      this.events.onExecutionCompleted?.(completedExecution);
      this.emitLog(execution.id, task.id, "error", `任务执行失败: ${message}`);
    } finally {
      this.executingTasks.delete(task.id);
    }

    return this.repo.getLatestExecution(task.id) ?? null;
  }

  private buildExecutionPrompt(task: StoredTask): string {
    const providerName = task.provider === "lark" ? "飞书" : task.provider === "tb" ? "TB" : task.provider;
    const parts = [
      `执行${providerName}任务: ${task.title}`,
      "",
      `任务ID: ${task.externalId}`,
      `优先级: ${task.priority}`,
    ];

    if (task.description) {
      parts.push(`描述: ${task.description}`);
    }
    if (task.assignee) {
      parts.push(`负责人: ${task.assignee}`);
    }
    if (task.dueDate) {
      parts.push(`截止日期: ${new Date(task.dueDate).toISOString()}`);
    }

    parts.push("", "请根据以上任务信息，自行分析和执行所需的操作。");
    return parts.join("\n");
  }

  private emitLog(
    executionId: string,
    taskId: string,
    level: TaskExecutionLog["level"],
    message: string
  ): void {
    const log = this.repo.appendLog({
      executionId,
      taskId,
      level,
      message,
      timestamp: Date.now(),
    });
    this.events.onExecutionLog?.(log);
  }

  private extractMessageText(message: unknown): string | null {
    if (!message || typeof message !== "object") return null;
    const msg = message as { type?: string; message?: { content?: Array<{ type?: string; text?: string }> } };
    if (msg.type !== "assistant") return null;
    const content = msg.message?.content;
    if (!Array.isArray(content)) return null;
    return content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text!)
      .join("\n")
      .trim() || null;
  }

  // ---- Queries ----

  listTasks(filter?: TaskFilter): StoredTask[] {
    return this.repo.listTasks(filter);
  }

  getTask(taskId: string): StoredTask | undefined {
    return this.repo.getTask(taskId);
  }

  getStats(): TaskStats {
    return this.repo.getStats();
  }

  getExecutions(taskId: string): TaskExecution[] {
    return this.repo.getExecutions(taskId);
  }

  getExecutionLogs(taskId: string): TaskExecutionLog[] {
    return this.repo.getExecutionLogs(taskId);
  }

  async markTaskStatus(taskId: string, status: ExternalTaskStatus): Promise<StoredTask | undefined> {
    const task = this.repo.getTask(taskId);
    if (!task) return undefined;

    const provider = ensureProvider(task.provider);
    await provider.updateTaskStatus(task.externalId, status);

    // Re-sync this specific task
    const updated = await provider.getTask(task.externalId);
    if (updated) {
      const stored = this.repo.upsertTask(updated);
      this.events.onTaskUpdated?.(stored);
      return stored;
    }

    return task;
  }

  // ---- Manual trigger ----

  async triggerExecution(taskId: string): Promise<TaskExecution | null> {
    const task = this.repo.getTask(taskId);
    if (!task) {
      this.events.onError?.(`Task ${taskId} not found`);
      return null;
    }
    return this.executeTask(task);
  }
}
