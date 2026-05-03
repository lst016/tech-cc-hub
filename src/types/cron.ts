// Shared cron types used by both Electron main process and renderer
// Source: CV from AionUi CronStore.ts

export type CronSchedule =
  | { kind: 'at'; atMs: number; description: string }
  | { kind: 'every'; everyMs: number; description: string }
  | { kind: 'cron'; expr: string; tz?: string; description: string };

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
    lastStatus?: 'ok' | 'error' | 'skipped' | 'missed';
    lastError?: string;
    runCount: number;
    retryCount: number;
    maxRetries: number;
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
