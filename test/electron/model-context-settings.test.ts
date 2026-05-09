import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDeepSeekOfficialProfile,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  normalizeProfile,
} from "../../src/ui/components/settings/settings-utils.js";

test("settings modal and shared types expose per-model context compression fields", () => {
  const apiProfilesSettingsSource = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");
  const uiTypesSource = readFileSync("src/ui/types.ts", "utf8");
  const configStoreSource = readFileSync("src/electron/libs/config-store.ts", "utf8");
  const claudeSettingsSource = readFileSync("src/electron/libs/claude-settings.ts", "utf8");
  const settingsModalSource = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
  const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");
  const globalTypesSource = readFileSync("types.d.ts", "utf8");

  assert.match(apiProfilesSettingsSource, /contextWindow/);
  assert.match(apiProfilesSettingsSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /contextWindow/);
  assert.match(uiTypesSource, /compressionThresholdPercent/);
  assert.match(configStoreSource, /contextWindow/);
  assert.match(configStoreSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /analysisModel/);
  assert.match(configStoreSource, /analysisModel/);
  assert.match(claudeSettingsSource, /CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC/);
  assert.match(claudeSettingsSource, /DISABLE_TELEMETRY/);
  assert.match(claudeSettingsSource, /getApiConfigForModel/);
  assert.match(claudeSettingsSource, /getEnabledUsableApiConfigs/);
  assert.match(apiProfilesSettingsSource, /Prompt 分析模型/);
  assert.match(apiProfilesSettingsSource, /测试连接/);
  assert.match(apiProfilesSettingsSource, /onChange\(\(current\) => \[create\(\), \.\.\.current\]\)/);
  assert.doesNotMatch(apiProfilesSettingsSource, /enabled:\s*item\.id === profile\.id/);
  assert.doesNotMatch(settingsModalSource, /enabled:\s*index === enabledIndex/);
  assert.doesNotMatch(configStoreSource, /profile\.enabled && !hasEnabled/);
  assert.match(apiProfilesSettingsSource, /createMenuOpen/);
  assert.doesNotMatch(apiProfilesSettingsSource, /DropdownMenu\.Portal/);
  assert.match(settingsModalSource, /toast\.success\("设置已保存。"\)/);
  assert.doesNotMatch(settingsModalSource, /setStatus\(\{\s*tone:\s*"success"/);
  assert.match(mainSource, /testApiConfig/);
  assert.match(preloadSource, /test-api-config/);
  assert.match(devShimSource, /testApiConfig/);
  assert.match(globalTypesSource, /test-api-config/);
});

test("enabled profile helpers preserve list order and dedupe models across enabled configs", () => {
  const profiles = [
    {
      id: "first",
      name: "first",
      apiKey: "sk-first",
      baseURL: "https://first.example.com/v1",
      model: "shared-model",
      expertModel: "first-expert",
      smallModel: "first-small",
      models: [{ name: "shared-model" }, { name: "first-extra" }],
      enabled: true,
      apiType: "anthropic" as const,
    },
    {
      id: "second",
      name: "second",
      apiKey: "sk-second",
      baseURL: "https://second.example.com/v1",
      model: "shared-model",
      expertModel: "second-expert",
      smallModel: "second-small",
      models: [{ name: "shared-model" }, { name: "second-extra" }],
      enabled: true,
      apiType: "anthropic" as const,
    },
  ];

  assert.deepEqual(getEnabledProfiles(profiles).map((profile) => profile.id), ["first", "second"]);
  assert.deepEqual(getAvailableModelsForProfiles(getEnabledProfiles(profiles)), [
    "shared-model",
    "first-expert",
    "first-small",
    "first-extra",
    "second-expert",
    "second-small",
    "second-extra",
  ]);
});

test("profile normalization preserves configured context window for selected role models", () => {
  const normalized = normalizeProfile({
    id: "profile-1",
    name: "default",
    apiKey: "test-key",
    baseURL: "https://example.com/v1",
    model: "deepseek-v4-pro",
    expertModel: "deepseek-v4-pro",
    analysisModel: "deepseek-v4-pro",
    models: [
      {
        name: "deepseek-v4-pro",
        contextWindow: 1_000_000,
        compressionThresholdPercent: 70,
      },
    ],
    enabled: true,
    apiType: "anthropic",
  });

  assert.equal(normalized.models?.find((model) => model.name === "deepseek-v4-pro")?.contextWindow, 1_000_000);
});

test("deepseek official profile only requires the key while preserving official models", () => {
  const profile = createDeepSeekOfficialProfile();
  const normalized = normalizeProfile({
    ...profile,
    apiKey: "sk-test",
    baseURL: "",
  });

  assert.equal(normalized.provider, "deepseek");
  assert.equal(normalized.baseURL, "https://api.deepseek.com/anthropic");
  assert.equal(normalized.model, "deepseek-v4-flash");
  assert.equal(normalized.expertModel, "deepseek-v4-pro");
  assert.equal(normalized.models?.find((model) => model.name === "deepseek-v4-flash")?.contextWindow, 1_000_000);
});

test("explicit custom provider is preserved even with a deepseek host", () => {
  const normalized = normalizeProfile({
    id: "profile-2",
    name: "DeepSeek",
    apiKey: "sk-test",
    baseURL: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-flash",
    expertModel: "deepseek-v4-pro",
    analysisModel: "deepseek-v4-flash",
    models: [
      {
        name: "deepseek-v4-flash",
        contextWindow: 1_000_000,
        compressionThresholdPercent: 70,
      },
      {
        name: "deepseek-v4-pro",
        contextWindow: 1_000_000,
        compressionThresholdPercent: 70,
      },
    ],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  });

  assert.equal(normalized.provider, "custom");
  assert.equal(normalized.baseURL, "https://api.deepseek.com/anthropic");
});

test("legacy deepseek host without provider is still normalized as official provider", () => {
  const normalized = normalizeProfile({
    id: "profile-3",
    name: "DeepSeek",
    apiKey: "sk-test",
    baseURL: "https://api.deepseek.com/anthropic",
    model: "deepseek-v4-flash",
    expertModel: "deepseek-v4-pro",
    analysisModel: "deepseek-v4-flash",
    models: [
      {
        name: "deepseek-v4-flash",
        contextWindow: 1_000_000,
        compressionThresholdPercent: 70,
      },
    ],
    enabled: true,
    apiType: "anthropic",
  });

  assert.equal(normalized.provider, "deepseek");
  assert.equal(normalized.baseURL, "https://api.deepseek.com/anthropic");
});
