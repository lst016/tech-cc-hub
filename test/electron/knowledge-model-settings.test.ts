import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { resolveKnowledgeModelSettingsFromProfiles } from "../../src/electron/libs/knowledge/knowledge-model-settings-core.js";
import type { ApiConfig } from "../../src/electron/libs/config-store.js";

function profile(overrides: Partial<ApiConfig>): ApiConfig {
  return {
    id: overrides.id ?? randomUUID(),
    name: overrides.name ?? "Profile",
    apiKey: overrides.apiKey ?? "sk-test",
    baseURL: overrides.baseURL ?? "https://api.example.com/v1",
    model: overrides.model ?? "mimo-chat",
    embeddingModel: overrides.embeddingModel,
    wikiModel: overrides.wikiModel,
    enabled: overrides.enabled ?? true,
    provider: overrides.provider ?? "custom",
  };
}

test("knowledge model settings prefer non-Codex profiles for wiki generation", () => {
  const settings = resolveKnowledgeModelSettingsFromProfiles([
    profile({
      id: "codex",
      name: "Codex OAuth",
      apiKey: JSON.stringify({ access_token: "access-token", account_id: "account-id" }),
      baseURL: "https://chatgpt.com",
      provider: "codex",
      embeddingModel: "MiMo-V2.5",
      wikiModel: "MiMo-V2.5",
    }),
    profile({
      id: "local-new-api",
      name: "Local new-api",
      apiKey: "sk-local",
      baseURL: "https://ai.pocketcity.com/v1",
      provider: "custom",
      embeddingModel: "MiMo-V2.5",
      wikiModel: "MiMo-V2.5",
    }),
  ]);

  assert.equal(settings.embedding?.profileId, "local-new-api");
  assert.equal(settings.wiki?.profileId, "local-new-api");
  assert.equal(settings.wiki?.baseURL, "https://ai.pocketcity.com/v1");
});

test("knowledge model settings avoid embedding-only models for wiki generation", () => {
  const settings = resolveKnowledgeModelSettingsFromProfiles([
    profile({
      id: "local-new-api",
      name: "Local new-api",
      apiKey: "sk-local",
      baseURL: "https://ai.pocketcity.com/v1",
      provider: "custom",
      model: "deepseek-v4-flash",
      embeddingModel: "MiMo-V2.5",
      wikiModel: "Qwen3-Embedding-8B",
    }),
  ]);

  assert.equal(settings.embedding?.model, "MiMo-V2.5");
  assert.equal(settings.wiki?.model, "deepseek-v4-flash");
  assert.equal(settings.wiki?.profileId, "local-new-api");
});

test("knowledge model settings can fall back to Codex when it is the only configured profile", () => {
  const settings = resolveKnowledgeModelSettingsFromProfiles([
    profile({
      id: "codex",
      name: "Codex OAuth",
      apiKey: JSON.stringify({ access_token: "access-token", account_id: "account-id" }),
      baseURL: "https://chatgpt.com",
      provider: "codex",
      wikiModel: "gpt-5.5",
    }),
  ]);

  assert.equal(settings.wiki?.profileId, "codex");
});
