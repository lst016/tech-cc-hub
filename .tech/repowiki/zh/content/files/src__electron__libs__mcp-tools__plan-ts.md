# src/electron/libs/mcp-tools/plan.ts

> 模块：`mcp-tools` · 语言：`typescript` · 行数：58

## 文件职责

源码文件。运行信号：mcp tool: update_plan；依赖：@anthropic-ai/claude-agent-sdk、zod、./tool-result.js

## 运行信号

- `mcp tool: update_plan`

## 关键符号

- `planUpdatedResult@17 - mcp tool: update_plan`
- `getPlanMcpServer@31 - mcp tool: update_plan`
- `PLAN_TOOL_NAMES@8 - mcp tool: update_plan`
- `PLAN_MCP_SERVER_NAME@12 - mcp tool: update_plan`
- `PLAN_MCP_SERVER_VERSION@14 - mcp tool: update_plan`
- `PLAN_ITEM_SCHEMA@21 - mcp tool: update_plan`
- `UPDATE_PLAN_SCHEMA@26 - mcp tool: update_plan`
- `updatePlanHandler@36 - mcp tool: update_plan`
- `McpSdkServerConfigWithInstance@4 - mcp tool: update_plan`

## 依赖输入

- `@anthropic-ai/claude-agent-sdk`
- `zod`
- `./tool-result.js`

## 对外暴露

- `PLAN_TOOL_NAMES`
- `getPlanMcpServer`

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
import { toPlainTextToolResult } from "./tool-result.js";

export const PLAN_TOOL_NAMES = [
  "update_plan",
] as const;

const PLAN_MCP_SERVER_NAME = "tech-cc-hub-plan";
const PLAN_MCP_SERVER_VERSION = "1.0.0";

let planMcpServer: McpSdkServerConfigWithInstance | null = null;

function planUpdatedResult() {
  return toPlainTextToolResult("Plan updated");
}

const PLAN_ITEM_SCHEMA = z.object({
  step: z.string().trim().min(1).describe("Short step title."),
  status: z.enum(["pending", "in_progress", "completed"]).describe("One of: pending, in_progress, completed."),
});

const UPDATE_PLAN_SCHEMA = {
  explanation: z.string().optional().describe("Optional short explanation for why the plan changed."),
  plan: z.array(PLAN_ITEM_SCHEMA).describe("The list of steps."),
};

export function getPlanMcpServer(): McpSdkServerConfigWithInstance {
  if (planMcpServer) {
    return planMcpServer;
  }

  const updatePlanHandler = tool(
    "update_plan",
    [
      "Updates the task plan.",
      "Provide an optional explanation and a list of plan items, each with a step and status.",
      "At most one step can be in_progress at a time.",
    ].join("\n"),
    UPDATE_PLAN_SCHEMA,
    async () => planUpdatedResult(),
    { alwaysLoad: true },
  );

  planMcpServer = createSdkMcpServer({
    name: PLAN_MCP_SERVER_NAME,
    version: PLAN_MCP_SERVER_VERSION,
    tools: [updatePlanHandler],
    alwaysLoad: true,
  });

  return planMcpServer;
}

```
