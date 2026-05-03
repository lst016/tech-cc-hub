// Source: CV from AionUi CronService.ts (832 lines)
// Adapted for tech-cc-hub: removed i18n, powerSaveBlocker, system-resume, orphan cleanup,
// conversationRepo dependency, SkillSuggestWatcher. Hardcoded Chinese messages.

import { Cron } from "croner";
import type { CronJob, CronSchedule, CreateCronJobParams } from "./cron-types.js";
import type { ICronRepository } from "./cron-repository.js";
import type { ICronEventEmitter } from "./cron-event-emitter.js";
import type { ICronJobExecutor } from "./cron-executor.js";

export class CronService {
  private timers: Map<string, Cron | NodeJS.Timeout> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private initialized = false;

  constructor(
    private readonly repo: ICronRepository,
    private readonly emitter: ICronEventEmitter,
    private readonly executor: ICronJobExecutor,
  ) {}

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      const jobs = await this.repo.listEnabled();
      for (const job of jobs) {
        await this.startTimer(job);
      }
      this.initialized = true;
    } catch (error) {
      console.error("[CronService] 初始化失败:", error);
      throw error;
    }
  }

  async addJob(params: CreateCronJobParams): Promise<CronJob> {
    const now = Date.now();
    const jobId = `cron_${now}_${Math.random().toString(36).slice(2, 8)}`;

    const job: CronJob = {
      id: jobId,
      name: params.name,
      description: params.description?.trim() || undefined,
      enabled: true,
      schedule: params.schedule,
      target: {
        payload: { kind: "message", text: params.prompt ?? params.message ?? "" },
        executionMode: params.executionMode ?? "existing",
      },
      metadata: {
        conversationId: params.conversationId,
        conversationTitle: params.conversationTitle,
        agentType: params.agentType,
        createdBy: params.createdBy,
        createdAt: now,
        updatedAt: now,
        agentConfig: params.agentConfig,
      },
      state: {
        runCount: 0,
        retryCount: 0,
        maxRetries: 3,
      },
    };

    this.updateNextRunTime(job);
    await this.repo.insert(job);
    await this.startTimer(job);
    this.emitter.emitJobCreated(job);
    return job;
  }

  async updateJob(jobId: string, updates: Partial<CronJob>): Promise<CronJob> {
    const existing = await this.repo.getById(jobId);
    if (!existing) throw new Error(`任务不存在: ${jobId}`);

    this.stopTimer(jobId);
    await this.repo.update(jobId, updates);

    const updated = (await this.repo.getById(jobId))!;

    if (updates.schedule || (updates.enabled === true && !existing.enabled)) {
      this.updateNextRunTime(updated);
      await this.repo.update(jobId, { state: updated.state });
    }

    if (updated.enabled) await this.startTimer(updated);
    this.emitter.emitJobUpdated(updated);
    return updated;
  }

  async removeJob(jobId: string): Promise<void> {
    this.stopTimer(jobId);
    await this.repo.delete(jobId);
    this.emitter.emitJobRemoved(jobId);
  }

  async triggerJob(jobId: string): Promise<void> {
    const job = await this.repo.getById(jobId);
    if (!job) throw new Error(`任务不存在: ${jobId}`);
    await this.executeJob(job);
  }

  async runNow(jobId: string): Promise<string> {
    const job = await this.repo.getById(jobId);
    if (!job) throw new Error(`任务不存在: ${jobId}`);
    const conversationId = await this.executor.prepareConversation(job);
    void this.executeJob(job, conversationId);
    return conversationId;
  }

  async listJobs(): Promise<CronJob[]> {
    return this.repo.listAll();
  }

  async listJobsByConversation(conversationId: string): Promise<CronJob[]> {
    return this.repo.listByConversation(conversationId);
  }

  async getJob(jobId: string): Promise<CronJob | null> {
    return this.repo.getById(jobId);
  }

  // ── Timer management ──

  private async startTimer(job: CronJob): Promise<void> {
    this.stopTimer(job.id);

    const { schedule } = job;
    switch (schedule.kind) {
      case "cron": {
        if (!schedule.expr) {
          job.state.nextRunAtMs = undefined;
          break;
        }
        try {
          const timer = new Cron(schedule.expr, { timezone: schedule.tz, paused: false }, () => {
            void this.executeJob(job);
          });
          this.timers.set(job.id, timer);
          const nextRun = timer.nextRun();
          job.state.nextRunAtMs = nextRun ? nextRun.getTime() : undefined;
        } catch (error) {
          console.error(`[CronService] 无效的 cron 表达式 "${schedule.expr}" for "${job.name}":`, error);
          job.state.nextRunAtMs = undefined;
          job.state.lastStatus = "error";
          job.state.lastError = `无效的 cron 表达式: ${schedule.expr}`;
          job.enabled = false;
          await this.repo.update(job.id, { enabled: false, state: job.state });
          this.emitter.emitJobUpdated(job);
          break;
        }
        await this.repo.update(job.id, { state: job.state });
        this.emitter.emitJobUpdated(job);
        break;
      }

      case "every": {
        const timer = setInterval(() => { void this.executeJob(job); }, schedule.everyMs);
        this.timers.set(job.id, timer);
        job.state.nextRunAtMs = Date.now() + schedule.everyMs;
        await this.repo.update(job.id, { state: job.state });
        this.emitter.emitJobUpdated(job);
        break;
      }

      case "at": {
        const delay = schedule.atMs - Date.now();
        if (delay > 0) {
          const timer = setTimeout(() => {
            void this.executeJob(job);
            void this.updateJob(job.id, { enabled: false });
          }, delay);
          this.timers.set(job.id, timer);
          job.state.nextRunAtMs = schedule.atMs;
          await this.repo.update(job.id, { state: job.state });
          this.emitter.emitJobUpdated(job);
        } else {
          job.state.nextRunAtMs = undefined;
          job.state.lastStatus = "skipped";
          job.state.lastError = "计划时间已过";
          job.enabled = false;
          await this.repo.update(job.id, { enabled: false, state: job.state });
          this.emitter.emitJobUpdated(job);
        }
        break;
      }
    }
  }

  private stopTimer(jobId: string): void {
    const timer = this.timers.get(jobId);
    if (timer) {
      if (timer instanceof Cron) {
        timer.stop();
      } else {
        clearTimeout(timer);
        clearInterval(timer);
      }
      this.timers.delete(jobId);
    }

    const retryTimer = this.retryTimers.get(jobId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(jobId);
    }
    this.retryCounts.delete(jobId);
  }

  // ── Execution ──

  private async executeJob(job: CronJob, preparedConversationId?: string): Promise<void> {
    const conversationId = preparedConversationId ?? job.metadata.conversationId;

    const isBusy = this.executor.isConversationBusy(conversationId);
    if (isBusy) {
      const currentRetry = (this.retryCounts.get(job.id) ?? 0) + 1;
      this.retryCounts.set(job.id, currentRetry);

      if (currentRetry > (job.state.maxRetries || 3)) {
        this.retryCounts.delete(job.id);
        this.updateNextRunTime(job);
        await this.repo.update(job.id, {
          state: { ...job.state, lastStatus: "skipped", lastError: `会话正忙,已重试 ${job.state.maxRetries} 次` },
        });
        const skippedJob = await this.repo.getById(job.id);
        if (skippedJob) this.emitter.emitJobUpdated(skippedJob);
        return;
      }

      const retryTimer = setTimeout(() => {
        this.retryTimers.delete(job.id);
        void this.executeJob(job);
      }, 30000);
      this.retryTimers.set(job.id, retryTimer);
      return;
    }

    const lastRunAtMs = Date.now();
    const currentRunCount = (job.state.runCount ?? 0) + 1;
    let lastStatus: CronJob["state"]["lastStatus"];
    let lastError: string | undefined;

    try {
      await this.executor.executeJob(job, () => {
        this.registerCompletionNotification(job);
      }, preparedConversationId);

      this.retryCounts.delete(job.id);
      lastStatus = "ok";
      lastError = undefined;
    } catch (error) {
      lastStatus = "error";
      lastError = error instanceof Error ? error.message : String(error);
      console.error(`[CronService] 任务 ${job.id} 失败:`, error);
    }

    this.updateNextRunTime(job);

    await this.repo.update(job.id, {
      state: { ...job.state, lastRunAtMs, runCount: currentRunCount, lastStatus, lastError },
    });
    const updatedJob = await this.repo.getById(job.id);
    if (updatedJob) this.emitter.emitJobUpdated(updatedJob);
    this.emitter.emitJobExecuted(job.id, lastStatus, lastError);
  }

  private registerCompletionNotification(job: CronJob): void {
    const { conversationId } = job.metadata;
    this.executor.onceIdle(conversationId, async () => {
      // Notification placeholder - can be wired to Electron Notification API later
      console.log(`[CronService] 定时任务完成: ${job.name}`);
    });
  }

  // ── Next run time calculation ──

  private updateNextRunTime(job: CronJob): void {
    const { schedule } = job;

    switch (schedule.kind) {
      case "cron": {
        try {
          const cron = new Cron(schedule.expr, { timezone: schedule.tz });
          const next = cron.nextRun();
          job.state.nextRunAtMs = next ? next.getTime() : undefined;
        } catch {
          job.state.nextRunAtMs = undefined;
        }
        break;
      }
      case "every": {
        job.state.nextRunAtMs = Date.now() + schedule.everyMs;
        break;
      }
      case "at": {
        job.state.nextRunAtMs = schedule.atMs > Date.now() ? schedule.atMs : undefined;
        break;
      }
    }
  }

  // ── Cleanup ──

  destroy(): void {
    for (const jobId of this.timers.keys()) {
      this.stopTimer(jobId);
    }
    this.timers.clear();
    this.retryTimers.clear();
    this.initialized = false;
  }
}

export type { CronJob, CronSchedule } from "./cron-types.js";
