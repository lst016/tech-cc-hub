# src/electron/libs/cron-event-emitter.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：12

## 文件职责

源码文件。依赖：./cron-types.js

## 关键符号

- `ICronEventEmitter@5 - `

## 依赖输入

- `./cron-types.js`

## 对外暴露

- `ICronEventEmitter`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from AionUi ICronEventEmitter.ts
// Adapted for tech-cc-hub: simplified showNotification signature

import type { CronJob } from "./cron-types.js";

export interface ICronEventEmitter {
  emitJobCreated(job: CronJob): void;
  emitJobUpdated(job: CronJob): void;
  emitJobExecuted(jobId: string, status: "ok" | "error" | "skipped" | "missed", error?: string): void;
  emitJobRemoved(jobId: string): void;
}

```
