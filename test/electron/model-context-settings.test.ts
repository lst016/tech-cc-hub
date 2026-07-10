import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createMiniMaxOfficialProfile,
  createDeepSeekOfficialProfile,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  getRoutedModelOptionsForProfiles,
  normalizeProfile,
  resolveAvailableModelName,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  applySharedModelRoutingPatch,
  buildSharedModelRoutingState,
} from "../../src/ui/components/settings/model-routing-utils.js";
import {
  buildGroupedModelOptions,
  getModelSearchScore,
} from "../../src/ui/components/models/ModelSelect.js";
import {
  getModelRoutingWeight,
  pickHighestWeightedModelOwner,
} from "../../src/shared/models/model-routing-weight.js";
import {
  pickImagePreprocessConfig,
  resolveImagePreprocessRouteConfig,
  type ImagePreprocessRouteConfig,
} from "../../src/shared/models/image-preprocess-routing.js";
import { extractApiModelsFromListPayload } from "../../src/shared/models/api-model-metadata.js";

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
  const claudeSettingsSource = readFileSync("src/electron/libs/claude/claude-settings.ts", "utf8");
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
  assert.match(globalTypesSource, /ApiModelsFetchModel/);
  assert.match(apiProfilesSettingsSource, /extractApiModelsFromListPayload/);
  assert.match(apiProfilesSettingsSource, /同步 \$\{contextCount\} 个上下文窗口/);
  assert.match(apiProfilesSettingsSource, /MiniMax 官方/);
  assert.match(apiProfilesSettingsSource, /Token Plan Subscription Key/);
  assert.match(uiTypesSource, /minimax/);
  assert.match(configStoreSource, /MINIMAX_ANTHROPIC_BASE_URL/);
});

test("model import extracts context windows from common gateway payloads", () => {
  const models = extractApiModelsFromListPayload({
    data: [
      { id: "gpt-5.5", context_window: 200_000 },
      { id: "deepseek-v4-pro", context_length: "1M" },
      { id: "openrouter-model", top_provider: { context_length: "128k" } },
      { name: "limit-model", limits: { contextWindow: "32,768" } },
      "plain-model",
      { id: "gpt-5.5", metadata: { context_window: 400_000 } },
    ],
  });

  assert.deepEqual(models, [
    { name: "gpt-5.5", contextWindow: 200_000 },
    { name: "deepseek-v4-pro", contextWindow: 1_000_000 },
    { name: "openrouter-model", contextWindow: 128_000 },
    { name: "limit-model", contextWindow: 32_768 },
    { name: "plain-model", contextWindow: undefined },
  ]);
});

