# src/electron/libs/cron-executor.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：155

## 文件职责

源码文件。依赖：./cron-types.js

## 关键符号

- `CronBusyGuard@24 - `
- `CronJobExecutor@104 - `
- `state@34 - `
- `callbacks@40 - `
- `existing@53 - `
- `start@63 - `
- `pollInterval@64 - `
- `now@74 - `
- `conversationId@119 - `
- `text@125 - `
- `rawText@151 - `
- `ICronJobExecutor@7 - `
- `ConversationState@17 - `
- `IdleCallback@22 - `

## 依赖输入

- `./cron-types.js`

## 对外暴露

- `ICronJobExecutor`
- `CronBusyGuard`
- `CronJobExecutor`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
      // Busy state cleared by CronService via onceIdle callb
... (truncated)
```
