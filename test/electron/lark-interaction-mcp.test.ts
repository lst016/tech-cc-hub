import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  getLarkInteractionMcpServer,
  LARK_INTERACTION_MCP_SERVER_NAME,
  LARK_INTERACTION_MCP_TOOL_NAME,
} from "../../src/electron/libs/mcp-tools/lark-interaction.js";

type Handler = (
  input: Record<string, unknown>,
  extra: unknown,
) => Promise<{ isError?: boolean; content: Array<{ type: string; text: string }> }>;

function getAskHandler(options: Parameters<typeof getLarkInteractionMcpServer>[0]): Handler {
  const server = getLarkInteractionMcpServer(options);
  const instance = server.instance as unknown as {
    _registeredTools?: Record<string, { handler: Handler }>;
  };
  const handler = instance._registeredTools?.ask_user_question?.handler;
  if (!handler) throw new Error("Lark ask_user_question MCP handler is not registered");
  return handler;
}

test("Lark question MCP blocks on the host decision and returns the Feishu answer", async () => {
  const abortController = new AbortController();
  const requests: Record<string, unknown>[] = [];
  const handler = getAskHandler({
    signal: abortController.signal,
    requestQuestion: async (input, signal) => {
      requests.push(input);
      assert.equal(signal, abortController.signal);
      return {
        behavior: "allow",
        updatedInput: {
          ...input,
          answers: { "项目在哪里？": "D:\\workspace\\ligu\\ligu-manage" },
        },
      };
    },
  });

  const input = {
    questions: [{ question: "项目在哪里？", options: [], multiSelect: false }],
  };
  const result = await handler(input, {});

  assert.deepEqual(requests, [input]);
  assert.equal(result.isError, false);
  assert.match(result.content[0]?.text ?? "", /D:\\\\workspace\\\\ligu\\\\ligu-manage/);
});

test("Lark question MCP reports cancellation as a tool error", async () => {
  const handler = getAskHandler({
    signal: new AbortController().signal,
    requestQuestion: async () => ({ behavior: "deny", message: "用户取消了问题" }),
  });

  const result = await handler({ questions: [{ question: "继续吗？" }] }, {});

  assert.equal(result.isError, true);
  assert.match(result.content[0]?.text ?? "", /用户取消了问题/);
});

test("runner injects the blocking question bridge only for Lark channel sessions", () => {
  const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const promptSource = readFileSync("src/electron/libs/channel/channel-agent-prompt.ts", "utf8");

  assert.equal(LARK_INTERACTION_MCP_SERVER_NAME, "tech-cc-hub-lark");
  assert.equal(LARK_INTERACTION_MCP_TOOL_NAME, "mcp__tech-cc-hub-lark__ask_user_question");
  assert.match(runnerSource, /promptOrigin\.kind === "channel" && promptOrigin\.server\.toLowerCase\(\) === "lark"/);
  assert.match(runnerSource, /requestPermissionDecision\(\s*"AskUserQuestion",\s*input,\s*signal/);
  assert.match(runnerSource, /\.\.\.buildLarkInteractionMcpServers\(\)/);
  assert.match(promptSource, /必须调用 mcp__tech-cc-hub-lark__ask_user_question/);
  assert.match(promptSource, /不要只在普通回复文本中提问后结束/);
});
