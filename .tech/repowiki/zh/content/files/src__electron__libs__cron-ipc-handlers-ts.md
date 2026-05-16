# src/electron/libs/cron-ipc-handlers.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：65

## 文件职责

源码文件。运行信号：ipcMain.handle: cron:list-jobs、ipcMain.handle: cron:list-jobs-by-conversation、ipcMain.handle: cron:get-job、ipcMain.handle: cron:add-job、ipcMain.handle: cron:update-job；依赖：electron、./cron-types.js、./cron-service.js、./cron-event-emitter.js

## 运行信号

- `ipcMain.handle: cron:list-jobs`
- `ipcMain.handle: cron:list-jobs-by-conversation`
- `ipcMain.handle: cron:get-job`
- `ipcMain.handle: cron:add-job`
- `ipcMain.handle: cron:update-job`
- `ipcMain.handle: cron:remove-job`
- `ipcMain.handle: cron:run-now`

## 关键符号

- `registerCronIpcHandlers@34 - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job`
- `IpcCronEventEmitter@8 - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job`
- `conversationId@61 - ipcMain.handle: cron:list-jobs, ipcMain.handle: cron:list-jobs-by-conversation, ipcMain.handle: cron:get-job`

## 依赖输入

- `electron`
- `./cron-types.js`
- `./cron-service.js`
- `./cron-event-emitter.js`

## 对外暴露

- `IpcCronEventEmitter`
- `registerCronIpcHandlers`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// Source: CV from AionUi cronBridge.ts (56 lines) + IpcCronEventEmitter.ts (34 lines)
// Adapted for tech-cc-hub: Electron ipcMain.handle + webContents.send instead of ipcBridge

import { ipcMain, BrowserWindow } from "electron";
import type { CronJob, CreateCronJobParams } from "./cron-types.js";
import type { CronService } from "./cron-service.js";
import type { ICronEventEmitter } from "./cron-event-emitter.js";

export class IpcCronEventEmitter implements ICronEventEmitter {
  emitJobCreated(job: CronJob): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-created", job);
    }
  }

  emitJobUpdated(job: CronJob): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-updated", job);
    }
  }

  emitJobExecuted(jobId: string, status: "ok" | "error" | "skipped" | "missed", error?: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-executed", { jobId, status, error });
    }
  }

  emitJobRemoved(jobId: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-removed", { jobId });
    }
  }
}

export function registerCronIpcHandlers(cronService: CronService): void {
  ipcMain.handle("cron:list-jobs", async () => {
    return cronService.listJobs();
  });

  ipcMain.handle("cron:list-jobs-by-conversation", async (_event, params: { conversationId: string }) => {
    return cronService.listJobsByConversation(params.conversationId);
  });

  ipcMain.handle("cron:get-job", async (_event, params: { jobId: string }) => {
    return cronService.getJob(params.jobId);
  });

  ipcMain.handle("cron:add-job", async (_event, params: CreateCronJobParams) => {
    return cronService.addJob(params);
  });

  ipcMain.handle("cron:update-job", async (_event, params: { jobId: string; updates: Partial<CronJob> }) => {
    return cronService.updateJob(params.jobId, params.updates);
  });

  ipcMain.handle("cron:remove-job", async (_event, params: { jobId: string }) => {
    await cronService.removeJob(params.jobId);
  });

  ipcMain.handle("cron:run-now", async (_event, params: { jobId: string }) => {
    const conversationId = await cronService.runNow(params.jobId);
    return { conversationId };
  });
}

```
