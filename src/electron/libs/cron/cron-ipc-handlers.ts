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
