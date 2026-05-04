import { execFile } from "child_process";
import { promisify } from "util";
import type { TaskProvider, ExternalTask, ExternalTaskStatus } from "../task-types.js";

const execFileAsync = promisify(execFile);

type LarkTaskItem = {
  id: string;
  title: string;
  description?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  due_date?: number;
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

export class LarkTaskProvider implements TaskProvider {
  readonly id = "lark" as const;
  readonly name = "飞书任务";
  private config: LarkProviderConfig;

  constructor(config?: LarkProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async fetchTasks(): Promise<ExternalTask[]> {
    try {
      const args = ["task", "list", "--format", "json"];
      if (this.config.cliProfile) {
        args.push("--profile", this.config.cliProfile);
      }

      const { stdout } = await execFileAsync(this.config.cliCommand!, args, {
        timeout: 30000,
        env: process.env,
      });

      const raw = stdout.trim();
      let items: LarkTaskItem[];
      try {
        const parsed = JSON.parse(raw);
        items = Array.isArray(parsed) ? parsed : parsed.data ?? parsed.items ?? [];
      } catch (parseError) {
        console.warn("[task-provider:lark] JSON parse failed, stdout:", raw.slice(0, 200));
        throw parseError;
      }

      return items.map((item) => this.mapToExternalTask(item));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn("[task-provider:lark] Failed to fetch tasks:", message);
      return [];
    }
  }

  async getTask(externalId: string): Promise<ExternalTask | null> {
    try {
      const args = ["task", "get", externalId, "--format", "json"];
      if (this.config.cliProfile) {
        args.push("--profile", this.config.cliProfile);
      }

      const { stdout } = await execFileAsync(this.config.cliCommand!, args, {
        timeout: 15000,
        env: process.env,
      });

      const item: LarkTaskItem = JSON.parse(stdout.trim());
      return this.mapToExternalTask(item);
    } catch {
      return null;
    }
  }

  async updateTaskStatus(externalId: string, status: ExternalTaskStatus): Promise<void> {
    const larkStatus = status === "done" ? "done" : status === "in_progress" ? "in_progress" : "pending";

    const args = ["task", "update", externalId, "--status", larkStatus];
    if (this.config.cliProfile) {
      args.push("--profile", this.config.cliProfile);
    }

    await execFileAsync(this.config.cliCommand!, args, {
      timeout: 15000,
      env: process.env,
    });
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const args = ["--version"];
      await execFileAsync(this.config.cliCommand!, args, {
        timeout: 10000,
        env: process.env,
      });
      return { valid: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { valid: false, error: `lark-cli 不可用: ${message}` };
    }
  }

  private mapToExternalTask(item: LarkTaskItem): ExternalTask {
    return {
      id: "", // filled by repository
      externalId: item.id,
      provider: "lark",
      title: item.title || "未命名任务",
      description: item.description,
      status: mapLarkStatus(item.status),
      assignee: item.assignee,
      priority: mapLarkPriority(item.priority),
      dueDate: item.due_date,
      sourceData: item,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
