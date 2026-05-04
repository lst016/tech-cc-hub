import { TaskRepository } from "./repository.js";
import { getTaskProvider, ensureProvider } from "./provider-registry.js";
import type {
  StoredTask,
  TaskExecution,
  TaskExecutionLog,
  TaskProviderId,
  TaskStats,
  TaskFilter,
  ExternalTaskStatus,
} from "./types.js";
import { runClaude, type RunnerHandle } from "../runner.js";
import { getCurrentApiConfig } from "../claude-settings.js";
import { computeRetryDueAt, loadTaskWorkflowConfig, type TaskWorkflowConfig } from "./workflow.js";
import { ensureTaskWorkspace } from "./workspace.js";
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
};

type RunningExecution = {
  taskId: string;
  executionId: string;
  sessionId: string;
  attempt: number;
  lastEventAt: number;
  finish: (result: CompletionResult) => void;
  handle?: RunnerHandle;
};

const INTERRUPTED_EXECUTION_ERROR = "应用已重启，上一轮任务执行进程已中断。";
const DEFAULT_EXECUTION_TIMEOUT_MS = 30 * 60 * 1000;
const DEFER_RETRY_MS = 5000;

export class TaskExecutor {
  private repo: TaskRepository;
  private events: TaskExecutorEvents;
  private sessionStore?: SessionStore;
  private emitServerEvent?: (event: ServerEvent) => void;
  private workflow: TaskWorkflowConfig;
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
    this.workflow = options.workflowConfig ?? loadTaskWorkflowConfig({
      userDataPath: options.userDataPath,
      cwd: options.cwd,
    });
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
      const tasks = this.repo.filterDismissedExternalTasks(await provider.fetchTasks());
      for (const task of tasks) {
        const stored = this.repo.upsertTask(task);
        this.detectStatusTransition(stored);
      }
      for (const staleTask of this.repo.markProviderTasksMissing(providerId, tasks.map((task) => task.externalId))) {
        this.events.onTaskUpdated?.(staleTask);
      }
      this.events.onStatsChanged?.(this.repo.getStats());
      if (!options.silentErrors) {
        this.events.onSyncCompleted?.(providerId, tasks.length);
      }
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
    const { listTaskProviders } = await import("./provider-registry.js");
    for (const provider of listTaskProviders()) {
      await this.syncProvider(provider.id, options);
    }
  }

  // ---- Polling / orchestration ----

  startPolling(intervalMs = this.workflow.polling.intervalMs): void {
    if (this.pollTimer) return;

    this.recoverInterruptedExecutions();
    this.restoreRetryTimers();
    void this.orchestrationTick({ sync: true });

    this.pollTimer = setInterval(() => {
      void this.orchestrationTick({ sync: true });
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();
  }

  private async orchestrationTick(options: { sync: boolean }): Promise<void> {
    if (this.polling) return;
    this.polling = true;
    try {
      this.detectStalledExecutions();
      if (options.sync) {
        await this.syncAll({ silentErrors: true });
      }
      this.dispatchDueRetries();
      this.detectStalledExecutions();
      this.reapCounter++;
      if (this.reapCounter >= 24) {
        this.reapCounter = 0;
        this.reapCompletedTasks();
      }
    } finally {
      this.polling = false;
    }
  }

  private reapCompletedTasks(): void {
    try {
      const reaped = this.repo.reapCompletedTasks(30);
      if (reaped > 0) {
        this.emitLog("__system__", "__system__", "info", `清理了 ${reaped} 个已完成的旧任务`);
      }
    } catch {
      // best-effort cleanup
    }
  }

  private recoverInterruptedExecutions(): void {
    const recoveries = this.repo.recoverInterruptedExecutions(INTERRUPTED_EXECUTION_ERROR);
    this.handleRecoveredExecutions(recoveries);
  }

  private recoverOrphanedExecutions(): void {
    const recoveries = this.repo.recoverInterruptedExecutions(INTERRUPTED_EXECUTION_ERROR, {
      activeTaskIds: this.executingTasks,
    });
    this.handleRecoveredExecutions(recoveries);
  }

  private handleRecoveredExecutions(recoveries: Array<{
    task: StoredTask;
    execution: TaskExecution;
    interruptionCount: number;
  }>): void {
    if (recoveries.length === 0) return;

    for (const recovery of recoveries) {
      this.events.onTaskUpdated?.(recovery.task);
      this.events.onExecutionCompleted?.(recovery.execution);

      const nextAttempt = Math.max((recovery.execution.attempt ?? 0) + 1, recovery.interruptionCount);
      const shouldAutoRetry = nextAttempt <= this.workflow.agent.maxAutoRetries;
      this.emitLog(
        recovery.execution.id,
        recovery.task.id,
        shouldAutoRetry ? "warn" : "error",
        shouldAutoRetry
          ? `检测到上次执行因应用关闭而中断，已进入自动重试 ${nextAttempt}/${this.workflow.agent.maxAutoRetries}`
          : `检测到上次执行因应用关闭而中断，已达到自动重试上限 ${this.workflow.agent.maxAutoRetries} 次，请手动确认后重试`,
      );

      if (shouldAutoRetry) {
        this.scheduleRetry(recovery.task, recovery.execution.id, nextAttempt, INTERRUPTED_EXECUTION_ERROR);
      }
    }

    this.events.onStatsChanged?.(this.repo.getStats());
  }

  private restoreRetryTimers(): void {
    for (const task of this.repo.listTasks({ status: "retrying" })) {
      this.armRetryTimer(task);
    }
  }

  private dispatchDueRetries(): void {
    const available = Math.max(0, this.workflow.agent.maxConcurrentAgents - this.executingTasks.size);
    if (available === 0) return;

    const dueTasks = this.repo.listDueRetryTasks(Date.now(), available);
    for (const task of dueTasks) {
      void this.executeTask(task, { attempt: task.retryAttempt, queued: true });
    }
  }

  private detectStalledExecutions(): void {
    const now = Date.now();
    for (const running of this.runningExecutions.values()) {
      if (now - running.lastEventAt < this.workflow.agent.stallTimeoutMs) continue;

      const message = `任务执行超过 ${Math.round(this.workflow.agent.stallTimeoutMs / 60000)} 分钟没有新事件，已判定为卡住并触发恢复。`;
      this.emitLog(running.executionId, running.taskId, "warn", message);
      running.handle?.abort();
      running.finish({ success: false, error: message, terminalReason: "stalled" });
    }
  }

  // ---- Status transition detection ----

  private detectStatusTransition(task: StoredTask): void {
    if (task.status === "done" && task.localStatus === "pending") {
      const latestExecution = this.repo.getLatestExecution(task.id);
      if (!latestExecution || latestExecution.status === "failed") {
        void this.executeTask(task, { queued: true });
        return;
      }
    }

    this.events.onTaskUpdated?.(task);
  }

  // ---- Execution ----

  async executeTask(task: StoredTask, options: { attempt?: number; manual?: boolean; queued?: boolean } = {}): Promise<TaskExecution | null> {
    if (task.localStatus === "executing") {
      this.events.onError?.(`Task ${task.title} is already executing`);
      return null;
    }

    if (this.executingTasks.has(task.id)) {
      this.events.onError?.(`Task ${task.title} is already queued for execution`);
      return null;
    }

    if (this.executingTasks.size >= this.workflow.agent.maxConcurrentAgents) {
      if (options.manual) {
        this.events.onError?.(`当前已有 ${this.executingTasks.size} 个任务执行中，请稍后再试`);
      } else {
        this.deferTask(task, options.attempt ?? task.retryAttempt);
      }
      return null;
    }

    const config = getCurrentApiConfig();
    if (!config) {
      this.events.onError?.("No API config available for task execution");
      return null;
    }

    this.clearRetryTimer(task.id);
    this.repo.clearRetry(task.id);
    this.executingTasks.add(task.id);

    const attempt = options.attempt ?? task.retryAttempt ?? 0;
    const workspacePath = ensureTaskWorkspace(task, this.workflow);
    const prompt = this.buildExecutionPrompt(task, workspacePath);
    const session = this.createExecutionSession(task, prompt, config.model, workspacePath);
    const startedAt = Date.now();

    const execution = this.repo.createExecution({
      taskId: task.id,
      sessionId: session.id,
      status: "running",
      attempt,
      startedAt,
      lastEventAt: startedAt,
    });

    this.repo.setExecuting(task.id, session.id, { attempt, workspacePath });
    this.publishTaskAndStats(task.id);
    this.events.onExecutionStarted?.(execution);
    this.emitLog(execution.id, task.id, "info", `开始执行任务: ${task.title}`);
    this.emitLog(execution.id, task.id, "info", `工作区: ${workspacePath}`);
    this.emitSessionStatus(session, "running", config.model);
    this.emitServerEvent?.({
      type: "stream.user_prompt",
      payload: { sessionId: session.id, prompt },
    });

    const completion = this.createCompletionTracker(task.id, execution.id, session.id, attempt);
    this.runningExecutions.set(task.id, completion.running);

    try {
      const handle = await runClaude({
        prompt,
        runtime: { model: config.model },
        session,
        onEvent: (event) => {
          this.markExecutionActive(task.id, execution.id);
          this.emitServerEvent?.(event);
          if (event.type === "session.status") {
            const statusPayload = event.payload as { sessionId: string; status: string; error?: string };
            if (statusPayload.sessionId === session.id) {
              if (statusPayload.status === "completed") {
                completion.finish({ success: true, terminalReason: "completed" });
              } else if (statusPayload.status === "error") {
                completion.finish({ success: false, error: statusPayload.error ?? "Unknown error", terminalReason: "runner-error" });
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
          this.sessionStore?.updateSession(session.id, _updates);
        },
      });
      completion.running.handle = handle;

      const result = await Promise.race([
        completion.promise,
        new Promise<CompletionResult>((resolve) =>
          setTimeout(() => resolve({ success: false, error: "Task execution timed out after 30 minutes", terminalReason: "timeout" }), DEFAULT_EXECUTION_TIMEOUT_MS),
        ),
      ]);

      if (!result.success) {
        handle.abort();
      }

      this.finalizeExecution(task, execution, attempt, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.finalizeExecution(task, execution, attempt, {
        success: false,
        error: message,
        terminalReason: "exception",
      });
    } finally {
      this.runningExecutions.delete(task.id);
      this.executingTasks.delete(task.id);
      this.dispatchDueRetries();
    }

    return this.repo.getLatestExecution(task.id) ?? null;
  }

  private createCompletionTracker(taskId: string, executionId: string, sessionId: string, attempt: number): {
    promise: Promise<CompletionResult>;
    finish: (result: CompletionResult) => void;
    running: RunningExecution;
  } {
    let settled = false;
    let finish: (result: CompletionResult) => void = () => undefined;
    const promise = new Promise<CompletionResult>((resolve) => {
      finish = (result) => {
        if (settled) return;
        settled = true;
        resolve(result);
      };
    });

    return {
      promise,
      finish,
      running: {
        taskId,
        executionId,
        sessionId,
        attempt,
        lastEventAt: Date.now(),
        finish,
      },
    };
  }

  private finalizeExecution(task: StoredTask, execution: TaskExecution, attempt: number, result: CompletionResult): void {
    const completedAt = Date.now();
    this.repo.completeExecution(
      execution.id,
      result.success ? "Task execution completed" : undefined,
      result.error,
      result.terminalReason,
    );

    const completedExecution: TaskExecution = {
      ...execution,
      status: result.success ? "completed" : "failed",
      completedAt,
      result: result.success ? "Task execution completed" : undefined,
      error: result.error,
      terminalReason: result.terminalReason,
    };
    this.events.onExecutionCompleted?.(completedExecution);

    if (result.success) {
      this.repo.updateLocalStatus(task.id, "completed");
      this.emitLog(execution.id, task.id, "info", "任务执行完成");
      this.publishTaskAndStats(task.id);
      return;
    }

    const error = result.error ?? "任务执行失败";
    const nextAttempt = attempt + 1;
    if (nextAttempt <= this.workflow.agent.maxAutoRetries) {
      this.emitLog(
        execution.id,
        task.id,
        "warn",
        `任务执行失败，进入自动重试 ${nextAttempt}/${this.workflow.agent.maxAutoRetries}: ${error}`,
      );
      this.scheduleRetry(task, execution.id, nextAttempt, error);
      return;
    }

    const latestTask = this.repo.markFailed(task.id, error);
    if (latestTask) {
      this.events.onTaskUpdated?.(latestTask);
    }
    this.events.onStatsChanged?.(this.repo.getStats());
    this.emitLog(execution.id, task.id, "error", `任务执行失败: ${error}`);
  }

  private scheduleRetry(task: StoredTask, executionId: string, attempt: number, error: string): void {
    const dueAt = computeRetryDueAt(attempt, this.workflow);
    const retryTask = this.repo.scheduleRetry(task.id, attempt, dueAt, error);
    if (!retryTask) return;

    this.events.onTaskUpdated?.(retryTask);
    this.events.onStatsChanged?.(this.repo.getStats());
    this.emitLog(executionId, task.id, "warn", `将在 ${this.formatRelativeDelay(dueAt)} 后自动重试`);
    this.armRetryTimer(retryTask);
  }

  private deferTask(task: StoredTask, attempt: number): void {
    const dueAt = Date.now() + DEFER_RETRY_MS;
    const retryTask = this.repo.scheduleRetry(task.id, attempt, dueAt, "当前并发已满，稍后继续调度。");
    if (!retryTask) return;
    this.events.onTaskUpdated?.(retryTask);
    this.events.onStatsChanged?.(this.repo.getStats());
    this.armRetryTimer(retryTask);
  }

  private armRetryTimer(task: StoredTask): void {
    if (!task.retryDueAt) return;
    this.clearRetryTimer(task.id);
    const delay = Math.max(0, Math.min(task.retryDueAt - Date.now(), 2 ** 31 - 1));
    const timer = setTimeout(() => {
      this.retryTimers.delete(task.id);
      const latest = this.repo.getTask(task.id);
      if (!latest || latest.localStatus !== "retrying") return;
      void this.executeTask(latest, { attempt: latest.retryAttempt, queued: true });
    }, delay);
    this.retryTimers.set(task.id, timer);
  }

  private clearRetryTimer(taskId: string): void {
    const timer = this.retryTimers.get(taskId);
    if (!timer) return;
    clearTimeout(timer);
    this.retryTimers.delete(taskId);
  }

  private markExecutionActive(taskId: string, executionId: string): void {
    const now = Date.now();
    const running = this.runningExecutions.get(taskId);
    if (running) {
      running.lastEventAt = now;
    }
    this.repo.touchExecution(executionId, now);
  }

  private publishTaskAndStats(taskId: string): void {
    const updatedTask = this.repo.getTask(taskId);
    if (updatedTask) {
      this.events.onTaskUpdated?.(updatedTask);
    }
    this.events.onStatsChanged?.(this.repo.getStats());
  }

  private createExecutionSession(task: StoredTask, prompt: string, model: string | undefined, workspacePath: string): Session {
    if (this.sessionStore) {
      const session = this.sessionStore.createSession({
        cwd: workspacePath,
        title: `[任务] ${task.title}`,
        runSurface: "development",
        model,
        allowedTools: "*",
        prompt,
      });
      this.sessionStore.updateSession(session.id, {
        status: "running",
        runSurface: "development",
        model,
        allowedTools: "*",
        lastPrompt: prompt,
      });
      return session;
    }

    return {
      id: `task-${crypto.randomUUID()}`,
      title: `[任务] ${task.title}`,
      status: "idle",
      cwd: workspacePath,
      runSurface: "development",
      model,
      allowedTools: "*",
      lastPrompt: prompt,
      pendingPermissions: new Map(),
    };
  }

  private emitSessionStatus(session: Session, status: "running" | "completed" | "error", model?: string, error?: string): void {
    this.emitServerEvent?.({
      type: "session.status",
      payload: {
        sessionId: session.id,
        status,
        title: session.title,
        cwd: session.cwd,
        model,
        error,
      },
    });
  }

  private buildExecutionPrompt(task: StoredTask, workspacePath: string): string {
    if (this.workflow.promptTemplate) {
      return this.renderPromptTemplate(this.workflow.promptTemplate, task, workspacePath);
    }

    const providerName = task.provider === "lark" ? "飞书" : task.provider === "tb" ? "TB" : task.provider;
    const parts = [
      `执行${providerName}任务: ${task.title}`,
      "",
      `任务ID: ${task.externalId}`,
      `优先级: ${task.priority}`,
      `工作区: ${workspacePath}`,
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

    parts.push(
      "",
      "执行要求:",
      "1. 先拆解子任务和风险点，再动手实现。",
      "2. 在当前任务工作区内完成需要的文件操作，避免污染其他任务。",
      "3. 完成后总结改动、验证方式和剩余风险。",
    );
    return parts.join("\n");
  }

  private renderPromptTemplate(template: string, task: StoredTask, workspacePath: string): string {
    const values: Record<string, string> = {
      "task.id": task.id,
      "task.externalId": task.externalId,
      "task.provider": task.provider,
      "task.title": task.title,
      "task.description": task.description ?? "",
      "task.priority": task.priority,
      "task.assignee": task.assignee ?? "",
      "task.status": task.status,
      "task.localStatus": task.localStatus,
      "task.workspacePath": workspacePath,
      "workspace.path": workspacePath,
    };
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
  }

  private emitLog(
    executionId: string,
    taskId: string,
    level: TaskExecutionLog["level"],
    message: string,
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

  private formatRelativeDelay(dueAt: number): string {
    const seconds = Math.max(1, Math.ceil((dueAt - Date.now()) / 1000));
    if (seconds < 60) return `${seconds} 秒`;
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} 分钟`;
  }

  // ---- Queries ----

  listTasks(filter?: TaskFilter): StoredTask[] {
    this.recoverOrphanedExecutions();
    return this.repo.listTasks(filter);
  }

  getTask(taskId: string): StoredTask | undefined {
    this.recoverOrphanedExecutions();
    return this.repo.getTask(taskId);
  }

  getStats(): TaskStats {
    this.recoverOrphanedExecutions();
    return this.repo.getStats();
  }

  deleteTask(taskId: string): StoredTask | undefined {
    const task = this.repo.getTask(taskId);
    if (!task) {
      this.events.onError?.(`Task ${taskId} not found`);
      return undefined;
    }
    if (task.localStatus === "executing" || this.executingTasks.has(taskId)) {
      this.events.onError?.(`Task ${task.title} is executing and cannot be deleted`);
      return undefined;
    }

    this.clearRetryTimer(taskId);
    const deleted = this.repo.deleteTask(taskId);
    if (deleted) {
      this.events.onTaskDeleted?.(taskId);
      this.events.onStatsChanged?.(this.repo.getStats());
    }
    return deleted;
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
    return this.executeTask(task, { manual: true, attempt: task.localStatus === "retrying" ? task.retryAttempt : 0 });
  }
}
