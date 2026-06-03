// 定时任务 MCP 工具：让 Agent 可以创建/管理定时任务。
// 需要从 main.ts 注入 CronService 实例后才能使用。
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import type { CronService } from "../cron/cron-service.js";
import type { CreateCronJobParams, CronSchedule } from "../cron/cron-types.js";
import { toTextToolResult } from "./tool-result.js";

export const CRON_TOOL_NAMES = [
  "create_scheduled_task",
  "list_scheduled_tasks",
  "update_scheduled_task",
  "delete_scheduled_task",
] as const;

// C-2: 会话存在性 resolver 注入点。main.ts wire-up 时调用
//   setCronSessionValidator((id) => sessionStore.exists(id))
// 校验非 __system__ 的 conversationId；未注入时使用格式校验 + warn。
type SessionValidator = (conversationId: string) => boolean;
let sessionValidatorRef: SessionValidator | null = null;
export function setCronSessionValidator(fn: SessionValidator): void {
  sessionValidatorRef = fn;
}

// C-2: 解析 conversationId 合法性。优先用 validator，不可用时退回格式校验。
//  返回 { resolved, fallback, reason }：fallback=true 表示回退到 __system__。
function resolveConversationId(input: string | undefined): {
  resolved: string;
  fallback: boolean;
  reason?: string;
} {
  const raw = input?.trim();
  if (!raw || raw === "__system__") return { resolved: "__system__", fallback: false };
  if (sessionValidatorRef) {
    if (sessionValidatorRef(raw)) return { resolved: raw, fallback: false };
    return {
      resolved: "__system__",
      fallback: true,
      reason: `会话 ${raw} 不存在，回退到 __system__`,
    };
  }
  // fallback: 简单格式校验（拒绝包含 SQL 注入字符或换行）
  if (raw.length > 256 || /[\r\n;'"`]/.test(raw)) {
    return {
      resolved: "__system__",
      fallback: true,
      reason: `会话 ID 包含非法字符或过长，回退到 __system__`,
    };
  }
  return { resolved: raw, fallback: false };
}

const CRON_TOOLS_SERVER_NAME = "tech-cc-hub-cron";
const CRON_MCP_SERVER_VERSION = "1.0.0";

let cronServiceRef: CronService | null = null;

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
  jitterMs?: number;
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
        jitterMs: input.jitterMs ?? 0,
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
        jitterMs: input.jitterMs ?? 0,
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
  executionMode: z.enum(["existing", "new_conversation"]).optional().describe("执行模式，默认 existing"),
  templateConversationId: z.string().optional().describe("new_conversation 模式下用于派生新会话的模板会话 ID"),
  jitterMs: z.number().int().min(0).max(60000).optional().describe("触发抖动毫秒（0-60000），加在 cron / every 模式上"),
  misfirePolicy: z.enum(["fire-once", "catchup", "skip"]).optional().describe("错过触发策略，默认 fire-once"),
};

const UPDATE_SCHEMA = {
  jobId: z.string().min(1).describe("要更新的任务 ID"),
  enabled: z.boolean().optional().describe("是否启用"),
  executionMode: z.enum(["existing", "new_conversation"]).optional().describe("执行模式"),
  message: z.string().min(1).optional().describe("新的提示消息"),
  schedule: z.object({
    scheduleKind: z.enum(["cron", "every", "at"]),
    cronExpression: z.string().optional(),
    timezone: z.string().optional(),
    everySeconds: z.number().min(60).optional(),
    atTimestamp: z.string().optional(),
    scheduleDescription: z.string().optional(),
  }).optional().describe("新调度（覆盖式）"),
  jitterMs: z.number().int().min(0).max(60000).optional().describe("触发抖动毫秒（0-60000）"),
  misfirePolicy: z.enum(["fire-once", "catchup", "skip"]).optional().describe("错过触发策略"),
};

const DELETE_SCHEMA = {
  jobId: z.string().min(1).describe("要删除的任务 ID"),
};

export function getCronMcpServer(): McpSdkServerConfigWithInstance {
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

        // C-2: 解析 conversationId；不存在则 fallback + warn
        const conv = resolveConversationId(input.conversationId);
        if (conv.fallback) {
          console.warn(`[MCP cron] ${conv.reason}（job=${input.name}）`);
        }

        const params: CreateCronJobParams = {
          name: input.name,
          schedule,
          message: input.message,
          conversationId: conv.resolved,
          conversationTitle: input.name,
          agentType: "default",
          createdBy: "agent",
          executionMode: input.executionMode || "existing",
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

  const updateHandler = tool(
    "update_scheduled_task",
    "更新一个已存在的定时任务。仅 Agent 自己创建的任务可更新（createdBy='agent'），用户创建的任务请在 UI 中操作。支持修改 enabled、executionMode、message、schedule、jitterMs、misfirePolicy 等字段。",
    UPDATE_SCHEMA,
    async (input) => {
      try {
        if (!cronServiceRef) {
          return toTextToolResult({ success: false, error: "CronService 未初始化" }, true);
        }

        const job = await cronServiceRef.getJob(input.jobId);
        if (!job) {
          return toTextToolResult({ success: false, error: `任务不存在: ${input.jobId}` }, true);
        }

        // 安全边界：Agent 只能 update 自己 createdBy='agent' 的任务
        if (job.metadata.createdBy !== "agent") {
          return toTextToolResult({
            success: false,
            error: `任务 "${job.name}" 由用户创建，Agent 无权修改。请在 UI 中手动操作。`,
          }, true);
        }

        const updates: Partial<typeof job> = {};
        if (typeof input.enabled === "boolean") updates.enabled = input.enabled;
        if (input.executionMode) {
          updates.target = { ...job.target, executionMode: input.executionMode };
        }
        if (input.message) {
          updates.target = {
            ...(updates.target ?? job.target),
            payload: { kind: "message", text: input.message },
          };
        }
        if (input.schedule) {
          updates.schedule = buildScheduleFromInput(input.schedule);
        }
        if (typeof input.jitterMs === "number" && (job.schedule.kind === "cron" || job.schedule.kind === "every")) {
          updates.schedule = { ...job.schedule, jitterMs: input.jitterMs } as typeof job.schedule;
        }
        if (input.misfirePolicy) {
          updates.state = { ...job.state, misfirePolicy: input.misfirePolicy };
        }

        if (Object.keys(updates).length === 0) {
          return toTextToolResult({ success: false, error: "未提供任何可更新字段" }, true);
        }

        const updated = await cronServiceRef.updateJob(input.jobId, updates);
        return toTextToolResult({
          success: true,
          job: {
            id: updated.id,
            name: updated.name,
            enabled: updated.enabled,
            schedule: updated.schedule,
            executionMode: updated.target.executionMode,
            message: updated.target.payload.text,
            nextRunAtMs: updated.state.nextRunAtMs,
          },
        });
      } catch (error) {
        return toTextToolResult({
          success: false,
          error: error instanceof Error ? error.message : "更新定时任务失败",
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

  return createSdkMcpServer({
    name: CRON_TOOLS_SERVER_NAME,
    version: CRON_MCP_SERVER_VERSION,
    tools: [createHandler, listHandler, updateHandler, deleteHandler],
  });

}
