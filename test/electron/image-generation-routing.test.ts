import test from "node:test";
import assert from "node:assert/strict";

import {
  resolveImageGenerationRoute,
  normalizeImageApiBaseURL,
  buildImageApiEndpoint,
  isLikelyImageGenerationModel,
} from "../../src/shared/models/image-generation-routing.js";

test("image generation route prefers selected config when slot is configured", () => {
  const selected = {
    id: "selected",
    provider: "custom" as const,
    baseURL: "https://gateway.example.com/v1",
    apiKey: "sk-selected",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };
  const other = {
    id: "other",
    provider: "custom" as const,
    baseURL: "https://other.example.com/v1",
    apiKey: "sk-other",
    imageGenerationModel: "gpt-image-1",
    models: [{ name: "gpt-image-1" }],
  };

  const route = resolveImageGenerationRoute(selected, [selected, other]);
  assert.equal(route.ok, true);
  if (route.ok) {
    assert.equal(route.profileId, "selected");
    assert.equal(route.model, "gpt-image-2");
  }
});

test("image generation route falls back to first enabled config with a usable slot", () => {
  const selected = {
    id: "selected",
    provider: "custom" as const,
    baseURL: "https://gateway.example.com/v1",
    apiKey: "sk-selected",
    models: [{ name: "gpt-5.5" }],
  };
  const imageConfig = {
    id: "image-config",
    provider: "custom" as const,
    baseURL: "https://image.example.com/v1",
    apiKey: "sk-image",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };

  const route = resolveImageGenerationRoute(selected, [selected, imageConfig]);
  assert.equal(route.ok, true);
  if (route.ok) {
    assert.equal(route.profileId, "image-config");
    assert.equal(route.model, "gpt-image-2");
  }
});

test("image generation route rejects codex OAuth provider explicitly", () => {
  const codex = {
    id: "codex",
    provider: "codex" as const,
    baseURL: "https://chatgpt.com",
    apiKey: "oauth-token",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
  };

  const route = resolveImageGenerationRoute(codex, [codex]);
  assert.equal(route.ok, false);
  if (!route.ok) {
    assert.equal(route.code, "UNSUPPORTED_PROVIDER");
    assert.match(route.message, /Codex OAuth/);
  }
});

test("image generation route returns NOT_CONFIGURED when no slot is set", () => {
  const selected = {
    id: "selected",
    provider: "custom" as const,
    baseURL: "https://gateway.example.com/v1",
    apiKey: "sk-selected",
    models: [{ name: "gpt-5.5" }],
  };

  const route = resolveImageGenerationRoute(selected, [selected]);
  assert.equal(route.ok, false);
  if (!route.ok) {
    assert.equal(route.code, "NOT_CONFIGURED");
  }
});

test("image generation route uses slot even when model is not in config model list", () => {
  const selected = {
    id: "selected",
    provider: "custom" as const,
    baseURL: "https://gateway.example.com/v1",
    apiKey: "sk-selected",
    imageGenerationModel: "gpt-image-2",
    models: [{ name: "gpt-5.5" }], // 生图模型不在主模型列表里，但仍应可用
  };

  const route = resolveImageGenerationRoute(selected, [selected]);
  assert.equal(route.ok, true);
  if (route.ok) {
    assert.equal(route.model, "gpt-image-2");
  }
});

test("normalizeImageApiBaseURL normalizes bare host to /v1", () => {
  const result = normalizeImageApiBaseURL("https://api.example.com");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://api.example.com/v1");
  }
});

test("normalizeImageApiBaseURL preserves existing /v1", () => {
  const result = normalizeImageApiBaseURL("https://api.example.com/v1");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.url, "https://api.example.com/v1");
  }
});

test("normalizeImageApiBaseURL rejects anthropic messages path", () => {
  const result = normalizeImageApiBaseURL("https://api.example.com/anthropic");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /文本对话专用入口|Images API/);
  }
});

test("normalizeImageApiBaseURL rejects codex chatgpt.com host", () => {
  const result = normalizeImageApiBaseURL("https://chatgpt.com");
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.error, /Codex OAuth/);
  }
});

test("buildImageApiEndpoint builds generations and edits paths", () => {
  const gen = buildImageApiEndpoint("https://api.example.com/v1", "generate");
  assert.equal(gen.ok, true);
  if (gen.ok) {
    assert.equal(gen.url, "https://api.example.com/v1/images/generations");
  }

  const edit = buildImageApiEndpoint("https://api.example.com", "edit");
  assert.equal(edit.ok, true);
  if (edit.ok) {
    assert.equal(edit.url, "https://api.example.com/v1/images/edits");
  }
});

test("isLikelyImageGenerationModel recognizes common image generation model names", () => {
  assert.equal(isLikelyImageGenerationModel("gpt-image-2"), true);
  assert.equal(isLikelyImageGenerationModel("dall-e-3"), true);
  assert.equal(isLikelyImageGenerationModel("flux-pro"), true);
  assert.equal(isLikelyImageGenerationModel("stable-diffusion-3"), true);
  assert.equal(isLikelyImageGenerationModel("gpt-5.5"), false);
  assert.equal(isLikelyImageGenerationModel(""), false);
  assert.equal(isLikelyImageGenerationModel(undefined), false);
});
