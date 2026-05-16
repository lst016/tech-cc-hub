# src/electron/libs/mcp-tools/cron.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：222

## 文件职责

定时任务管理工具：让 Agent 创建/列出/删除定时任务

## 运行信号

- `mcp tool: create_scheduled_task`
- `mcp tool: list_scheduled_tasks`
- `mcp tool: delete_scheduled_task`

## 关键符号

- `CRON_TOOL_NAMES@0 - 定时任务工具名（create/list/delete_scheduled_task）`
- `setCronService@0 - 注入 CronService 实例（main 进程初始化时调用）`
- `buildScheduleFromInput@0 - 根据 scheduleKind（cron/every/at）构建 CronSchedule 对象`
- `getCronMcpServer@0 - 获取定时任务 MCP 服务器`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `zod`
- `../cron-service.js`
- `../cron-types.js`
- `./tool-result.js`

## 对外暴露

- `CRON_TOOL_NAMES`
- `setCronService`
- `getCronMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
// 定时任务 MCP 工具：让 Agent 可以创建/管理定时任务。
// 需要从 main.ts 注入 CronService 实例后才能使用。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import type { CronService } from "../cron-service.js";
import type { CreateCronJobParams, CronSchedule } from "../cron-types.js";
import { toTextToolResult } from "./tool-result.js";

export const CRON_TOOL_NAMES = [
  "create_scheduled_task",
  "list_scheduled_tasks",
  "delete_scheduled_task",
] as const;

const CRON_TOOLS_SERVER_NAME = "tech-cc-hub-cron";
const CRON_MCP_SERVER_VERSION = "1.0.0";

let cronServiceRef: CronService | null = null;
let cronMcpServer: McpSdkServerConfigWithInstance | null = null;

export function setCronService(service: CronService): void {
  cronServiceRef = service;
}

function buildScheduleFromInput(input: {
  scheduleKind: "cron" | "every" | "at";
  cronExpression?: string;
  timezone?: string;
  everySeconds?: number;
  atTimestamp?: string;
  scheduleDescription?: string;
}): CronSchedule {
  const kind = input.scheduleKind;
  const desc = input.scheduleDescription?.trim() || "";

  switch (kind) {
    case "cron": {
      const expr = input.cronExpression?.trim() || "";
      if (!expr) throw new Error("cron 模式必须提供 cronExpression");
      return {
        kind: "cron",
        expr,
        tz: input.timezone?.trim() || "Asia/Shanghai",
        description: desc || `cron: ${expr}`,
      };
    }
    case "every": {
      const seconds = input.everySeconds;
      if (!seconds || seconds < 60) throw new Error("every 模式仅支持 >= 60 秒的间隔");
      const ms = seconds * 1000;
      const minutes = Math.round(seconds / 60);
      return {
        kind: "every",
        everyMs: ms,
        description: desc || `每 ${minutes} 分钟`,
      };
    }
    case "at": {
      const raw = input.atTimestamp?.trim();
      if (!raw) throw new Error("at 模式必须提供 atTimestamp (ISO 8601)");
      const atMs = new Date(raw).getTime();
      if (!Number.isFinite(atMs)) throw new Error(`atTimestamp 无效: ${raw}`);
      const inMinutes = Math.max(0, Math.round((atMs - Date.now()) / 60000));
      return {
        kind: "at",
        atMs,
        description: desc || `${inMinutes} 分钟后`,
      };
    }
    default:
      throw new Error(`不支持的 scheduleKind: ${kind}`);
  }
}

const CREATE_SCHEMA = {
  name: z.string().min(1).max(200).describe("任务名称"),
  scheduleKind: z.enum(["cron", "every", "at"]).describe("调度类型：cron / every / at"),
  cronExpression: z.string().optional().describe("cron 模式下的 5 字段 cron 表达式（例：0 9 * * *）"),
  timezone: z.string().optional().describe("cron 模式的时区（默认 Asia/Shanghai）"),
  everySeconds: z.number().min(60).optional().describe("every 模式下的间隔秒数（>=60）"),
  atTimestamp: z.string().optional().describe("at 模式下的一次性执行时间（ISO 8601）"),
  scheduleDescription: z.string().optional().describe("调度描述，不填自动生成"),
  message: z.string().min(1).describe("发送给会话的提示消息"),
  conversationId: z.string().optional().describe("目标会话 ID，默认 __system__"),
  executionMode: z.enum(["existing", "new_conversation"]).optional().describe("执行模式，默认 new_conversation"),
};

const DELETE_SCHEMA = {
  jobId: z.string().min(1).describe("要删除的任务 ID"),
};

export function getCronMcpServer(): McpSdkServerConfigWithInstance {
  if (cronMcpServer) {
    return cronMcpServer;
  }

  const createHandler = tool(
    "create_scheduled_task",
    "创建持久化定时任务。支持三种调度类型：cron（标准 cron 表达式，支持时区）、every（每隔 N 秒循环执行，最小 60s）、at（一次性定时触发）。任务数据持久化到 SQLite 数据库，支持执行历史记录、自动重试（会话忙时最多 3 次，间隔 30s）、执行状态追踪。每次执行可通过 new_conversation 创建新会话或 existing 追加到已有会话。默认写入系统工作区（__system__），默认每次执行创建新会话。",
    CREATE_SCHEMA,
    async (input) => {
      try {
        if (!cronServiceRef) {
          return toTextToolResult({ success: false, error: "CronService 未初始化" }, true);
        }

        const schedule = buildScheduleFromInput(input);

        const params: CreateCronJobParams = {
          name: input.name,
          schedule,
          message: input.message,
          conversationId: input.conversationId || "__system__",
          conversationTitle: input.name,
          agentType: "default",
          createdBy: "agent",
          executionMode: input.executionMode || "n
... (truncated)
```
