# src/electron/libs/cron-repository.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：60

## 文件职责

源码文件。依赖：./cron-types.js、./cron-db.js

## 关键符号

- `CronRepository@26 - `
- `ICronRepository@15 - `

## 依赖输入

- `./cron-types.js`
- `./cron-db.js`

## 对外暴露

- `ICronRepository`
- `CronRepository`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from AionUi ICronRepository.ts + SqliteCronRepository.ts
// Adapted for tech-cc-hub: delegates to cron-db.ts functions directly

import type { CronJob } from "./cron-types.js";
import {
  insertCronJob,
  updateCronJob,
  deleteCronJob,
  getCronJobById,
  listAllCronJobs,
  listCronJobsByConversation,
  listEnabledCronJobs,
  deleteCronJobsByConversation,
} from "./cron-db.js";

export interface ICronRepository {
  insert(job: CronJob): Promise<void>;
  update(jobId: string, updates: Partial<CronJob>): Promise<void>;
  delete(jobId: string): Promise<void>;
  getById(jobId: string): Promise<CronJob | null>;
  listAll(): Promise<CronJob[]>;
  listEnabled(): Promise<CronJob[]>;
  listByConversation(conversationId: string): Promise<CronJob[]>;
  deleteByConversation(conversationId: string): Promise<number>;
}

export class CronRepository implements ICronRepository {
  async insert(job: CronJob): Promise<void> {
    insertCronJob(job);
  }

  async update(jobId: string, updates: Partial<CronJob>): Promise<void> {
    updateCronJob(jobId, updates);
  }

  async delete(jobId: string): Promise<void> {
    deleteCronJob(jobId);
  }

  async getById(jobId: string): Promise<CronJob | null> {
    return getCronJobById(jobId);
  }

  async listAll(): Promise<CronJob[]> {
    return listAllCronJobs();
  }

  async listEnabled(): Promise<CronJob[]> {
    return listEnabledCronJobs();
  }

  async listByConversation(conversationId: string): Promise<CronJob[]> {
    return listCronJobsByConversation(conversationId);
  }

  async deleteByConversation(conversationId: string): Promise<number> {
    return deleteCronJobsByConversation(conversationId);
  }
}

```
