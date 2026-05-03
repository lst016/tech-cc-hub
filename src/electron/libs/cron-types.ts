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
