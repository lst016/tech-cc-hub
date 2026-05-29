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
  parseCodexCliAuthCredential,
  parseCodexOAuthCredential,
  toAnthropicMessageResponse,
} from "../../src/electron/libs/codex/codex-oauth.js";
import {
  createCodexOAuthProfile,
  normalizeProfile,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  isModelCompatibleWithApiProvider,
  normalizeProviderModelName,
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

test("custom gateway model names preserve provider casing before routing", () => {
  assert.equal(
    normalizeProviderModelName("custom", "DeepSeek-V4-Pro"),
    "DeepSeek-V4-Pro",
  );
  assert.equal(
    normalizeProviderModelName("deepseek", "DeepSeek-V4-Pro"),
    "deepseek-v4-pro",
  );
  assert.equal(
    normalizeProviderModelName("codex", "gpt-5.5"),
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

test("codex oauth can import official Codex CLI auth credentials", () => {
  const accessToken = buildJwt({
    exp: 1_800_000_000,
    "https://api.openai.com/auth": {
      chatgpt_account_id: "account-from-jwt",
    },
    "https://api.openai.com/profile": {
      email: "user@example.com",
    },
  });

  assert.deepEqual(parseCodexCliAuthCredential(JSON.stringify({
    tokens: {
      access_token: accessToken,
      refresh_token: "refresh-token",
    },
    last_refresh: "2026-05-18T00:00:00.000Z",
  })), {
    accessToken,
    refreshToken: "refresh-token",
    accountId: "account-from-jwt",
    email: "user@example.com",
    type: "codex",
    expired: "2027-01-15T08:00:00.000Z",
    lastRefresh: "2026-05-18T00:00:00.000Z",
  });
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

test("codex responses tool schemas and function call arguments are normalized", () => {
  const request = buildCodexResponsesRequest({
    model: "gpt-5.5",
    system: "Follow project rules.",
    messages: [{ role: "user", content: "read the file" }],
    tools: [
      {
        name: "Read",
        description: "Read a file",
        input_schema: {
          type: "object",
          properties: {
            file_path: { type: "string" },
            pages: { type: "string" },
          },
          required: ["file_path"],
        },
      },
      {
        name: "mcp__tech-cc-hub-figma__figma_export_node_images",
        description: "Export Figma images",
        input_schema: {
          type: "object",
          properties: {
            fileKeyOrUrl: { type: "string" },
            maxBytes: { type: "number" },
          },
        },
      },
      {
        name: "mcp__tech-cc-hub-design__design_compare_current_view",
        description: "Compare current view",
        input_schema: {
          type: "object",
          properties: {
            referenceImagePath: { type: "string" },
            target: { type: "string" },
            region: { type: "object" },
          },
        },
      },
    ],
  });

  const readParams = request.tools?.[0]?.parameters as Record<string, unknown>;
  const readProperties = readParams.properties as Record<string, Record<string, unknown>>;
  assert.equal("pages" in readProperties, false);

  const figmaParams = request.tools?.[1]?.parameters as Record<string, unknown>;
  const figmaProperties = figmaParams.properties as Record<string, Record<string, unknown>>;
  assert.equal(figmaProperties.maxBytes.maximum, 500_000);

  const compareParams = request.tools?.[2]?.parameters as Record<string, unknown>;
  const compareProperties = compareParams.properties as Record<string, Record<string, unknown>>;
  assert.match(String(compareProperties.region.description), /target selector takes precedence/);

  const message = toAnthropicMessageResponse({
    id: "resp_tools",
    model: "gpt-5.5",
    output: [
      {
        type: "function_call",
        call_id: "call_read",
        name: "Read",
        arguments: JSON.stringify({ file_path: "src/App.tsx", pages: "> ???" }),
      },
      {
        type: "function_call",
        call_id: "call_figma",
        name: "mcp__tech-cc-hub-figma__figma_export_node_images",
        arguments: JSON.stringify({ fileKeyOrUrl: "https://figma.com/design/key/file", maxBytes: 12_000_000 }),
      },
      {
        type: "function_call",
        call_id: "call_compare",
        name: "mcp__tech-cc-hub-design__design_compare_current_view",
        arguments: JSON.stringify({
          referenceImagePath: "C:/tmp/reference.png",
          target: ".drawer",
          region: { x: 0, y: 0, width: 100, height: 80 },
        }),
      },
    ],
    usage: {},
  }, "gpt-5.5");

  assert.deepEqual(message.content[0], {
    type: "tool_use",
    id: "call_read",
    name: "Read",
    input: { file_path: "src/App.tsx" },
  });
  assert.deepEqual(message.content[1], {
    type: "tool_use",
    id: "call_figma",
    name: "mcp__tech-cc-hub-figma__figma_export_node_images",
    input: { fileKeyOrUrl: "https://figma.com/design/key/file", maxBytes: 500_000 },
  });
  assert.deepEqual(message.content[2], {
    type: "tool_use",
    id: "call_compare",
    name: "mcp__tech-cc-hub-design__design_compare_current_view",
    input: { referenceImagePath: "C:/tmp/reference.png", target: ".drawer" },
  });
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
  assert.match(source, /routingWeight/);
  assert.doesNotMatch(source, /enabled:\s*index === targetIndex/);
  assert.doesNotMatch(source, /auth\.openai\.com\/oauth\/authorize/);
  assert.doesNotMatch(source, /localhost:1455\/auth\/callback/);
});

test("codex proxy reloads credentials before retrying stale refresh tokens", () => {
  const source = readFileSync("src/electron/libs/codex/codex-anthropic-proxy.ts", "utf8");

  assert.match(source, /credentialRefreshes/);
  assert.match(source, /readProfileCredential/);
  assert.match(source, /readCodexCliCredential/);
  assert.match(source, /parseCodexCliAuthCredential/);
  assert.match(source, /already been used/);
});

test("development startup isolates Electron cache and Codex proxy port", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const proxySource = readFileSync("src/electron/libs/codex/codex-anthropic-proxy.ts", "utf8");

  assert.match(mainSource, /configureDevelopmentRuntimeIsolation/);
  assert.match(mainSource, /app\.setPath\("sessionData"/);
  assert.match(mainSource, /TECH_CC_HUB_CODEX_PROXY_PORT = "14560"/);
  assert.match(proxySource, /resolveCodexProxyPort/);
  assert.match(proxySource, /TECH_CC_HUB_CODEX_PROXY_PORT/);
});

function buildJwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "none" })}.${encode(payload)}.`;
}
