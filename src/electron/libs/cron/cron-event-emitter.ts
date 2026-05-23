// Source: CV from AionUi ICronEventEmitter.ts
// Adapted for tech-cc-hub: simplified showNotification signature

import type { CronJob } from "./cron-types.js";

export interface ICronEventEmitter {
  emitJobCreated(job: CronJob): void;
  emitJobUpdated(job: CronJob): void;
  emitJobExecuted(jobId: string, status: "ok" | "error" | "skipped" | "missed", error?: string): void;
  emitJobRemoved(jobId: string): void;
}
