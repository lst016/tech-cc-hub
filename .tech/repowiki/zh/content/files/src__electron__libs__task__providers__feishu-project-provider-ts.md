# src/electron/libs/task/providers/feishu-project-provider.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：231

## 文件职责

源码文件。依赖：../types.js、../../claude-settings.js、../../config-store.js、../../external-cli.js

## 关键符号

- `asText@21 - `
- `asNumber@25 - `
- `toEpochMs@34 - `
- `mapFeishuStatus@40 - `
- `mapFeishuPriority@58 - `
- `isRecord@75 - `
- `resolveFeishuProjectConfig@79 - `
- `getItems@93 - `
- `FeishuProjectTaskProvider@110 - `
- `parsed@29 - `
- `parsed@36 - `
- `rootConfig@81 - `
- `envConfig@82 - `
- `cliCommand@83 - `
- `workItemType@85 - `
- `projectKey@88 - `

## 依赖输入

- `../types.js`
- `../../claude-settings.js`
- `../../config-store.js`
- `../../external-cli.js`

## 对外暴露

- `FeishuProjectTaskProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { ExternalTask, ExternalTaskStatus, TaskProvider, TaskProviderCapability } from "../types.js";
import { getGlobalRuntimeEnvConfig } from "../../claude-settings.js";
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
    return { stdo
... (truncated)
```
