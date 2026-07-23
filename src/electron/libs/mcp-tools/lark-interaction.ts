import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
  type PermissionResult,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

import { toPlainTextToolResult, toTextToolResult } from "./tool-result.js";

export const LARK_INTERACTION_MCP_SERVER_NAME = "tech-cc-hub-lark";
export const LARK_INTERACTION_MCP_TOOL_NAME = `mcp__${LARK_INTERACTION_MCP_SERVER_NAME}__ask_user_question`;

const QUESTION_OPTION_SCHEMA = z.object({
  label: z.string().trim().min(1).describe("Short answer label shown on the Feishu card button."),
  description: z.string().trim().min(1).optional().describe("Optional concise explanation of this choice."),
});

const QUESTION_SCHEMA = z.object({
  header: z.string().trim().min(1).optional().describe("Optional short category label."),
  question: z.string().trim().min(1).describe("The exact question the user needs to answer."),
  options: z.array(QUESTION_OPTION_SCHEMA).max(6).default([])
    .describe("Use 2-6 choices when the answer can be enumerated; leave empty for free-form input."),
  multiSelect: z.boolean().default(false).describe("Whether the user may choose multiple options."),
});

const ASK_USER_QUESTION_SCHEMA = {
  questions: z.array(QUESTION_SCHEMA).min(1).max(3)
    .describe("One to three blocking questions that must be answered before work can continue."),
};

type LarkInteractionMcpServerOptions = {
  signal: AbortSignal;
  requestQuestion: (input: Record<string, unknown>, signal: AbortSignal) => Promise<PermissionResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getLarkInteractionMcpServer(
  options: LarkInteractionMcpServerOptions,
): McpSdkServerConfigWithInstance {
  const askUserQuestionHandler = tool(
    "ask_user_question",
    [
      "Pause and ask the current Feishu user for information required to continue.",
      "Use this whenever work is blocked on a choice, confirmation, missing path, URL, name, or other user input.",
      "Do not ask the blocking question only in ordinary assistant text. This tool renders it as an interactive Feishu card and waits for the answer.",
    ].join("\n"),
    ASK_USER_QUESTION_SCHEMA,
    async (input) => {
      const decision = await options.requestQuestion(input, options.signal);
      if (decision.behavior === "deny") {
        return toPlainTextToolResult(decision.message || "The user cancelled the question.", true);
      }

      const answeredInput: Record<string, unknown> = decision.updatedInput ?? input;
      const answers = isRecord(answeredInput.answers) ? answeredInput.answers : answeredInput;
      return toTextToolResult({ status: "answered", answers });
    },
    { alwaysLoad: true },
  );

  return createSdkMcpServer({
    name: LARK_INTERACTION_MCP_SERVER_NAME,
    version: "1.0.0",
    tools: [askUserQuestionHandler],
    alwaysLoad: true,
  });
}
