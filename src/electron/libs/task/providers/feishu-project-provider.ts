import type { ExternalTask, ExternalTaskStatus, TaskProvider, TaskProviderCapability } from "../types.js";
import { getGlobalRuntimeEnvConfig } from "../../claude/claude-settings.js";
import { loadGlobalRuntimeConfig } from "../../config-store.js";
import { runExternalCli } from "../../external-cli.js";

type FeishuProjectWorkItem = {
  id?: string;
  name?: string;
  description?: string;
  status?: string;
  assignee?: { name?: string; key?: string };
  priority?: { name?: string; value?: string };
  createdAt?: string | number;
  updatedAt?: string | number;
  [key: string]: unknown;
};

type FeishuProjectCliPayload =
  | { data?: unknown; items?: unknown; hasMore?: boolean }
  | unknown[];

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

function toEpochMs(value: unknown): number | undefined {
  const parsed = asNumber(value);
  if (typeof parsed !== "number") return undefined;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function mapFeishuStatus(status?: string): ExternalTaskStatus {
  switch (status) {
    case "done":
    case "completed":
    case "closed":
      return "done";
    case "in_progress":
    case "doing":
    case "processing":
      return "in_progress";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapFeishuPriority(priority?: string): ExternalTask["priority"] {
  switch (priority?.toLowerCase()) {
    case "urgent":
      return "urgent";
    case "high":
    case "p0":
    case "p1":
      return "high";
    case "low":
    case "p3":
    case "p4":
      return "low";
    default:
      return "medium";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function resolveFeishuProjectConfig(): { cliCommand: string; workItemType: string; projectKey?: string } {
  const rootConfig = loadGlobalRuntimeConfig();
  const envConfig = getGlobalRuntimeEnvConfig();

  const cliCommand = asText(envConfig.FEISHU_PROJECT_CLI) ?? "feishu-project";
  const workItemType = asText(envConfig.FEISHU_PROJECT_WORK_ITEM_TYPE)
    ?? (isRecord(rootConfig.feishuProject) ? asText((rootConfig.feishuProject as Record<string, unknown>).workItemType) : undefined)
    ?? "task";
  const projectKey = asText(envConfig.FEISHU_PROJECT_KEY)
    ?? (isRecord(rootConfig.feishuProject) ? asText((rootConfig.feishuProject as Record<string, unknown>).projectKey) : undefined);

  return { cliCommand, workItemType, projectKey };
}

function getItems(payload: FeishuProjectCliPayload): FeishuProjectWorkItem[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as FeishuProjectWorkItem[];
  }
  if (!isRecord(payload)) return [];
  if (Array.isArray(payload.items)) {
    return payload.items.filter(isRecord) as FeishuProjectWorkItem[];
  }
  if (Array.isArray(payload.data)) {
    return payload.data.filter(isRecord) as FeishuProjectWorkItem[];
  }
  if (isRecord(payload.data)) {
    return getItems(payload.data as FeishuProjectCliPayload);
  }
  return [];
}

export class FeishuProjectTaskProvider implements TaskProvider {
  readonly id = "feishu-project" as const;
  readonly name = "飞书项目";

  isEnabled(): boolean {
    const config = resolveFeishuProjectConfig();
    return Boolean(config.projectKey);
  }

  getCapabilities(): TaskProviderCapability[] {
    return ["fetch", "status-writeback", "comment-writeback", "delete"];
  }

  private async runCli(args: string[], timeout = 30000): Promise<{ stdout: string; stderr: string }> {
    const config = resolveFeishuProjectConfig();
    const { stdout, stderr } = await runExternalCli(config.cliCommand, args, {
      timeout,
      env: { ...process.env, ...getGlobalRuntimeEnvConfig() },
    });
    return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
  }

  async fetchTasks(): Promise<ExternalTask[]> {
    const config = resolveFeishuProjectConfig();
    try {
      const args = ["list-items", "--type", config.workItemType, "--format", "json"];
      const { stdout, stderr } = await this.runCli(args);
      const raw = stdout.trim();
      if (!raw) return [];
      const parsed = JSON.parse(raw) as FeishuProjectCliPayload;
      const items = getItems(parsed);
      return items
        .map((item) => this.mapToExternalTask(item))
        .filter((task): task is ExternalTask => task !== null && Boolean(task.externalId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[task-provider:feishu-project] Failed to fetch tasks:", message);
      throw new Error(message);
    }
  }

  async getTask(externalId: string): Promise<ExternalTask | null> {
    const config = resolveFeishuProjectConfig();
    try {
      const args = ["get-item", externalId, "--type", config.workItemType, "--format", "json"];
      const { stdout, stderr } = await this.runCli(args, 15000);
      const raw = stdout.trim();
      if (!raw) return null;
      const parsed = JSON.parse(raw) as FeishuProjectCliPayload;
      const items = getItems(parsed);
      if (items.length === 0) return null;
      return this.mapToExternalTask(items[0]);
    } catch {
      return null;
    }
  }

  async updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void> {
    const targetStatus = status === "done" ? "done" : status === "cancelled" ? "cancelled" : "in_progress";
    const config = resolveFeishuProjectConfig();
    const args = [
      "update-item", externalId,
      "--type", config.workItemType,
      "--status", targetStatus,
      "--format", "json",
    ];
    await this.runCli(args, 15000);
  }

  async appendTaskComment(externalId: string, text: string): Promise<void> {
    const config = resolveFeishuProjectConfig();
    const args = [
      "comment", externalId,
      "--type", config.workItemType,
      "--text", text,
      "--format", "json",
    ];
    await this.runCli(args, 15000);
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const config = resolveFeishuProjectConfig();
    try {
      const args = ["--version"];
      await this.runCli(args, 10000);
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `feishu-project CLI 不可用: ${message}` };
    }
  }

  private mapToExternalTask(item: FeishuProjectWorkItem): ExternalTask | null {
    const externalId = asText(item.id) ?? "";
    if (!externalId) return null;

    const assigneeName = isRecord(item.assignee)
      ? asText(item.assignee.name) ?? asText(item.assignee.key)
      : undefined;

    const priorityName = isRecord(item.priority)
      ? asText(item.priority.name) ?? asText(item.priority.value)
      : asText(item.priority);

    return {
      id: "",
      externalId,
      provider: "feishu-project",
      title: asText(item.name) ?? asText(item.title) ?? "未命名工作项",
      description: asText(item.description),
      status: mapFeishuStatus(asText(item.status)),
      assignee: assigneeName,
      priority: mapFeishuPriority(priorityName ?? asText(item.priority)),
      dueDate: toEpochMs(item.dueDate ?? (isRecord(item.due) ? (item.due as Record<string, unknown>).timestamp : undefined)),
      sourceData: item as Record<string, unknown>,
      createdAt: toEpochMs(item.createdAt ?? item.created_at) ?? Date.now(),
      updatedAt: toEpochMs(item.updatedAt ?? item.updated_at) ?? Date.now(),
    };
  }
}
