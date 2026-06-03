// Shared cron types used by both Electron main process and renderer
// Source: CV from AionUi CronStore.ts

export type CronSchedule =
  | { kind: 'at'; atMs: number; description: string }
  | { kind: 'every'; everyMs: number; description: string; jitterMs?: number }
  | { kind: 'cron'; expr: string; tz?: string; description: string; jitterMs?: number };

export type CronJob = {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  schedule: CronSchedule;
  target: {
    payload: { kind: 'message'; text: string };
    executionMode?: 'existing' | 'new_conversation';
  };
  metadata: {
    conversationId: string;
    conversationTitle?: string;
    agentType: string;
    createdBy: 'user' | 'agent';
    createdAt: number;
    updatedAt: number;
    agentConfig?: {
      backend: string;
      name: string;
      cliPath?: string;
      isPreset?: boolean;
      customAgentId?: string;
      presetAgentType?: string;
      mode?: string;
      modelId?: string;
      configOptions?: Record<string, string>;
      workspace?: string;
    };
  };
  state: {
    nextRunAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: 'ok' | 'error' | 'skipped' | 'missed' | 'retrying';
    lastError?: string;
    runCount: number;
    retryCount: number;
    maxRetries: number;
    /** Misfire 策略：错过自然触发点时如何补跑（POLICY.md §3），默认 fire-once */
    misfirePolicy?: MisfirePolicy;
    /** 同 job 的最大并发执行数（F-12 / POLICY.md §5），默认 1 */
    maxConcurrent?: number;
    /** 是否被用户暂停（pauseJob 调用后置 true，timer 保留但 executeJob 早退） */
    paused?: boolean;
  };
};

export type CreateCronJobParams = {
  name: string;
  description?: string;
  schedule: CronSchedule;
  prompt?: string;
  message?: string;
  conversationId: string;
  conversationTitle?: string;
  agentType: string;
  createdBy: 'user' | 'agent';
  executionMode?: 'existing' | 'new_conversation';
  agentConfig?: CronJob['metadata']['agentConfig'];
};

// 单次执行记录：每次 fire / 手动触发 / 启动追补都写一条
// 字段对齐 SPEC §4.2 的 cron_job_runs 表
export type CronJobRunStatus = 'running' | 'ok' | 'error' | 'skipped' | 'missed' | 'retrying';
export type CronJobRunTrigger = 'schedule' | 'manual' | 'catchup';

// Misfire 策略：错过自然触发点时的行为（POLICY.md §3）
export type MisfirePolicy = 'fire-once' | 'catchup' | 'skip';

export type CronJobRun = {
  id: string;
  jobId: string;
  startedAt: number;
  finishedAt?: number;
  status: CronJobRunStatus;
  error?: string;
  durationMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  conversationId?: string;
  triggerSource: CronJobRunTrigger;
};
