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

  return createSdkMcpServer({
    name: PLAN_MCP_SERVER_NAME,
    version: PLAN_MCP_SERVER_VERSION,
    tools: [updatePlanHandler],
    alwaysLoad: true,
  });

}
