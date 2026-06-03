// Re-export shared cron types for Electron main process consumers
export type {
  CronSchedule,
  CronJob,
  CreateCronJobParams,
  CronJobRun,
  CronJobRunStatus,
  CronJobRunTrigger,
  MisfirePolicy,
} from "../../../types/cron.js";

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
  /** H-4 paused 持久化：0=未暂停, 1=暂停；兼容老库 ALTER TABLE 添加 */
  paused: number;
};

// 单次执行行的 DB row 类型（cron_job_runs 表）
export type CronJobRunRow = {
  id: string;
  job_id: string;
  started_at: number;
  finished_at: number | null;
  status: string;
  error: string | null;
  duration_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  conversation_id: string | null;
  trigger_source: string;
};
