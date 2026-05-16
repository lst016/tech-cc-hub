# test/electron/codex-oauth-provider.test.ts

> 模块：`test` · 语言：`typescript` · 行数：216

## 文件职责

测试Codex OAuth profile的创建和规范化、模型池兼容性检查、缓存模型ID提取与合并、OAuth凭证解析、合成流响应构建

## 关键符号

- `createCodexOAuthProfile@0 - 创建Codex OAuth profile，包含官方endpoint和内置模型列表`
- `mergeCodexModelIds@0 - 合并缓存模型和内置模型，去重-openai-compact后缀`
- `parseCodexOAuthCredential@0 - 解析access_token和account_id的JSON凭证`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `node:fs`
- `../../src/electron/libs/codex-oauth.js`
- `../../src/ui/components/settings/settings-utils.js`
- `../../src/shared/model-provider-routing.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

  assert.equal(request.model
... (truncated)
```
