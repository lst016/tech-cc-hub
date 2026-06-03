// Source: CV from AionUi cronBridge.ts (56 lines) + IpcCronEventEmitter.ts (34 lines)
// Adapted for tech-cc-hub: Electron ipcMain.handle + webContents.send instead of ipcBridge

import { ipcMain, BrowserWindow } from "electron";
import type { CronJob, CreateCronJobParams } from "./cron-types.js";
import type { CronService } from "./cron-service.js";
import type { ICronEventEmitter } from "./cron-event-emitter.js";
import { listCronRuns } from "./cron-db.js";

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

  emitJobRunsAppended(jobId: string, runs: import("./cron-types.js").CronJobRun[]): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-runs-appended", { jobId, runs });
    }
  }

  emitJobBound(jobId: string, conversationId: string): void {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-bound", { jobId, conversationId });
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

  // F-12：暂停任务（保留 timer 但不触发）
  ipcMain.handle("cron:pause-job", async (_event, params: { jobId: string }) => {
    return cronService.pauseJob(params.jobId);
  });

  // F-12：恢复任务
  ipcMain.handle("cron:resume-job", async (_event, params: { jobId: string }) => {
    return cronService.resumeJob(params.jobId);
  });

  // F-08：把任务绑到指定会话（同时触发 emitJobBound）
  ipcMain.handle("cron:bind-conversation", async (_event, params: { jobId: string; conversationId: string; conversationTitle?: string }) => {
    const job = await cronService.getJob(params.jobId);
    if (!job) throw new Error(`任务不存在: ${params.jobId}`);
    // C-2: 校验 conversationId 格式；非法则 fallback 到 __system__ + warn
    const conv = params.conversationId?.trim() || "__system__";
    let finalConvId = conv;
    if (conv !== "__system__" && (conv.length > 256 || /[\r\n;'"`]/.test(conv))) {
      console.warn(`[IPC cron] bind-conversation: 会话 ID 格式非法 (${conv})，回退到 __system__`);
      finalConvId = "__system__";
    }
    const updated = await cronService.updateJob(params.jobId, {
      metadata: {
        ...job.metadata,
        conversationId: finalConvId,
        conversationTitle: params.conversationTitle ?? job.metadata.conversationTitle,
        updatedAt: Date.now(),
      },
    });
    // 通知渲染进程
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("cron:job-bound", { jobId: params.jobId, conversationId: finalConvId });
    }
    return updated;
  });

  // F-06：查询任务执行历史
  ipcMain.handle("cron:list-runs", async (_event, params: { jobId: string; limit?: number }) => {
    return listCronRuns(params.jobId, params.limit ?? 50);
  });

  // F-05：手动触发 missed-run 追补
  ipcMain.handle("cron:trigger-catchup", async () => {
    return cronService.triggerCatchup();
  });
}
