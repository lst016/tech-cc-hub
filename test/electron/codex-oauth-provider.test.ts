import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_MODELS,
  buildCodexResponsesRequest,
  extractCodexModelIdsFromCache,
  mergeCodexModelIds,
  buildSyntheticAnthropicStream,
  parseCodexResponsesStream,
  parseCodexOAuthCredential,
  toAnthropicMessageResponse,
} from "../../src/electron/libs/codex-oauth.js";
import {
  createCodexOAuthProfile,
  normalizeProfile,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  isModelCompatibleWithApiProvider,
  pickProviderCompatibleModel,
} from "../../src/shared/model-provider-routing.js";

test("codex oauth profile preserves the official endpoint and built-in model list", () => {
  const profile = createCodexOAuthProfile();
  const normalized = normalizeProfile({
    ...profile,
    apiKey: JSON.stringify({ access_token: "access-token", account_id: "account-id" }),
    baseURL: "",
  });

  assert.equal(normalized.provider, "codex");
  assert.equal(normalized.baseURL, CODEX_OAUTH_BASE_URL);
  assert.equal(normalized.model, "gpt-5.5");
  assert.ok(CODEX_OAUTH_MODELS.includes("gpt-5.5"));
  assert.ok(CODEX_OAUTH_MODELS.includes("gpt-5.3-codex-spark"));
  assert.ok(normalized.models?.some((model) => model.name === "gpt-5.3-codex-spark"));
});

test("codex provider does not accept deepseek models from a merged model pool", () => {
  assert.equal(isModelCompatibleWithApiProvider("codex", "gpt-5.5"), true);
  assert.equal(isModelCompatibleWithApiProvider("codex", "gpt-5.3-codex-spark"), true);
  assert.equal(isModelCompatibleWithApiProvider("codex", "deepseek-v4-flash"), false);
  assert.equal(
    pickProviderCompatibleModel("codex", "deepseek-v4-flash", "gpt-5.5"),
    "gpt-5.5",
  );
});

test("codex model cache is merged with built-in fallback models", () => {
  const cachedModels = extractCodexModelIdsFromCache({
    models: [
      { slug: "gpt-5.5", visibility: "list" },
      { slug: "gpt-5.4-mini", visibility: "list" },
      { slug: "codex-auto-review", visibility: "hide" },
    ],
  });

  assert.deepEqual(cachedModels, ["gpt-5.5", "gpt-5.4-mini"]);

  const mergedModels = mergeCodexModelIds([...cachedModels, "gpt-5.4-mini-openai-compact"]);
  assert.ok(mergedModels.includes("gpt-5.5"));
  assert.ok(mergedModels.includes("gpt-5.5-openai-compact"));
  assert.ok(mergedModels.includes("gpt-5.3-codex-spark"));
  assert.ok(!mergedModels.some((model) => model.endsWith("-openai-compact-openai-compact")));
  assert.ok(!mergedModels.includes("codex-auto-review"));
});

test("codex oauth credential requires access token and account id JSON", () => {
  assert.deepEqual(parseCodexOAuthCredential(JSON.stringify({
    access_token: " access-token ",
    refresh_token: "refresh-token",
    account_id: " account-id ",
    email: "user@example.com",
    type: "codex",
  })), {
    accessToken: "access-token",
    refreshToken: "refresh-token",
    accountId: "account-id",
    email: "user@example.com",
    type: "codex",
  });

  assert.throws(
    () => parseCodexOAuthCredential("sk-not-json"),
    /Codex OAuth 凭据必须是 JSON 对象/,
  );
  assert.throws(
    () => parseCodexOAuthCredential(JSON.stringify({ access_token: "access-token" })),
    /account_id/,
  );
});

test("anthropic messages are converted to codex responses requests", () => {
  const request = buildCodexResponsesRequest({
    model: "gpt-5.4",
    max_tokens: 64,
    system: "Follow project rules.",
    messages: [
      { role: "user", content: "ping" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "calling tool" },
          { type: "tool_use", id: "toolu_1", name: "Read", input: { file_path: "README.md" } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_1", content: "file body" },
        ],
      },
    ],
    tools: [
      {
        name: "Read",
        description: "Read a file",
        input_schema: {
          type: "object",
          properties: { file_path: { type: "string" } },
          required: ["file_path"],
        },
      },
    ],
  });

  assert.equal(request.model, "gpt-5.4");
  assert.equal("max_output_tokens" in request, false);
  assert.equal(request.instructions, "Follow project rules.");
  assert.equal(request.store, false);
  assert.equal(request.input[0]?.role, "user");
  const functionCall = request.input.find((item) => item.type === "function_call");
  const functionOutput = request.input.find((item) => item.type === "function_call_output");
  assert.equal(functionCall?.call_id, "toolu_1");
  assert.equal(functionOutput?.call_id, "toolu_1");
  assert.equal(request.tools?.[0]?.type, "function");
  assert.equal(request.tools?.[0]?.name, "Read");
});

test("codex responses are translated back to anthropic message and stream shapes", () => {
  const response = toAnthropicMessageResponse({
    id: "resp_123",
    model: "gpt-5.4",
    output: [
      {
        type: "message",
        content: [
          { type: "output_text", text: "hello" },
        ],
      },
      {
        type: "function_call",
        call_id: "call_1",
        name: "Bash",
        arguments: "{\"command\":\"npm test\"}",
      },
    ],
    usage: {
      input_tokens: 10,
      output_tokens: 4,
    },
  }, "gpt-5.4");

  assert.equal(response.type, "message");
  assert.equal(response.stop_reason, "tool_use");
  assert.deepEqual(response.content, [
    { type: "text", text: "hello" },
    { type: "tool_use", id: "call_1", name: "Bash", input: { command: "npm test" } },
  ]);

  const stream = buildSyntheticAnthropicStream(response);
  assert.match(stream, /event: message_start/);
  assert.match(stream, /event: content_block_delta/);
  assert.match(stream, /event: message_stop/);
});

test("codex streaming responses are folded into anthropic-compatible output", () => {
  const response = parseCodexResponsesStream([
    "event: response.created",
    "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp_1\",\"status\":\"in_progress\",\"model\":\"gpt-5.4\",\"output\":[]}}",
    "",
    "event: response.output_item.done",
    "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"message\",\"content\":[{\"type\":\"output_text\",\"text\":\"pong\"}]}}",
    "",
    "event: response.completed",
    "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp_1\",\"status\":\"completed\",\"model\":\"gpt-5.4\",\"output\":[],\"usage\":{\"input_tokens\":7,\"output_tokens\":5}}}",
    "",
  ].join("\n"));

  const message = toAnthropicMessageResponse(response, "gpt-5.4");

  assert.equal(message.model, "gpt-5.4");
  assert.deepEqual(message.content, [{ type: "text", text: "pong" }]);
  assert.equal(message.usage.input_tokens, 7);
  assert.equal(message.usage.output_tokens, 5);
});

test("codex settings use agent-guided setup instead of exposing oauth secrets", () => {
  const source = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");

  assert.match(source, /Agent 引导配置/);
  assert.doesNotMatch(source, /OAuth 凭据/);
  assert.doesNotMatch(source, /Codex 授权/);
});

test("codex setup imports official codex login instead of composing oauth urls", () => {
  const source = readFileSync("scripts/codex-oauth-setup.mjs", "utf8");

  assert.match(source, /auth\.json/);
  assert.match(source, /codex login/);
  assert.match(source, /gpt-5\.5/);
  assert.doesNotMatch(source, /auth\.openai\.com\/oauth\/authorize/);
  assert.doesNotMatch(source, /localhost:1455\/auth\/callback/);
});
