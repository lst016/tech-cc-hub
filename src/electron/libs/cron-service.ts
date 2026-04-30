import { EventEmitter } from "events";

export type CronScheduleKind = "cron" | "every" | "at";

export type CronJobDef = {
  id: string;
  name: string;
  kind: CronScheduleKind;
  expression: string;
  prompt: string;
  sessionId?: string;
  enabled: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastStatus?: "success" | "failure";
  lastError?: string;
  runCount: number;
};

export type CronJobEvent = {
  jobId: string;
  status: "started" | "completed" | "failed";
  error?: string;
  startedAt: number;
  endedAt?: number;
};

export class CronService extends EventEmitter {
  private jobs = new Map<string, CronJobDef>();
  private timers = new Map<string, ReturnType<typeof setInterval> | ReturnType<typeof setTimeout>>();
  private running = new Set<string>();

  constructor() {
    super();
  }

  addJob(def: Omit<CronJobDef, "id" | "createdAt" | "runCount">): CronJobDef {
    const id = `cron_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const job: CronJobDef = {
      ...def,
      id,
      createdAt: Date.now(),
      runCount: 0,
    };
    this.jobs.set(id, job);
    if (job.enabled) this.scheduleJob(job);
    return job;
  }

  updateJob(id: string, patch: Partial<Omit<CronJobDef, "id" | "createdAt">>): CronJobDef | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    const updated: CronJobDef = { ...job, ...patch };
    this.unscheduleJob(id);
    this.jobs.set(id, updated);
    if (updated.enabled) this.scheduleJob(updated);
    return updated;
  }

  removeJob(id: string): boolean {
    this.unscheduleJob(id);
    return this.jobs.delete(id);
  }

  getJob(id: string): CronJobDef | undefined {
    return this.jobs.get(id);
  }

  listJobs(): CronJobDef[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  async runJobNow(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`任务 ${id} 不存在`);
    await this.executeJob(job);
  }

  private scheduleJob(job: CronJobDef): void {
    if (job.kind === "every") {
      const ms = parseEveryExpression(job.expression);
      if (ms <= 0) return;
      const timer = setInterval(() => { void this.executeJob(job); }, ms);
      this.timers.set(job.id, timer);
    } else if (job.kind === "at") {
      const delay = parseAtExpression(job.expression);
      if (delay <= 0) return;
      const timer = setTimeout(() => { void this.executeJob(job); }, delay);
      this.timers.set(job.id, timer);
    } else if (job.kind === "cron") {
      const nextMs = nextCronDelay(job.expression);
      if (nextMs <= 0) return;
      this.scheduleCronTick(job, nextMs);
    }
  }

  private scheduleCronTick(job: CronJobDef, delayMs: number): void {
    const timer = setTimeout(() => {
      void this.executeJob(job);
      const nextMs = nextCronDelay(job.expression);
      if (nextMs > 0) this.scheduleCronTick(job, nextMs);
    }, delayMs);
    this.timers.set(job.id, timer);
  }

  private unscheduleJob(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
      this.timers.delete(id);
    }
  }

  private async executeJob(job: CronJobDef): Promise<void> {
    if (this.running.has(job.id)) return;
    this.running.add(job.id);

    const event: CronJobEvent = { jobId: job.id, status: "started", startedAt: Date.now() };
    this.emit("job", event);

    try {
      const updated: CronJobDef = {
        ...job,
        lastRunAt: event.startedAt,
        runCount: job.runCount + 1,
      };
      this.jobs.set(job.id, updated);

      this.emit("execute", { job: updated, prompt: job.prompt, sessionId: job.sessionId });

      const completed: CronJobEvent = {
        ...event,
        status: "completed",
        endedAt: Date.now(),
      };
      this.emit("job", completed);

      const final: CronJobDef = {
        ...updated,
        lastStatus: "success",
        lastError: undefined,
      };
      this.jobs.set(job.id, final);
    } catch (error) {
      const failed: CronJobEvent = {
        ...event,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        endedAt: Date.now(),
      };
      this.emit("job", failed);

      const final: CronJobDef = {
        ...job,
        lastRunAt: event.startedAt,
        runCount: job.runCount + 1,
        lastStatus: "failure",
        lastError: failed.error,
      };
      this.jobs.set(job.id, final);
    } finally {
      this.running.delete(job.id);
    }
  }

  destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer as ReturnType<typeof setTimeout>);
      clearInterval(timer as ReturnType<typeof setInterval>);
    }
    this.timers.clear();
    this.jobs.clear();
    this.running.clear();
    this.removeAllListeners();
  }
}

function parseEveryExpression(expr: string): number {
  const match = expr.trim().match(/^(\d+)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hour|hours)?$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  const unit = (match[2] ?? "m").toLowerCase();
  if (unit.startsWith("s")) return value * 1000;
  if (unit.startsWith("h")) return value * 3600_000;
  return value * 60_000;
}

function parseAtExpression(expr: string): number {
  const now = Date.now();
  const target = new Date(expr).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, target - now);
}

function nextCronDelay(_expr: string): number {
  return 60_000;
}
