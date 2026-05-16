# src/electron/libs/cron-service.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：319

## 文件职责

源码文件。依赖：croner、./cron-types.js、./cron-repository.js、./cron-event-emitter.js、./cron-executor.js

## 关键符号

- `CronService@10 - `
- `jobs@27 - `
- `now@39 - `
- `jobId@40 - `
- `existing@76 - `
- `updated@81 - `
- `job@101 - `
- `job@107 - `
- `conversationId@109 - `
- `timer@139 - `
- `nextRun@143 - `
- `timer@161 - `
- `delay@170 - `
- `timer@172 - `
- `timer@194 - `
- `retryTimer@204 - `

## 依赖输入

- `croner`
- `./cron-types.js`
- `./cron-repository.js`
- `./cron-event-emitter.js`
- `./cron-executor.js`

## 对外暴露

- `CronService`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
... (truncated)
```
