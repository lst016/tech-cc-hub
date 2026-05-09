import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import {
  focusIdea,
  getIdeaStatus,
  openIdea,
  selectBestIdeaInstallation,
  waitForIdeaReady,
} from "../idea-launcher.js";

export const IDEA_TOOL_NAMES = [
  "idea_status",
  "idea_open",
  "idea_focus",
  "idea_wait_ready",
] as const;

const IDEA_TOOLS_SERVER_NAME = "tech-cc-hub-idea";
const IDEA_MCP_SERVER_VERSION = "1.0.0";

let ideaMcpServer: McpSdkServerConfigWithInstance | null = null;

function toTextToolResult(payload: unknown, isError = false): CallToolResult {
  return {
    isError,
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

const EDITION_SCHEMA = z.enum(["any", "ultimate", "community"]);

const IDEA_STATUS_SCHEMA = {
  edition: EDITION_SCHEMA.optional().describe("IDEA 版本偏好，默认 any。"),
};

const IDEA_OPEN_SCHEMA = {
  projectPath: z.string().optional().describe("要在 IntelliJ IDEA 中打开的项目目录。"),
  filePath: z.string().optional().describe("可选：要在 IntelliJ IDEA 中打开的文件路径。"),
  line: z.number().int().positive().optional().describe("可选：filePath 对应的 1 起始行号。"),
  column: z.number().int().positive().optional().describe("可选：filePath 对应的 1 起始列号。"),
  edition: EDITION_SCHEMA.optional().describe("IDEA 版本偏好，默认 any。"),
  allowLaunch: z.boolean().optional().describe("为 false 时只复用已运行 IDEA；如果本机没有运行 IDEA，则直接失败。"),
};

const IDEA_FOCUS_SCHEMA = {};

const IDEA_WAIT_READY_SCHEMA = {
  timeoutMs: z.number().int().positive().max(120000).optional().describe("最长等待时间，单位毫秒，默认 30000。"),
  intervalMs: z.number().int().positive().max(5000).optional().describe("轮询间隔，单位毫秒，默认 1000。"),
};

export function getIdeaMcpServer(): McpSdkServerConfigWithInstance {
  if (ideaMcpServer) {
    return ideaMcpServer;
  }

  const statusHandler = tool(
    "idea_status",
    "发现本机已安装的 IntelliJ IDEA 启动器和正在运行的 IDEA 进程。Java/Spring 本地运行验证前先用它确认是否可复用用户已有 IDE，避免重复启动 java -jar 或 bootRun。",
    IDEA_STATUS_SCHEMA,
    async (input) => {
      try {
        const status = await getIdeaStatus();
        const recommended = selectBestIdeaInstallation(status.installations, input.edition ?? "any");
        return toTextToolResult({
          action: "idea_status",
          success: true,
          platform: status.platform,
          runningCount: status.running.length,
          running: status.running,
          recommended,
          installationCount: status.installations.length,
          installations: status.installations,
        });
      } catch (error) {
        return toTextToolResult({
          action: "idea_status",
          success: false,
          error: error instanceof Error ? error.message : "检查 IntelliJ IDEA 失败。",
        }, true);
      }
    },
  );

  const openHandler = tool(
    "idea_open",
    "通过稳定的 JetBrains 启动器协议打开或复用 IntelliJ IDEA。支持 IDEA 2021-2026，优先使用 JetBrains Toolbox 脚本以适配热更新，再回退到最新安装的 idea64/idea 启动器。若 IDEA 已在运行，会把项目/文件打开请求交给已有 IDE，而不是让 Agent 另起 jar 测试进程。",
    IDEA_OPEN_SCHEMA,
    async (input) => {
      try {
        if (!input.projectPath && !input.filePath && input.allowLaunch === false) {
          const status = await getIdeaStatus();
          return toTextToolResult({
            action: "idea_open",
            success: status.running.length > 0,
            reusedExisting: status.running.length > 0,
            launched: false,
            runningBefore: status.running,
            launcher: status.recommended,
            note: status.running.length > 0
              ? "IDEA 已在运行。"
              : "IDEA 未运行，且 allowLaunch=false。",
          }, status.running.length === 0);
        }

        const result = await openIdea({
          projectPath: input.projectPath,
          filePath: input.filePath,
          line: input.line,
          column: input.column,
          edition: input.edition ?? "any",
          allowLaunch: input.allowLaunch ?? true,
        });

        return toTextToolResult(result, !result.success);
      } catch (error) {
        return toTextToolResult({
          action: "idea_open",
          success: false,
          error: error instanceof Error ? error.message : "打开 IntelliJ IDEA 失败。",
        }, true);
      }
    },
  );

  const focusHandler = tool(
    "idea_focus",
    "把已运行的 IntelliJ IDEA 窗口拉到前台，不启动新的 IDE 或 Java 进程。适用于 IDEA 是用户本地运行面，且需要用户看到或继续操作已有 IDE 的场景。",
    IDEA_FOCUS_SCHEMA,
    async () => {
      try {
        const result = await focusIdea();
        return toTextToolResult(result, !result.success);
      } catch (error) {
        return toTextToolResult({
          action: "idea_focus",
          success: false,
          error: error instanceof Error ? error.message : "聚焦 IntelliJ IDEA 失败。",
        }, true);
      }
    },
  );

  const waitReadyHandler = tool(
    "idea_wait_ready",
    "在启动或复用请求后等待 IntelliJ IDEA 进入运行状态。用于证明 IDE 运行面可用，同时不启动 jar、bootRun 或其他重复应用进程。",
    IDEA_WAIT_READY_SCHEMA,
    async (input) => {
      try {
        const result = await waitForIdeaReady({
          timeoutMs: input.timeoutMs,
          intervalMs: input.intervalMs,
        });
        return toTextToolResult(result, !result.success);
      } catch (error) {
        return toTextToolResult({
          action: "idea_wait_ready",
          success: false,
          error: error instanceof Error ? error.message : "等待 IntelliJ IDEA 就绪失败。",
        }, true);
      }
    },
  );

  ideaMcpServer = createSdkMcpServer({
    name: IDEA_TOOLS_SERVER_NAME,
    version: IDEA_MCP_SERVER_VERSION,
    tools: [statusHandler, openHandler, focusHandler, waitReadyHandler],
  });

  return ideaMcpServer;
}
