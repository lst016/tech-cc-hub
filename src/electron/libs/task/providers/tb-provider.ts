import { execFile } from "child_process";
import { promisify } from "util";
import { getGlobalRuntimeEnvConfig } from "../../claude-settings.js";
import { loadTaskSettings } from "../settings.js";
import type { ExternalTask, ExternalTaskStatus, TaskProvider, TaskProviderCapability } from "../types.js";

const execFileAsync = promisify(execFile);

type TbTaskItem = {
  id?: string;
  externalId?: string;
  title?: string;
  summary?: string;
  description?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  dueDate?: number | string;
  createdAt?: number | string;
  updatedAt?: number | string;
  [key: string]: unknown;
};

export class TbTaskProvider implements TaskProvider {
  readonly id = "tb" as const;
  readonly name = "TB 任务";

  isEnabled(): boolean {
    const settings = loadTaskSettings();
    return Boolean(settings.tbCliCommand?.trim() && settings.tbFetchArgsTemplate?.trim());
  }

  getCapabilities() {
    const capabilities: TaskProviderCapability[] = ["fetch", "status-writeback", "comment-writeback", "delete", "cli-configurable"];
    return capabilities;
  }

  async fetchTasks(): Promise<ExternalTask[]> {
    const settings = loadTaskSettings();
    if (!settings.tbCliCommand?.trim() || !settings.tbFetchArgsTemplate?.trim()) return [];

    const { stdout } = await this.runCli(settings.tbCliCommand, settings.tbFetchArgsTemplate, {});
    return getItems(stdout).map((item) => this.mapToExternalTask(item)).filter((task) => Boolean(task.externalId));
  }

  async getTask(externalId: string): Promise<ExternalTask | null> {
    const tasks = await this.fetchTasks();
    return tasks.find((task) => task.externalId === externalId) ?? null;
  }

  async updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void> {
    const settings = loadTaskSettings();
    if (!settings.tbCliCommand?.trim() || !settings.tbUpdateArgsTemplate?.trim()) return;
    await this.runCli(settings.tbCliCommand, settings.tbUpdateArgsTemplate, {
      externalId,
      status,
    });
  }

  async appendTaskComment(externalId: string, text: string): Promise<void> {
    const settings = loadTaskSettings();
    if (!settings.tbCliCommand?.trim() || !settings.tbCommentArgsTemplate?.trim()) return;
    await this.runCli(settings.tbCliCommand, settings.tbCommentArgsTemplate, {
      externalId,
      text,
    });
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const settings = loadTaskSettings();
    if (!settings.tbCliCommand?.trim()) {
      return { valid: false, error: "TB CLI 命令未配置" };
    }
    if (!settings.tbFetchArgsTemplate?.trim()) {
      return { valid: false, error: "TB 拉取参数模板未配置" };
    }
    return { valid: true };
  }

  private async runCli(command: string, argsTemplate: string, values: Record<string, string>): Promise<{ stdout: string; stderr: string }> {
    const args = splitArgs(renderTemplate(argsTemplate, values));
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: 30000,
      env: { ...process.env, ...getGlobalRuntimeEnvConfig() },
    });
    return { stdout: String(stdout ?? ""), stderr: String(stderr ?? "") };
  }

  private mapToExternalTask(item: TbTaskItem): ExternalTask {
    const externalId = textValue(item.externalId) ?? textValue(item.id) ?? "";
    return {
      id: "",
      externalId,
      provider: "tb",
      title: textValue(item.title) ?? textValue(item.summary) ?? "未命名 TB 任务",
      description: textValue(item.description),
      status: mapStatus(item.status),
      assignee: textValue(item.assignee),
      priority: mapPriority(item.priority),
      dueDate: numberValue(item.dueDate),
      sourceData: item,
      createdAt: numberValue(item.createdAt) ?? Date.now(),
      updatedAt: numberValue(item.updatedAt) ?? Date.now(),
    };
  }
}

function getItems(stdout: string): TbTaskItem[] {
  const raw = stdout.trim();
  if (!raw) return [];
  const parsed = JSON.parse(raw) as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRecord) as TbTaskItem[];
  if (isRecord(parsed)) {
    if (Array.isArray(parsed.items)) return parsed.items.filter(isRecord) as TbTaskItem[];
    if (Array.isArray(parsed.tasks)) return parsed.tasks.filter(isRecord) as TbTaskItem[];
    if (isRecord(parsed.data)) return getItems(JSON.stringify(parsed.data));
  }
  return [];
}

function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (match, key: string) => values[key] ?? match);
}

function splitArgs(source: string): string[] {
  const args: string[] = [];
  let current = "";
  let quote: "'" | "\"" | null = null;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if ((char === "'" || char === "\"") && source[i - 1] !== "\\") {
      quote = quote === char ? null : quote ?? char;
      continue;
    }
    if (!quote && /\s/.test(char)) {
      if (current) {
        args.push(current);
        current = "";
      }
      continue;
    }
    current += char;
  }
  if (current) args.push(current);
  return args;
}

function mapStatus(status?: string): ExternalTaskStatus {
  switch (status) {
    case "done":
    case "completed":
      return "done";
    case "in_progress":
    case "executing":
      return "in_progress";
    case "cancelled":
      return "cancelled";
    default:
      return "pending";
  }
}

function mapPriority(priority?: string): ExternalTask["priority"] {
  switch (priority) {
    case "urgent":
      return "urgent";
    case "high":
      return "high";
    case "low":
      return "low";
    default:
      return "medium";
  }
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
