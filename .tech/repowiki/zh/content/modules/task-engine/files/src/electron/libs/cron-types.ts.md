# src/electron/libs/cron-types.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：35

## 文件职责

源码文件

## 关键符号

- `CronJobRow@9 - `

## 对外暴露

- `CronJobRow`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Re-export shared cron types for Electron main process consumers
export type {
  CronSchedule,
  CronJob,
  CreateCronJobParams,
} from "../../types/cron.js";

// Database row type is electron-only
export type CronJobRow = {
  id: string;
  name: string;
  description: string | null;
  enabled: number;
  schedule_kind: string;
  schedule_value: string;
  schedule_tz: string | null;
  schedule_description: string;
  payload_message: string;
  execution_mode: string | null;
  agent_config: string | null;
  conversation_id: string;
  conversation_title: string | null;
  agent_type: string;
  created_by: string;
  created_at: number;
  updated_at: number;
  next_run_at: number | null;
  last_run_at: number | null;
  last_status: string | null;
  last_error: string | null;
  run_count: number;
  retry_count: number;
  max_retries: number;
};

```
