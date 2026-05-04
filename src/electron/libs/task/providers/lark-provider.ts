import { execFile } from "child_process";
import { promisify } from "util";
import type { TaskProvider, ExternalTask, ExternalTaskStatus, TaskProviderCapability } from "../types.js";
import { getGlobalRuntimeEnvConfig } from "../../claude-settings.js";
import { loadGlobalRuntimeConfig } from "../../config-store.js";

const execFileAsync = promisify(execFile);

type LarkTaskItem = {
  id?: string;
  guid?: string;
  title?: string;
  summary?: string;
  description?: unknown;
  status?: string;
  completed?: boolean;
  completed_at?: string | number;
  assignee?: string;
  members?: unknown;
  assignee_related?: unknown;
  priority?: string;
  due_date?: number;
  due?: unknown;
  created_at?: string | number;
  updated_at?: string | number;
  [key: string]: unknown;
};

type LarkCliPayload = {
  ok?: boolean;
  error?: {
    type?: string;
    message?: string;
    hint?: string;
  };
  data?: unknown;
  items?: unknown;
  has_more?: boolean;
  page_token?: string;
  [key: string]: unknown;
};

function mapLarkStatus(status?: string): ExternalTaskStatus {
  switch (status) {
    case "done":
    case "completed":
      return "done";
    case "in_progress":
    case "doing":
      return "in_progress";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapLarkPriority(priority?: string): ExternalTask["priority"] {
  switch (priority) {
    case "urgent":
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

type LarkProviderConfig = {
  cliCommand?: string;
  cliProfile?: string;
};

const DEFAULT_CONFIG: LarkProviderConfig = {
  cliCommand: "lark-cli",
};

const LARK_TASK_PAGE_SIZE = 100;
const RECENT_SYNC_WINDOW_DAYS = 30;
const RECENT_SYNC_WINDOW_MS = RECENT_SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isTruthyCompletion(value: unknown): boolean {
  const completedAt = asNumber(value);
  return typeof completedAt === "number" && completedAt > 0;
}

function toEpochMs(value: unknown): number | undefined {
  const parsed = asNumber(value);
  if (typeof parsed !== "number") return undefined;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function getTaskActivityTime(item: LarkTaskItem): number | undefined {
  return toEpochMs(item.updated_at) ?? toEpochMs(item.completed_at) ?? toEpochMs(item.created_at);
}

function resolveLarkChannelConfig(): LarkProviderConfig {
  const rootConfig = loadGlobalRuntimeConfig();
  const channels = isRecord(rootConfig.channels) ? rootConfig.channels : {};
  const items = isRecord(channels.items) ? channels.items : {};
  const lark = isRecord(items.lark) ? items.lark : {};
  return {
    cliCommand: asText(lark.cliCommand),
    cliProfile: asText(lark.cliProfile),
  };
}

function getNestedItems(payload: unknown): LarkTaskItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as LarkTaskItem[];
  }
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) {
    return payload.items.filter(isRecord) as LarkTaskItem[];
  }
  if (Array.isArray(payload.data)) {
    return payload.data.filter(isRecord) as LarkTaskItem[];
  }
  if (isRecord(payload.data)) {
    return getNestedItems(payload.data);
  }
  return [];
}

function formatCliError(payload: LarkCliPayload, stderr?: string): string {
  const errorMessage = payload.error?.message ?? "";
  if (errorMessage.includes("need_user_authorization")) {
    return [
      "lark-cli 已配置 App，但还没有用户授权。",
      "飞书“我的任务”接口需要 user token，请运行: lark-cli auth login --domain task",
    ].join(" ");
  }
  const parts = [
    payload.error?.message,
    payload.error?.hint,
    stderr?.trim(),
  ].filter((item): item is string => Boolean(item));
  return parts.join(" ") || "lark-cli 调用失败";
}

export class LarkTaskProvider implements TaskProvider {
  readonly id = "lark" as const;
  readonly name = "飞书任务";
  private config: LarkProviderConfig;

  constructor(config?: LarkProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getConfig(): LarkProviderConfig {
    return {
      ...DEFAULT_CONFIG,
      ...this.config,
      ...resolveLarkChannelConfig(),
    };
  }

  private getCliCommand(): string {
    return this.getConfig().cliCommand?.trim() || DEFAULT_CONFIG.cliCommand!;
  }

  isEnabled(): boolean {
    return true;
  }

  getCapabilities() {
    const capabilities: TaskProviderCapability[] = ["fetch", "status-writeback", "comment-writeback", "delete", "cli-configurable"];
    return capabilities;
  }

  private async runCli(args: string[], timeout = 30000): Promise<{ stdout: string; stderr: string }> {
    const { stdout, stderr } = await execFileAsync(this.getCliCommand(), args, {
      timeout,
      env: { ...process.env, ...getGlobalRuntimeEnvConfig() },
    });
    return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
  }

  private async fetchTaskItems(completed: boolean): Promise<LarkTaskItem[]> {
    const args = [
      "api",
      "GET",
      "/open-apis/task/v2/tasks",
      "--params",
      JSON.stringify({ type: "my_tasks", completed, page_size: LARK_TASK_PAGE_SIZE, user_id_type: "open_id" }),
      "--as",
      "user",
      "--page-all",
      "--format",
      "json",
    ];

    const { stdout, stderr } = await this.runCli(args);
    const raw = stdout.trim();
    let parsed: LarkCliPayload;
    try {
      parsed = JSON.parse(raw) as LarkCliPayload;
    } catch (parseError) {
      console.warn("[task-provider:lark] JSON parse failed, stdout:", raw.slice(0, 200), "stderr:", stderr.slice(0, 200));
      throw parseError;
    }
    if (parsed.ok === false) {
      throw new Error(formatCliError(parsed, stderr));
    }
    return getNestedItems(parsed);
  }

  async fetchTasks(): Promise<ExternalTask[]> {
    try {
      const activeItems = await this.fetchTaskItems(false);
      const cutoff = Date.now() - RECENT_SYNC_WINDOW_MS;
      const recentCompletedItems = (await this.fetchTaskItems(true)).filter((item) => {
        const activityTime = getTaskActivityTime(item);
        return typeof activityTime !== "number" || activityTime >= cutoff;
      });
      const byExternalId = new Map<string, ExternalTask>();
      for (const item of [...activeItems, ...recentCompletedItems]) {
        const task = this.mapToExternalTask(item);
        if (task.externalId) {
          byExternalId.set(task.externalId, task);
        }
      }
      return [...byExternalId.values()];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[task-provider:lark] Failed to fetch tasks:", message);
      throw new Error(message);
    }
  }

  async getTask(externalId: string): Promise<ExternalTask | null> {
    try {
      const args = ["api", "GET", `/open-apis/task/v2/tasks/${externalId}`, "--as", "user", "--format", "json"];
      const { stdout, stderr } = await this.runCli(args, 15000);

      const parsed = JSON.parse(stdout.trim()) as LarkCliPayload;
      if (parsed.ok === false) throw new Error(formatCliError(parsed, stderr));
      const item = isRecord(parsed.data) && isRecord(parsed.data.task)
        ? parsed.data.task as LarkTaskItem
        : isRecord(parsed.data)
          ? parsed.data as LarkTaskItem
          : parsed as LarkTaskItem;
      return this.mapToExternalTask(item);
    } catch {
      return null;
    }
  }

  async updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void> {
    const larkStatus = status === "done" ? "done" : "todo";
    const args = [
      "api",
      "PATCH",
      `/open-apis/task/v2/tasks/${externalId}`,
      "--data",
      JSON.stringify({ status: larkStatus }),
      "--as",
      "user",
      "--format",
      "json",
    ];
    const { stdout, stderr } = await this.runCli(args, 15000);
    const parsed = JSON.parse(stdout.trim()) as LarkCliPayload;
    if (parsed.ok === false) throw new Error(formatCliError(parsed, stderr));
  }

  async appendTaskComment(externalId: string, text: string): Promise<void> {
    const args = [
      "api",
      "POST",
      `/open-apis/task/v2/tasks/${externalId}/comments`,
      "--data",
      JSON.stringify({ content: text }),
      "--as",
      "user",
      "--format",
      "json",
    ];
    const { stdout, stderr } = await this.runCli(args, 15000);
    const parsed = JSON.parse(stdout.trim()) as LarkCliPayload;
    if (parsed.ok === false) throw new Error(formatCliError(parsed, stderr));
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const args = ["--version"];
      await this.runCli(args, 10000);
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `lark-cli 不可用: ${message}` };
    }
  }

  private mapToExternalTask(item: LarkTaskItem): ExternalTask {
    const due = isRecord(item.due) ? toEpochMs(item.due.timestamp) : undefined;
    const memberNames = Array.isArray(item.members)
      ? item.members
          .filter(isRecord)
          .map((member) => asText(member.name) ?? asText(member.id))
          .filter((name): name is string => Boolean(name))
      : [];
    const externalId = asText(item.guid) ?? asText(item.id) ?? "";
    const status = item.completed || isTruthyCompletion(item.completed_at) ? "done" : mapLarkStatus(item.status);
    const description = typeof item.description === "string"
      ? item.description
      : isRecord(item.description)
        ? asText(item.description.text) ?? JSON.stringify(item.description)
        : undefined;

    return {
      id: "", // filled by repository
      externalId,
      provider: "lark",
      title: asText(item.summary) ?? asText(item.title) ?? "未命名任务",
      description,
      status,
      assignee: asText(item.assignee) ?? (memberNames.join("、") || undefined),
      priority: mapLarkPriority(item.priority),
      dueDate: due ?? toEpochMs(item.due_date),
      sourceData: item,
      createdAt: toEpochMs(item.created_at) ?? Date.now(),
      updatedAt: toEpochMs(item.updated_at) ?? Date.now(),
    };
  }
}
