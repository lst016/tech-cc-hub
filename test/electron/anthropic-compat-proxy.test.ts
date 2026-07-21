import test from "node:test";
import assert from "node:assert/strict";

import {
  sanitizeAnthropicMessagesPayload,
  shouldUseAnthropicCompatProxy,
} from "../../src/electron/libs/anthropic/anthropic-compat.js";
import type { ApiConfig } from "../../src/electron/libs/config-store.js";

test("anthropic compatibility proxy moves system role messages to the top-level system field", () => {
  const payload = sanitizeAnthropicMessagesPayload({
    model: "deepseek-v4-pro",
    system: "Existing system prompt.",
    messages: [
      { role: "user", content: "continue" },
      { role: "system", content: [{ type: "text", text: "Runtime system patch." }] },
      { role: "assistant", content: "working" },
      { role: "system", content: "Resume boundary." },
    ],
    stream: true,
  }) as {
    system: string;
    messages: Array<{ role: string; content: unknown }>;
  };

  assert.equal(payload.system, "Existing system prompt.\n\nRuntime system patch.\n\nResume boundary.");
  assert.deepEqual(payload.messages.map((message) => message.role), ["user", "assistant"]);
});

test("anthropic compatibility proxy normalizes invalid required keywords recursively", () => {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => warnings.push(args);

  try {
    const payload = sanitizeAnthropicMessagesPayload({
      model: "kimi-k3",
      messages: [{ role: "user", content: "continue" }],
      tools: [
        {
          name: "invalid_required",
          input_schema: {
            type: "object",
            required: true,
            properties: {
              required: { type: "boolean" },
              options: {
                type: "object",
                required: null,
                properties: { mode: { type: "string" } },
              },
            },
          },
        },
        {
          name: "mixed_required_array",
          input_schema: {
            type: "object",
            required: ["query", false, "limit"],
            properties: {
              query: { type: "string" },
              limit: { type: "number" },
            },
          },
        },
        {
          name: "optional_only",
          input_schema: {
            type: "object",
            properties: { query: { type: "string" } },
          },
        },
      ],
    }) as {
      tools: Array<{ input_schema: Record<string, unknown> }>;
    };

    const invalidSchema = payload.tools[0].input_schema;
    const invalidProperties = invalidSchema.properties as Record<string, Record<string, unknown>>;
    assert.equal("required" in invalidSchema, false);
    assert.deepEqual(invalidProperties.required, { type: "boolean" });
    assert.equal("required" in invalidProperties.options, false);
    assert.deepEqual(payload.tools[1].input_schema.required, ["query", "limit"]);
    assert.equal("required" in payload.tools[2].input_schema, false);

    assert.equal(warnings.length, 3);
    assert.ok(warnings.every((warning) => warning[0] === "[tool-schema] normalized invalid required keyword"));
    assert.deepEqual(warnings.map((warning) => warning[1]), [
      { toolName: "invalid_required", path: "$.required", actualType: "boolean" },
      { toolName: "invalid_required", path: "$.properties.options.required", actualType: "null" },
      { toolName: "mixed_required_array", path: "$.required", actualType: "array-with-non-string-items" },
    ]);
  } finally {
    console.warn = originalWarn;
  }
});

test("anthropic compatibility proxy is used for third-party gateways only", () => {
  const baseConfig: ApiConfig = {
    id: "profile",
    name: "profile",
    apiKey: "key",
    baseURL: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  };

  assert.equal(shouldUseAnthropicCompatProxy(baseConfig), false);
  assert.equal(shouldUseAnthropicCompatProxy({
    ...baseConfig,
    provider: "boke",
    baseURL: "https://ai.pocketcity.com/v1",
  }), true);
  assert.equal(shouldUseAnthropicCompatProxy({
    ...baseConfig,
    provider: "codex",
    baseURL: "https://chatgpt.com",
  }), false);
});
