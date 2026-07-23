// Source: CV from AionUi CronService.ts (832 lines)
// Adapted for tech-cc-hub: removed i18n, powerSaveBlocker, system-resume, orphan cleanup,
// conversationRepo dependency, SkillSuggestWatcher. Hardcoded Chinese messages.
// v1 扩展（POLICY.md §2-5）：busy-retry 退避、missed-run 恢复、stuck watchdog、pause/resume、misfirePolicy/maxConcurrent。

import { Cron } from "croner";
import type { CronJob, CreateCronJobParams, MisfirePolicy, CronJobRunTrigger } from "./cron-types.js";
import type { ICronRepository } from "./cron-repository.js";
import type { ICronEventEmitter } from "./cron-event-emitter.js";
import type { ICronJobExecutor } from "./cron-executor.js";
import { getStuckRuns, insertCronRun, updateCronRun } from "./cron-db.js";
import type { CronJobRun } from "./cron-types.js";
import { notifyCronFinished } from "../desktop-notifications.js";

// 退避算法常量（POLICY.md §2）
const BACKOFF_MIN_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const BACKOFF_DEFAULT_MS = 30_000;
// Stuck watchdog 常量（POLICY.md §4）
const STUCK_THRESHOLD_MS = 600_000; // 10 分钟
const WATCHDOG_INTERVAL_MS = 5 * 60 * 1_000; // 5 分钟扫描一次
// Catchup 连续追补上限（POLICY.md §3 catchup 策略）
const CATCHUP_MAX_FIRES = 5;

export class CronService {
  private timers: Map<string, Cron | NodeJS.Timeout> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounts: Map<string, number> = new Map();
  private pausedJobs: Set<string> = new Set();
  // H-3/H-5 in-flight re-entrancy guard：同 job 多次 fire 在内存中只允许一个 Promise 跑
  private inFlightJobs: Map<string, Promise<void>> = new Map();
  private watchdogTimer: NodeJS.Timeout | null = null;
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
      // H-4：pausedJobs 启动时从 DB 状态 reload，否则暂停任务会在重启后自动恢复
      for (const job of jobs) {
        if (job.state.paused) this.pausedJobs.add(job.id);
      }

      // Check the persisted nextRunAt before startTimer refreshes it to a future
      // occurrence. Otherwise a single missed run is silently forgotten on restart.
      await this.triggerCatchup();