test("shared model routing model slots use grouped searchable comboboxes", () => {
  const modelRoutingSource = readFileSync("src/ui/components/settings/ModelRoutingSettingsPage.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/models/ModelSelect.tsx", "utf8");

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

test("composer model control uses real configured models in the merged white menu", () => {
  const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/models/ModelSelect.tsx", "utf8");
  const composerModelMenuSource = readFileSync("src/ui/components/prompt-input/ComposerModelMenu.tsx", "utf8");

  assert.match(promptInputSource, /import \{ ComposerModelMenu \} from "\.\/ComposerModelMenu"/);
  assert.match(promptInputSource, /getRoutedModelOptionsForProfiles/);
  assert.match(promptInputSource, /modelOptions=\{modelSelectOptions\}/);
  assert.match(promptInputSource, /onModelChange=\{handleRuntimeModelChange\}/);
  assert.match(promptInputSource, /reasoningMode=\{reasoningMode\}/);
  assert.match(promptInputSource, /onReasoningModeChange=\{setReasoningMode\}/);
  assert.match(composerModelMenuSource, /Context/);
  assert.match(composerModelMenuSource, /思维强度/);
  assert.match(composerModelMenuSource, /REASONING_OPTIONS/);
  assert.match(composerModelMenuSource, /closeMenu\(\);/);
  assert.match(composerModelMenuSource, /getContextDisplay/);
  assert.match(composerModelMenuSource, /contextWindow/);
  assert.match(composerModelMenuSource, /detailLabel: option\.badge/);
  assert.match(promptInputSource, /contextWindow: option\.contextWindow/);
  assert.match(composerModelMenuSource, /placeholder="筛选模型"/);
  assert.match(composerModelMenuSource, /filterComposerModelOptions/);
  assert.doesNotMatch(composerModelMenuSource, /思考强度/);
  assert.doesNotMatch(composerModelMenuSource, /THINKING_OPTIONS/);
  assert.doesNotMatch(composerModelMenuSource, /label: "max"/);
  assert.doesNotMatch(composerModelMenuSource, /reasoningValue === "disabled" \? "high" : "disabled"/);
  assert.doesNotMatch(composerModelMenuSource, /Ultimate/);
  assert.doesNotMatch(composerModelMenuSource, /Performance/);
  assert.doesNotMatch(composerModelMenuSource, /Efficient/);
  assert.doesNotMatch(composerModelMenuSource, /Lite/);
  assert.match(composerModelMenuSource, /bg-white text-\[#171b23\]/);
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

test("enabled profile helpers keep distinct deepseek casing variants when both exist", () => {
  const profiles = [
    {
      id: "gateway",
      name: "Default Gateway",
      apiKey: "sk-gateway",
      baseURL: "https://gateway.example.com/v1",
      model: "DeepSeek-V4-Pro",
      expertModel: "gpt-5.5",
      smallModel: "DeepSeek-V4-Pro",
      models: [
        { name: "DeepSeek-V4-Pro" },
        { name: "deepseek-v4-pro" },
        { name: "deepseek-chat" },
      ],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  assert.deepEqual(getAvailableModelsForProfiles(getEnabledProfiles(profiles)), [
    "DeepSeek-V4-Pro",
    "gpt-5.5",
    "deepseek-v4-pro",
    "deepseek-chat",
  ]);
  assert.equal(
    resolveAvailableModelName("deepseek-v4-pro", getAvailableModelsForProfiles(getEnabledProfiles(profiles))),
    "deepseek-v4-pro",
  );
});

test("minimax official profile uses token plan endpoint and context windows", () => {
  const profile = createMiniMaxOfficialProfile();
  const normalized = normalizeProfile({
    ...profile,
    apiKey: "sk-cp-test",
    baseURL: "",
  });

  assert.equal(normalized.provider, "minimax");
  assert.equal(normalized.baseURL, "https://api.minimaxi.com/anthropic");
  assert.equal(normalized.model, "MiniMax-M3");
  assert.equal(normalized.expertModel, "MiniMax-M3");
  assert.equal(normalized.smallModel, "MiniMax-M2.7-highspeed");
  assert.equal(normalized.analysisModel, "MiniMax-M2.7-highspeed");
  assert.equal(normalized.models?.find((model) => model.name === "MiniMax-M3")?.contextWindow, 1_000_000);
  assert.equal(normalized.models?.find((model) => model.name === "MiniMax-M2.7-highspeed")?.contextWindow, 204_800);
});

test("official provider profile names recover from legacy mojibake", () => {
  const minimaxProfile = createMiniMaxOfficialProfile();
  const normalizedMiniMaxProfile = normalizeProfile({
    ...minimaxProfile,
    name: "MiniMax 瀹樻柟",
    apiKey: "sk-cp-test",
  });
  const normalizedMiniMaxVariant = normalizeProfile({
    ...minimaxProfile,
    name: "MiniMax 瀚樟柿",
    apiKey: "sk-cp-test",
  });
  const deepseekProfile = createDeepSeekOfficialProfile();
  const normalizedDeepSeekProfile = normalizeProfile({
    ...deepseekProfile,
    name: "DeepSeek 瀹樻柟",
    apiKey: "sk-test",
  });
  const normalizedDefaultProfile = normalizeProfile({
    id: "default",
    name: "榛樿閰嶇疆",
    apiKey: "sk-test",
    baseURL: "https://example.com/v1",
    model: "gpt-5.5",
    expertModel: "gpt-5.5",
    smallModel: "gpt-5.5",
    analysisModel: "gpt-5.5",
    models: [{ name: "gpt-5.5" }],
    enabled: true,
    provider: "custom" as const,
    apiType: "anthropic" as const,
  });
  const configStoreSource = readFileSync("src/electron/libs/config-store.ts", "utf8");

  assert.equal(normalizedMiniMaxProfile.name, "MiniMax 官方");
  assert.equal(normalizedMiniMaxVariant.name, "MiniMax 官方");
  assert.equal(normalizedDeepSeekProfile.name, "DeepSeek 官方");
  assert.equal(normalizedDefaultProfile.name, "默认配置");
  assert.match(configStoreSource, /normalizeKnownConfigName/);
});

test("minimax provider routes only minimax models and resolves casing", () => {
  const profiles = [
    {
      id: "official-minimax",
      name: "MiniMax Official",
      apiKey: "sk-cp-test",
      baseURL: "https://api.minimaxi.com/anthropic",
      model: "MiniMax-M3",
      expertModel: "MiniMax-M3",
      smallModel: "MiniMax-M2.7-highspeed",
      models: [
        { name: "MiniMax-M3", contextWindow: 1_000_000, routingWeight: 20 },
        { name: "MiniMax-M2.7-highspeed", contextWindow: 204_800 },
      ],
      enabled: true,
      provider: "minimax" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "gateway",
      name: "Default Gateway",
      apiKey: "sk-gateway",
      baseURL: "https://gateway.example.com/v1",
      model: "minimax-m3",
      expertModel: "minimax-m3",
      smallModel: "gpt-5.5",
      models: [{ name: "minimax-m3" }, { name: "gpt-5.5" }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const availableModels = getAvailableModelsForProfiles(getEnabledProfiles(profiles));
  assert.equal(resolveAvailableModelName("minimax-m3", availableModels), "minimax-m3");
  assert.equal(resolveAvailableModelName("MiniMax-M3", availableModels), "MiniMax-M3");
  assert.equal(resolveAvailableModelName("minimax-m3", ["MiniMax-M3"]), "MiniMax-M3");

  const options = getRoutedModelOptionsForProfiles(getEnabledProfiles(profiles));
  const officialOption = options.find((option) => option.value === "MiniMax-M3");
  const gatewayOption = options.find((option) => option.value === "minimax-m3");
  assert.equal(officialOption?.profileId, "official-minimax");
  assert.equal(officialOption?.provider, "minimax");
  assert.equal(officialOption?.contextWindow, 1_000_000);
  assert.equal(gatewayOption?.profileId, "gateway");
  assert.equal(gatewayOption?.provider, "custom");
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
        { name: "gpt-5.5", contextWindow: 200_000, routingWeight: 1 },
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
        { name: "gpt-5.5", contextWindow: 200_000, routingWeight: 50 },
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
  assert.equal(gptOption?.contextWindow, 200_000);
  assert.match(gptOption?.routeLabel ?? "", /Codex OAuth/);

  const deepseekOption = options.find((option) => option.value === "deepseek-v4-flash");
  assert.equal(deepseekOption?.profileId, "gateway");
  assert.equal(deepseekOption?.providerLabel, "Custom Gateway");
});

test("routed model options keep official and self-hosted deepseek variants separate", () => {
  const profiles = [
    {
      id: "official",
      name: "DeepSeek Official",
      apiKey: "sk-official",
      baseURL: "https://api.deepseek.com/anthropic",
      model: "deepseek-v4-pro",
      expertModel: "deepseek-v4-pro",
      smallModel: "deepseek-v4-pro",
      models: [{ name: "deepseek-v4-pro" }],
      enabled: true,
      provider: "deepseek" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "gateway",
      name: "Default Gateway",
      apiKey: "sk-gateway",
      baseURL: "https://gateway.example.com/v1",
      model: "DeepSeek-V4-Pro",
      expertModel: "DeepSeek-V4-Pro",
      smallModel: "DeepSeek-V4-Pro",
      models: [{ name: "DeepSeek-V4-Pro" }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const options = getRoutedModelOptionsForProfiles(getEnabledProfiles(profiles));
  const officialOption = options.find((option) => option.value === "deepseek-v4-pro");
  const gatewayOption = options.find((option) => option.value === "DeepSeek-V4-Pro");
  assert.equal(officialOption?.label, "deepseek-v4-pro");
  assert.equal(officialOption?.provider, "deepseek");
  assert.equal(gatewayOption?.label, "DeepSeek-V4-Pro");
  assert.equal(gatewayOption?.provider, "custom");
});

test("image preprocessing follows routed weights only across configs that declare the image model", () => {
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
    pickImagePreprocessConfig(codex, [codex, gateway], "Qwen3-VL-4B-Instruct"),
    null,
  );
});

test("image preprocessing config lookup can use image models from another enabled profile", () => {
  const selectedConfig = {
    id: "codex",
    provider: "codex" as const,
    models: [{ name: "gpt-5.5" }],
  };
  const imageConfig = {
    id: "default",
    provider: "custom" as const,
    imageModel: "gemini-3-pro-image-preview",
    models: [
      { name: "DeepSeek-V4-Pro" },
      { name: "gemini-3-pro-image-preview" },
    ],
  };

  const settingsPageSource = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");

  assert.equal(
    resolveImagePreprocessRouteConfig(selectedConfig, [selectedConfig, imageConfig])?.id,
    "default",
  );
  assert.match(settingsPageSource, /isLikelyImageUnderstandingModel/);
  assert.doesNotMatch(settingsPageSource, /function isLikelyVisionUnderstandingModel/);
});

test("image preprocessing route ignores model-list matches without an executable imageModel", () => {
  const selectedConfig: ImagePreprocessRouteConfig = {
    id: "selected",
    provider: "custom" as const,
    models: [{ name: "gemini-3-pro-image-preview", routingWeight: 100 }],
  };
  const imageConfig: ImagePreprocessRouteConfig = {
    id: "image",
    provider: "custom" as const,
    imageModel: "gemini-3-pro-image-preview",
    models: [{ name: "gemini-3-pro-image-preview", routingWeight: 1 }],
  };

  const resolved = resolveImagePreprocessRouteConfig(selectedConfig, [selectedConfig, imageConfig]);

  assert.equal(resolved?.id, "image");
  assert.equal(resolved?.imageModel, "gemini-3-pro-image-preview");
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

test("shared model routing shows optional slots configured on later enabled profiles", () => {
  const profiles = [
    {
      id: "codex",
      name: "Codex OAuth",
      apiKey: "{}",
      baseURL: "https://chatgpt.com",
      model: "gpt-5.5",
      expertModel: "gpt-5.5",
      smallModel: "gpt-5.3-codex-spark",
      analysisModel: "gpt-5.3-codex-spark",
      imageModel: undefined,
      models: [{ name: "gpt-5.5" }, { name: "gpt-5.3-codex-spark" }],
      enabled: true,
      provider: "codex" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "gateway",
      name: "Gateway",
      apiKey: "sk-test",
      baseURL: "https://example.com/v1",
      model: "DeepSeek-V4-Pro",
      expertModel: "gpt-5.5",
      smallModel: "MiniMax-M3",
      analysisModel: "MiniMax-M3",
      imageModel: "gemini-3.1-pro-preview",
      embeddingModel: "Qwen3-Embedding-8B",
      wikiModel: "MiniMax-M3",
      models: [
        { name: "DeepSeek-V4-Pro" },
        { name: "gpt-5.5" },
        { name: "MiniMax-M3" },
        { name: "gemini-3.1-pro-preview" },
        { name: "Qwen3-Embedding-8B" },
      ],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const state = buildSharedModelRoutingState(profiles);

  assert.equal(state.imageModel, "gemini-3.1-pro-preview");
  assert.equal(state.embeddingModel, "Qwen3-Embedding-8B");
  assert.equal(state.wikiModel, "MiniMax-M3");
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
