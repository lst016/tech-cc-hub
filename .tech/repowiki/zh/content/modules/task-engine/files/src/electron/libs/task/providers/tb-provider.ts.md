# src/electron/libs/task/providers/tb-provider.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：192

## 文件职责

源码文件。依赖：child_process、util、../../claude-settings.js、../settings.js、../types.js

## 关键符号

- `getItems@107 - `
- `renderTemplate@120 - `
- `splitArgs@124 - `
- `mapStatus@147 - `
- `mapPriority@162 - `
- `textValue@175 - `
- `numberValue@179 - `
- `isRecord@188 - `
- `TbTaskProvider@23 - `
- `execFileAsync@6 - `
- `settings@29 - `
- `settings@39 - `
- `tasks@47 - `
- `settings@52 - `
- `settings@61 - `
- `settings@70 - `

## 依赖输入

- `child_process`
- `util`
- `../../claude-settings.js`
- `../settings.js`
- `../types.js`

## 对外暴露

- `TbTaskProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    if (Array.isArr
... (truncated)
```
