// Source: CV from AionUi ICronJobExecutor.ts + CronBusyGuard.ts
// Adapted for tech-cc-hub: simplified executor implementation delegating to runner/session system

import type { CronJob } from "./cron-types.js";

// ── ICronJobExecutor interface ──

export interface ICronJobExecutor {
  isConversationBusy(conversationId: string): boolean;
  executeJob(job: CronJob, onAcquired?: () => void, preparedConversationId?: string): Promise<string | void>;
  prepareConversation(job: CronJob): Promise<string>;
  onceIdle(conversationId: string, callback: () => Promise<void>): void;
  setProcessing(conversationId: string, busy: boolean): void;
}

// ── CronBusyGuard (CV from AionUi CronBusyGuard.ts, 135 lines) ──

interface ConversationState {
  isProcessing: boolean;
  lastActiveAt: number;
}

type IdleCallback = () => void;

export class CronBusyGuard {
  private states = new Map<string, ConversationState>();
  private idleCallbacks = new Map<string, IdleCallback[]>();

  isProcessing(conversationId: string): boolean {
    return this.states.get(conversationId)?.isProcessing ?? false;
  }

  setProcessing(conversationId: string, value: boolean): void {
    const state = this.states.get(conversationId) ?? { isProcessing: false, lastActiveAt: 0 };
    state.isProcessing = value;
    if (value) state.lastActiveAt = Date.now();
    this.states.set(conversationId, state);

    if (!value) {
      const callbacks = this.idleCallbacks.get(conversationId);
      if (callbacks) {
        this.idleCallbacks.delete(conversationId);
        for (const cb of callbacks) cb();
      }
    }
  }

  onceIdle(conversationId: string, callback: IdleCallback): void {
    if (!this.isProcessing(conversationId)) {
      callback();
      return;
    }
    const existing = this.idleCallbacks.get(conversationId) ?? [];
    existing.push(callback);
    this.idleCallbacks.set(conversationId, existing);
  }

  getLastActiveAt(conversationId: string): number | undefined {
    return this.states.get(conversationId)?.lastActiveAt;
  }

  async waitForIdle(conversationId: string, timeoutMs = 60000): Promise<void> {
    const start = Date.now();
    const pollInterval = 1000;
    while (this.isProcessing(conversationId)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`等待会话 ${conversationId} 空闲超时`);
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }
  }

  cleanup(olderThanMs = 3600000): void {
    const now = Date.now();
    for (const [id, state] of this.states) {
      if (!state.isProcessing && now - state.lastActiveAt > olderThanMs) {
        this.states.delete(id);
      }
    }
  }

  remove(conversationId: string): void {
    this.states.delete(conversationId);
  }

  clear(): void {
    this.states.clear();
  }
}

// ── Simplified CronJobExecutor ──

/**
 * Simplified CronJobExecutor for tech-cc-hub
 *
 * Compared to AionUi WorkerTaskManagerJobExecutor (912 lines), we remove:
 * - Agent selection / multi-backend support
 * - Model/provider resolution
 * - SKILL_SUGGEST.md monitoring
 * - Workspace file copying
 * - New conversation creation (we always reuse existing)
 * - Yolo mode enforcement
 */
export class CronJobExecutor implements ICronJobExecutor {
  constructor(
    private readonly busyGuard: CronBusyGuard,
    private readonly sendMessage?: (conversationId: string, text: string, executionMode?: string) => Promise<void>,
  ) {}

  isConversationBusy(conversationId: string): boolean {
    return this.busyGuard.isProcessing(conversationId);
  }

  async executeJob(
    job: CronJob,
    onAcquired?: () => void,
    preparedConversationId?: string,
  ): Promise<string | void> {
    const conversationId = preparedConversationId ?? job.metadata.conversationId;

    this.busyGuard.setProcessing(conversationId, true);
    onAcquired?.();

    try {
      const text = this.buildMessageText(job);
      if (this.sendMessage) {
        await this.sendMessage(conversationId, text, job.target.executionMode);
      } else {
        console.log(`[CronExecutor] 定时任务 "${job.name}" 触发, 会话: ${conversationId}, 内容: ${text}`);
      }
    } finally {
      // Busy state cleared by CronService via onceIdle callback
    }

    return conversationId;
  }

  async prepareConversation(job: CronJob): Promise<string> {
    return job.metadata.conversationId;
  }

  onceIdle(conversationId: string, callback: () => Promise<void>): void {
    this.busyGuard.onceIdle(conversationId, callback);
  }

  setProcessing(conversationId: string, busy: boolean): void {
    this.busyGuard.setProcessing(conversationId, busy);
  }

  private buildMessageText(job: CronJob): string {
    const rawText = job.target.payload.text;
    return `[定时任务执行]\n任务: ${job.name}\n周期: ${job.schedule.description}\n\n${rawText}`;
  }
}
