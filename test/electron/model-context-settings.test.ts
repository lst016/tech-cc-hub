import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createDeepSeekOfficialProfile,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  getRoutedModelOptionsForProfiles,
  normalizeProfile,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  applySharedModelRoutingPatch,
  buildSharedModelRoutingState,
} from "../../src/ui/components/settings/model-routing-utils.js";
import {
  buildGroupedModelOptions,
  getModelSearchScore,
} from "../../src/ui/components/ModelSelect.js";
import {
  getModelRoutingWeight,
  pickHighestWeightedModelOwner,
} from "../../src/shared/model-routing-weight.js";
import { pickImagePreprocessConfig } from "../../src/shared/image-preprocess-routing.js";

const MODEL_SEARCH_FIXTURE = [
  "gpt-5.4",
  "gpt-5.5",
  "gpt-5.3-codex-spark",
  "deepseek-v4-flash",
  "deepseek-v4-pro",
  "GLM-5.1-FP8",
];

function getModelSearchValues(query: string): string[] {
  return buildGroupedModelOptions(MODEL_SEARCH_FIXTURE, query).flatMap((group) =>
    group.options.map((option) => option.value),
  );
}

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
  assert.match(apiProfilesSettingsSource, /routingWeight/);
  assert.match(apiProfilesSettingsSource, /路由权重/);
  assert.match(uiTypesSource, /contextWindow/);
  assert.match(uiTypesSource, /compressionThresholdPercent/);
  assert.match(uiTypesSource, /routingWeight/);
  assert.match(configStoreSource, /contextWindow/);
  assert.match(configStoreSource, /compressionThresholdPercent/);
  assert.match(configStoreSource, /routingWeight/);
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

test("shared model routing model slots use grouped searchable comboboxes", () => {
  const modelRoutingSource = readFileSync("src/ui/components/settings/ModelRoutingSettingsPage.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/ModelSelect.tsx", "utf8");

  assert.match(modelRoutingSource, /<ModelSelect/);
  assert.match(modelSelectSource, /MODEL_GROUP_DEFINITIONS/);
  assert.match(modelSelectSource, /role="combobox"/);
  assert.match(modelSelectSource, /buildGroupedModelOptions/);
  assert.match(modelSelectSource, /getModelSearchScore/);
  assert.match(modelSelectSource, /isFuzzySubsequence/);
  assert.doesNotMatch(modelRoutingSource, /<select/);
});

test("model select search keeps short numeric tokens precise", () => {
  assert.deepEqual(getModelSearchValues("55"), ["gpt-5.5"]);
  assert.equal(getModelSearchScore("gpt-5.4", "Codex / GPT-5", "55"), -1);
});

test("model select search rejects loose two-character subsequences", () => {
  assert.deepEqual(getModelSearchValues("df"), []);
  assert.equal(getModelSearchScore("deepseek-v4-flash", "DeepSeek", "df"), -1);
});

test("model select search keeps useful direct and tight shorthand matches", () => {
  assert.deepEqual(getModelSearchValues("deep"), ["deepseek-v4-flash", "deepseek-v4-pro"]);
  assert.deepEqual(getModelSearchValues("v4f"), ["deepseek-v4-flash"]);
});

test("model select preserves routed option metadata for display and search", () => {
  const groups = buildGroupedModelOptions([
    {
      value: "gpt-5.5",
      label: "gpt-5.5",
      description: "Codex OAuth / Codex OAuth / weight 50",
      badge: "W50",
      title: "gpt-5.5 -> Codex OAuth",
    },
  ], "codex");

  const option = groups.flatMap((group) => group.options).find((item) => item.value === "gpt-5.5");
  assert.equal(option?.description, "Codex OAuth / Codex OAuth / weight 50");
  assert.equal(option?.badge, "W50");
  assert.equal(option?.title, "gpt-5.5 -> Codex OAuth");
});

