# src/types/cron.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：63

## 文件职责

源码文件

## 关键符号

- `CronSchedule@3 - `
- `CronJob@8 - `
- `CreateCronJobParams@49 - `

## 对外暴露

- `CronSchedule`
- `CronJob`
- `CreateCronJobParams`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
