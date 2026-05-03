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
