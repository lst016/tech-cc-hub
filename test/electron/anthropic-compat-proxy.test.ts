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