      // Catch-up updates run state, so reload before installing the live timers to
      // avoid writing stale runCount/lastRunAt values back to the repository.
      const refreshedJobs = await this.repo.listEnabled();
      for (const job of refreshedJobs) {
        await this.startTimer(job, true);
      }
      this.initialized = true;
      // F-07：stuck job watchdog，5 分钟扫描一次
      this.startWatchdog();
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
    // triggerJob 是 UI 手动触发，triggerSource=manual
    await this.executeJob(job, undefined, "manual");
  }

  async runNow(jobId: string): Promise<string> {
    const job = await this.repo.getById(jobId);
    if (!job) throw new Error(`任务不存在: ${jobId}`);
    const conversationId = await this.executor.prepareConversation(job);
    // H-5：fire-and-forget 加 .catch 让错误不静默丢失
    void this.executeJob(job, conversationId, "manual").catch((err) => {
      console.error(`[CronService] runNow 任务 ${jobId} 失败:`, err);
    });
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

  private async startTimer(job: CronJob, preserveRetry = false): Promise<void> {
    if (preserveRetry) {
      this.stopScheduledTimer(job.id);
    } else {
      this.stopTimer(job.id);
    }

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

  private stopScheduledTimer(jobId: string): void {
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
  }

  private stopTimer(jobId: string): void {
    this.stopScheduledTimer(jobId);

    const retryTimer = this.retryTimers.get(jobId);
    if (retryTimer) {
      clearTimeout(retryTimer);
      this.retryTimers.delete(jobId);
    }
    this.retryCounts.delete(jobId);
  }

  // ── Execution ──

  private async executeJob(
    job: CronJob,
    preparedConversationId?: string,
    triggerSource: CronJobRunTrigger = "schedule",
  ): Promise<void> {
    // H-3/H-5 in-flight re-entrancy guard：crontab tick + runNow + catchup 三路并发
    // 同一 job 只允许一个 Promise 在跑，第二个调用复用第一个的 Promise
    const existing = this.inFlightJobs.get(job.id);
    if (existing) return existing;

    const runPromise = (async () => {
      const latestJob = await this.repo.getById(job.id);
      if (!latestJob || !latestJob.enabled) return;
      await this.executeJobInner(latestJob, preparedConversationId, triggerSource);
    })();
    this.inFlightJobs.set(job.id, runPromise);
    try {
      await runPromise;
    } finally {
      this.inFlightJobs.delete(job.id);
    }
  }

  private async executeJobInner(
    job: CronJob,
    preparedConversationId?: string,
    triggerSource: CronJobRunTrigger = "schedule",
  ): Promise<void> {
    const conversationId = preparedConversationId ?? job.metadata.conversationId;

    // F-12：pause/resume —— timer 保留但 executeJob 早退
    if (this.pausedJobs.has(job.id) || job.state.paused) {
      return;
    }

    const isBusy = this.executor.isConversationBusy(conversationId);
    if (isBusy) {
      const currentRetry = (this.retryCounts.get(job.id) ?? 0) + 1;
      this.retryCounts.set(job.id, currentRetry);

      const maxRetries = job.state.maxRetries || 3;
      if (currentRetry > maxRetries) {
        this.retryCounts.delete(job.id);
        this.updateNextRunTime(job);
        await this.repo.update(job.id, {
          state: { ...job.state, lastStatus: "skipped", lastError: `会话正忙,已重试 ${maxRetries} 次` },
        });
        const skippedJob = await this.repo.getById(job.id);
        if (skippedJob) this.emitter.emitJobUpdated(skippedJob);
        return;
      }

      // F-04：busy-retry 退避算法（POLICY.md §2）
      // 退避间隔 = min(30s, max(1s, (nextRunAtMs - now) / 2))
      const backoffMs = this.computeBackoffMs(job, Date.now());
      await this.repo.update(job.id, {
        state: { ...job.state, lastStatus: "retrying", retryCount: currentRetry },
      });
      const retryTimer = setTimeout(() => {
        this.retryTimers.delete(job.id);
        void this.executeJob(job);
      }, backoffMs);
      this.retryTimers.set(job.id, retryTimer);
      return;
    }

    const lastRunAtMs = Date.now();
    const currentRunCount = (job.state.runCount ?? 0) + 1;
    let lastStatus: CronJob["state"]["lastStatus"];
    let lastError: string | undefined;

    // H-2：先写 running 行，给 F-07 stuck watchdog 喂数据
    const runId = `run_${lastRunAtMs}_${Math.random().toString(36).slice(2, 8)}`;
    const run: CronJobRun = {
      id: runId,
      jobId: job.id,
      startedAt: lastRunAtMs,
      status: "running",
      // triggerSource 由 caller 显式传入（runNow/triggerJob → manual，catchup → catchup，crontab tick → schedule）
      triggerSource,
      conversationId,
    };
    try {
      insertCronRun(run);
    } catch (err) {
      console.error(`[CronService] 写 run/running 失败（继续执行）:`, err);
    }

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
      notifyCronFinished({
        jobId: job.id,
        jobName: job.name,
        conversationTitle: job.metadata.conversationTitle,
        sessionId: preparedConversationId,
        workspacePath: job.metadata.agentConfig?.workspace,
        status: lastStatus,
        error: lastError,
      });
      console.error(`[CronService] 任务 ${job.id} 失败:`, error);
    }

    // H-2：执行结束补全 run 行（status / finishedAt / durationMs）
    try {
      updateCronRun(runId, {
        status: lastStatus === "ok" ? "ok" : "error",
        finishedAt: Date.now(),
        durationMs: Date.now() - lastRunAtMs,
        error: lastError,
        conversationId,
      });
    } catch (err) {
      console.error(`[CronService] 写 run/done 失败:`, err);
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
      notifyCronFinished({
        jobId: job.id,
        jobName: job.name,
        conversationTitle: job.metadata.conversationTitle,
        sessionId: conversationId,
        workspacePath: job.metadata.agentConfig?.workspace,
        status: "ok",
      });
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

  // ── Pause / Resume（F-12 / pause-resume）──

  async pauseJob(jobId: string): Promise<CronJob> {
    const job = await this.repo.getById(jobId);
    if (!job) throw new Error(`任务不存在: ${jobId}`);
    this.pausedJobs.add(jobId);
    job.state.paused = true;
    await this.repo.update(jobId, { state: job.state });
    this.emitter.emitJobUpdated(job);
    return job;
  }

  async resumeJob(jobId: string): Promise<CronJob> {
    const job = await this.repo.getById(jobId);
    if (!job) throw new Error(`任务不存在: ${jobId}`);
    this.pausedJobs.delete(jobId);
    job.state.paused = false;
    this.retryCounts.delete(jobId);
    this.updateNextRunTime(job);
    await this.repo.update(jobId, { state: job.state });
    this.emitter.emitJobUpdated(job);
    return job;
  }

  // ── Missed-run 恢复（F-05 / POLICY.md §3）──

  async triggerCatchup(): Promise<{ checkedJob: number; firedCount: number; missedCount: number }> {
    const jobs = await this.repo.listEnabled();
    const now = Date.now();
    let firedCount = 0;
    let missedCount = 0;

    for (const job of jobs) {
      if (this.pausedJobs.has(job.id) || job.state.paused) continue;
      const policy: MisfirePolicy = job.state.misfirePolicy ?? "fire-once";
      const missed = this.countDueRuns(
        job,
        now,
        policy === "catchup" ? CATCHUP_MAX_FIRES : 1,
      );
      if (missed <= 0) continue;

      if (policy === "skip") {
        await this.markMissed(job, "至少错过 1 次未触发（策略: skip）");
        missedCount += 1;
        continue;
      }

      const fireCount = policy === "catchup" ? Math.min(missed, CATCHUP_MAX_FIRES) : 1;
      for (let i = 0; i < fireCount; i++) {
        // catchup 触发走 trigger_source='catchup'，但这里复用 executeJob 路径
        await this.executeJob(job, undefined, "catchup");
        firedCount += 1;
      }
    }

    return { checkedJob: jobs.length, firedCount, missedCount };
  }

  private countDueRuns(job: CronJob, now: number, limit: number): number {
    if (job.schedule.kind === "at" || limit <= 0) return 0;

    const persistedNextRunAt = job.state.nextRunAtMs;
    if (typeof persistedNextRunAt === "number") {
      if (persistedNextRunAt > now) return 0;

      if (job.schedule.kind === "every") {
        return Math.min(
          limit,
          Math.floor((now - persistedNextRunAt) / job.schedule.everyMs) + 1,
        );
      }

      try {
        const cron = new Cron(job.schedule.expr, { timezone: job.schedule.tz });
        let count = 1;
        let cursor = persistedNextRunAt;
        while (count < limit) {
          const next = cron.nextRun(new Date(cursor + 1));
          if (!next || next.getTime() > now) break;
          cursor = next.getTime();
          count += 1;
        }
        return count;
      } catch {
        return 0;
      }
    }

    // Legacy rows may not have nextRunAt. Fall back to the most recent known
    // execution anchor, without the previous off-by-one subtraction.
    const expectedInterval = this.computeExpectedIntervalMs(job);
    if (!expectedInterval) return 0;
    const lastCheckedAt = job.state.lastRunAtMs ?? job.metadata.createdAt;
    return Math.min(limit, Math.max(0, Math.floor((now - lastCheckedAt) / expectedInterval)));
  }

  private computeExpectedIntervalMs(job: CronJob): number | undefined {
    if (job.schedule.kind === "every") return job.schedule.everyMs;
    if (job.schedule.kind === "cron") {
      try {
        const c = new Cron(job.schedule.expr, { timezone: job.schedule.tz });
        const next = c.nextRun();
        if (next) {
          const after = new Cron(job.schedule.expr, { timezone: job.schedule.tz });
          const second = after.nextRun(new Date(next.getTime() + 1));
          if (second) return second.getTime() - next.getTime();
        }
      } catch {
        // 表达式非法，忽略
      }
    }
    return undefined;
  }

  private async markMissed(job: CronJob, error: string): Promise<void> {
    await this.repo.update(job.id, {
      state: { ...job.state, lastStatus: "missed", lastError: error },
    });
    const updated = await this.repo.getById(job.id);
    if (updated) this.emitter.emitJobUpdated(updated);
    this.emitter.emitJobExecuted(job.id, "missed", error);
  }

  // ── Busy-Retry 退避计算（F-04 / POLICY.md §2）──

  /** 计算单次退避毫秒数：min(30s, max(1s, (nextRunAtMs - now) / 2)) */
  computeBackoffMs(job: CronJob, now: number): number {
    const nextRunAtMs = job.state.nextRunAtMs;
    if (typeof nextRunAtMs !== "number") return BACKOFF_DEFAULT_MS;
    return Math.min(BACKOFF_MAX_MS, Math.max(BACKOFF_MIN_MS, (nextRunAtMs - now) / 2));
  }

  // ── Stuck Watchdog（F-07 / POLICY.md §4）──

  private startWatchdog(): void {
    if (this.watchdogTimer) return;
    this.watchdogTimer = setInterval(() => {
      void this.runWatchdog();
    }, WATCHDOG_INTERVAL_MS);
  }

  /** 扫描 cron_job_runs.status='running' 且运行超过 600 秒的卡死任务 */
  async runWatchdog(): Promise<{ cleared: number }> {
    const cutoff = Date.now() - STUCK_THRESHOLD_MS;
    const stuck = getStuckRuns(cutoff);
    for (const run of stuck) {
      updateCronRun(run.id, {
        status: "missed",
        finishedAt: Date.now(),
        error: "执行超时（watchdog）",
      });
      if (run.conversationId) {
        this.executor.setProcessing(run.conversationId, false);
      }
      this.emitter.emitJobExecuted(run.jobId, "missed", "执行超时（watchdog）");
    }
    return { cleared: stuck.length };
  }

  // ── Cleanup ──

  destroy(): void {
    for (const jobId of this.timers.keys()) {
      this.stopTimer(jobId);
    }
    this.timers.clear();
    this.retryTimers.clear();
    this.pausedJobs.clear();
    this.inFlightJobs.clear();
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    this.initialized = false;
  }
}

export type { CronJob, CronSchedule, MisfirePolicy } from "./cron-types.js";
