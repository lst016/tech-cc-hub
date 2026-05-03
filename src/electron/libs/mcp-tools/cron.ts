// 定时任务 MCP 工具：让 Agent 可以创建/管理定时任务。
// 需要从 main.ts 注入 CronService 实例后才能使用。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { CronService } from "../cron-service.js";
import type { CreateCronJobParams, CronSchedule } from "../cron-types.js";

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

function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
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
    "创建定时任务。支持三种调度类型：cron（标准 cron 表达式）、every（每隔 N 秒执行）、at（一次性定时触发）。默认写入系统工作区（__system__），每次执行创建新会话发消息。",
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
          executionMode: input.executionMode || "new_conversation",
        };

        const job = await cronServiceRef.addJob(params);

        return toTextToolResult({
          success: true,
          job: {
            id: job.id,
            name: job.name,
            schedule: job.schedule,
            message: job.target.payload.text,
            nextRunAtMs: job.state.nextRunAtMs,
            enabled: job.enabled,
          },
        });
      } catch (error) {
        return toTextToolResult({
          success: false,
          error: error instanceof Error ? error.message : "创建定时任务失败",
        }, true);
      }
    },
  );

  const listHandler = tool(
    "list_scheduled_tasks",
    "列出所有已创建的定时任务，包括启用和禁用的。返回任务 ID、名称、调度、下次执行时间和状态。",
    {},
    async () => {
      try {
        if (!cronServiceRef) {
          return toTextToolResult({ success: false, error: "CronService 未初始化" }, true);
        }

        const jobs = await cronServiceRef.listJobs();
        const summary = jobs.map((j) => ({
          id: j.id,
          name: j.name,
          enabled: j.enabled,
          schedule: j.schedule,
          nextRunAtMs: j.state.nextRunAtMs,
          lastRunAtMs: j.state.lastRunAtMs,
          lastStatus: j.state.lastStatus,
          runCount: j.state.runCount,
        }));

        return toTextToolResult({ success: true, count: summary.length, jobs: summary });
      } catch (error) {
        return toTextToolResult({
          success: false,
          error: error instanceof Error ? error.message : "列出定时任务失败",
        }, true);
      }
    },
  );

  const deleteHandler = tool(
    "delete_scheduled_task",
    "根据任务 ID 删除一个定时任务。仅 Agent 创建的任务可删除，用户创建的任务应提示手动操作。",
    DELETE_SCHEMA,
    async (input) => {
      try {
        if (!cronServiceRef) {
          return toTextToolResult({ success: false, error: "CronService 未初始化" }, true);
        }

        const job = await cronServiceRef.getJob(input.jobId);
        if (!job) {
          return toTextToolResult({ success: false, error: `任务不存在: ${input.jobId}` }, true);
        }

        // 安全边界：Agent 只能删除自己创建的任务
        if (job.metadata.createdBy !== "agent") {
          return toTextToolResult({
            success: false,
            error: `任务 "${job.name}" 由用户创建，Agent 无权删除。请在 UI 中手动操作。`,
          }, true);
        }

        await cronServiceRef.removeJob(input.jobId);

        return toTextToolResult({ success: true, deletedJobId: input.jobId });
      } catch (error) {
        return toTextToolResult({
          success: false,
          error: error instanceof Error ? error.message : "删除定时任务失败",
        }, true);
      }
    },
  );

  cronMcpServer = createSdkMcpServer({
    name: CRON_TOOLS_SERVER_NAME,
    version: CRON_MCP_SERVER_VERSION,
    tools: [createHandler, listHandler, deleteHandler],
  });

  return cronMcpServer;
}