test("composer model control uses the searchable grouped model select", () => {
  const promptInputSource = readFileSync("src/ui/components/PromptInput.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/ModelSelect.tsx", "utf8");

  assert.match(promptInputSource, /import \{ ModelSelect \} from "\.\/ModelSelect"/);
  assert.match(promptInputSource, /getRoutedModelOptionsForProfiles/);
  assert.match(promptInputSource, /modelOptions=\{modelSelectOptions\}/);
  assert.match(promptInputSource, /variant="composer"/);
  assert.match(promptInputSource, /placement="top"/);
  assert.match(modelSelectSource, /搜索模型 \/ 分组/);
  assert.match(modelSelectSource, /DeepSeek/);
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

test("routed model options expose the platform owner selected by routing weight", () => {
  const profiles = [
    {
      id: "gateway",
      name: "Default Gateway",
      apiKey: "sk-gateway",
      baseURL: "https://gateway.example.com/v1",
      model: "deepseek-v4-flash",
      expertModel: "gpt-5.5",
      smallModel: "deepseek-v4-flash",
      models: [
        { name: "deepseek-v4-flash" },
        { name: "gpt-5.5", routingWeight: 1 },
      ],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "codex",
      name: "Codex OAuth",
      apiKey: "{}",
      baseURL: "https://chatgpt.com",
      model: "gpt-5.5",
      expertModel: "gpt-5.5",
      smallModel: "gpt-5.3-codex-spark",
      models: [
        { name: "gpt-5.5", routingWeight: 50 },
        { name: "gpt-5.3-codex-spark" },
      ],
      enabled: true,
      provider: "codex" as const,
      apiType: "anthropic" as const,
    },
  ];

  const options = getRoutedModelOptionsForProfiles(getEnabledProfiles(profiles));
  const gptOption = options.find((option) => option.value === "gpt-5.5");
  assert.equal(gptOption?.profileId, "codex");
  assert.equal(gptOption?.provider, "codex");
  assert.equal(gptOption?.routingWeight, 50);
  assert.match(gptOption?.routeLabel ?? "", /Codex OAuth/);

  const deepseekOption = options.find((option) => option.value === "deepseek-v4-flash");
  assert.equal(deepseekOption?.profileId, "gateway");
  assert.equal(deepseekOption?.providerLabel, "Custom Gateway");
});

test("image preprocessing follows the routed owner instead of preferring custom gateways", () => {
  const codex = {
    id: "codex",
    provider: "codex" as const,
    imageModel: "gpt-5.5",
    models: [
      { name: "gpt-5.5", routingWeight: 50 },
      { name: "Qwen3-VL-4B-Instruct" },
    ],
  };
  const gateway = {
    id: "gateway",
    provider: "custom" as const,
    imageModel: "gpt-5.5",
    models: [
      { name: "gpt-5.5", routingWeight: 1 },
      { name: "Qwen3-VL-4B-Instruct" },
    ],
  };

  assert.equal(
    pickImagePreprocessConfig(codex, [codex, gateway], "gpt-5.5")?.id,
    "codex",
  );
  assert.equal(
    pickImagePreprocessConfig(codex, [codex, gateway], "Qwen3-VL-4B-Instruct")?.id,
    "gateway",
  );
});

test("shared model routing merges enabled profile models into one editable surface", () => {
  const profiles = [
    {
      id: "codex",
      name: "Codex OAuth",
      apiKey: "{}",
      baseURL: "https://chatgpt.com",
      model: "gpt-5.4",
      expertModel: "gpt-5.4",
      smallModel: "gpt-5.3-codex-spark",
      analysisModel: "gpt-5.3-codex-spark",
      models: [{ name: "gpt-5.4", routingWeight: 25 }, { name: "gpt-5.3-codex-spark" }],
      enabled: true,
      provider: "codex" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "default",
      name: "默认配置",
      apiKey: "sk-test",
      baseURL: "https://example.com/v1",
      model: "deepseek-v4-flash",
      expertModel: "deepseek-v4-pro",
      smallModel: "GLM-5.1-FP8",
      analysisModel: "GLM-5.1-FP8",
      models: [{ name: "deepseek-v4-flash" }, { name: "deepseek-v4-pro" }, { name: "GLM-5.1-FP8", routingWeight: 10 }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const state = buildSharedModelRoutingState(profiles);
  assert.deepEqual(state.routedProfileIds, ["codex", "default"]);
  assert.deepEqual(state.availableModels, [
    "gpt-5.4",
    "gpt-5.3-codex-spark",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "GLM-5.1-FP8",
  ]);

  const nextProfiles = applySharedModelRoutingPatch(profiles, { smallModel: "GLM-5.1-FP8" });
  assert.equal(nextProfiles[0]?.smallModel, "GLM-5.1-FP8");
  assert.equal(nextProfiles[1]?.smallModel, "GLM-5.1-FP8");
  assert.ok(nextProfiles[0]?.models?.some((model) => model.name === "deepseek-v4-pro"));
  assert.ok(nextProfiles[1]?.models?.some((model) => model.name === "gpt-5.4"));
  assert.equal(nextProfiles[0]?.models?.find((model) => model.name === "gpt-5.4")?.routingWeight, 25);
  assert.equal(nextProfiles[0]?.models?.find((model) => model.name === "GLM-5.1-FP8")?.routingWeight, undefined);
  assert.equal(nextProfiles[1]?.models?.find((model) => model.name === "GLM-5.1-FP8")?.routingWeight, 10);

  const withoutImageModels = applySharedModelRoutingPatch(nextProfiles, { imageModel: "" });
  assert.equal(withoutImageModels[0]?.imageModel, undefined);
  assert.equal(withoutImageModels[1]?.imageModel, undefined);
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
        routingWeight: 12,
      },
    ],
    enabled: true,
    apiType: "anthropic",
  });

  assert.equal(normalized.models?.find((model) => model.name === "deepseek-v4-pro")?.contextWindow, 1_000_000);
  assert.equal(normalized.models?.find((model) => model.name === "deepseek-v4-pro")?.routingWeight, 12);
});

test("model routing weight chooses the highest weighted owner and keeps order on ties", () => {
  const owners = [
    { id: "first", models: [{ name: "shared-model", routingWeight: 1 }] },
    { id: "second", models: [{ name: "shared-model", routingWeight: 20 }] },
    { id: "third", models: [{ name: "other-model", routingWeight: 50 }] },
  ];

  const selected = pickHighestWeightedModelOwner(
    owners,
    "shared-model",
    (owner, modelName) => owner.models.some((model) => model.name === modelName),
  );
  assert.equal(selected?.id, "second");
  assert.equal(getModelRoutingWeight(owners[1], "shared-model"), 20);

  const tied = pickHighestWeightedModelOwner(
    [
      { id: "first", models: [{ name: "shared-model", routingWeight: 10 }] },
      { id: "second", models: [{ name: "shared-model", routingWeight: 10 }] },
    ],
    "shared-model",
    (owner, modelName) => owner.models.some((model) => model.name === modelName),
  );
  assert.equal(tied?.id, "first");
  assert.equal(getModelRoutingWeight({ models: [{ name: "shared-model", routingWeight: 0 }] }, "shared-model"), 0);
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
