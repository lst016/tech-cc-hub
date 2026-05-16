# src/electron/libs/mcp-tools/idea.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：172

## 文件职责

IntelliJ IDEA 启动器集成：发现/打开/聚焦 IDEA，检查运行状态

## 运行信号

- `mcp tool: idea_status`
- `mcp tool: idea_open`
- `mcp tool: idea_focus`
- `mcp tool: idea_wait_ready`

## 关键符号

- `IDEA_TOOL_NAMES@0 - IDEA 工具名（idea_status/open/focus/wait_ready）`
- `getIdeaMcpServer@0 - 获取 IDEA MCP 服务器，注册所有工具`
- `statusHandler@0 - 发现本机已安装的 IDEA 和正在运行的进程`
- `openHandler@0 - 通过 JetBrains 启动器协议打开/复用 IDEA`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `zod`
- `../idea-launcher.js`
- `./tool-result.js`

## 对外暴露

- `IDEA_TOOL_NAMES`
- `getIdeaMcpServer`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import {
  focusIdea,
  getIdeaStatus,
  openIdea,
  selectBestIdeaInstallation,
  waitForIdeaReady,
} from "../idea-launcher.js";
import { toTextToolResult } from "./tool-result.js";

export const IDEA_TOOL_NAMES = [
  "idea_status",
  "idea_open",
  "idea_focus",
  "idea_wait_ready",
] as const;

const IDEA_TOOLS_SERVER_NAME = "tech-cc-hub-idea";
const IDEA_MCP_SERVER_VERSION = "1.0.0";

let ideaMcpServer: McpSdkServerConfigWithInstance | null = null;

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
    "把已运行的 IntelliJ IDEA 窗口拉到前台，不启动新的 IDE 或 Java 进程。适用于 IDEA 是用户本地运行
... (truncated)
```
