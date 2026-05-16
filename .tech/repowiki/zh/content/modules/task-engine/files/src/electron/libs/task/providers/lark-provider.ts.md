# src/electron/libs/task/providers/lark-provider.ts

> 模块：`task-engine` · 语言：`typescript` · 行数：348

## 文件职责

源码文件。依赖：../types.js、../../claude-settings.js、../../config-store.js、../../external-cli.js

## 关键符号

- `mapLarkStatus@39 - `
- `mapLarkPriority@54 - `
- `isRecord@79 - `
- `asText@83 - `
- `asNumber@87 - `
- `isTruthyCompletion@96 - `
- `toEpochMs@101 - `
- `getTaskActivityTime@107 - `
- `resolveLarkChannelConfig@111 - `
- `getNestedItems@123 - `
- `formatCliError@140 - `
- `LarkTaskProvider@156 - `
- `LARK_TASK_PAGE_SIZE@75 - `
- `RECENT_SYNC_WINDOW_DAYS@77 - `
- `RECENT_SYNC_WINDOW_MS@78 - `
- `parsed@91 - `

## 依赖输入

- `../types.js`
- `../../claude-settings.js`
- `../../config-store.js`
- `../../external-cli.js`

## 对外暴露

- `LarkTaskProvider`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { TaskProvider, ExternalTask, ExternalTaskStatus, TaskProviderCapability } from "../types.js";
import { getGlobalRuntimeEnvConfig } from "../../claude-settings.js";
import { loadGlobalRuntimeConfig } from "../../config-store.js";
import { runExternalCli } from "../../external-cli.js";

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
  const envConfig = getGlobalRuntimeEnvConfig();
  return {
    cliCommand: asText(lark.cliCommand) ?? asText(envConfig.LARK_CLI_COMMAND),
    cliProfile: asText(lark.cliProfile) ?? asText(envConfig.LARK_CLI_PROFILE),
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
      "飞书“我的任务”接口需要 user token，请运行: lark-cli auth
... (truncated)
```
