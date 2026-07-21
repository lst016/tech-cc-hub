import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createBokeGatewayProfile,
  createMiniMaxOfficialProfile,
  createDeepSeekOfficialProfile,
  getAutomaticRoutedModelOptionsForProfiles,
  getAvailableModelsForProfiles,
  getEnabledProfiles,
  getImageGenerationModelsForProfiles,
  getImageUnderstandingModelsForProfiles,
  getModelDeploymentOptionsForProfiles,
  getRoutedModelOptionsForProfiles,
  normalizeProfile,
  resolveAvailableModelName,
  validateProfiles,
} from "../../src/ui/components/settings/settings-utils.js";
import {
  applySharedModelRoutingPatch,
  buildSharedModelRoutingState,
} from "../../src/ui/components/settings/model-routing-utils.js";
import {
  buildGroupedModelOptions,
  getModelSearchScore,
} from "../../src/ui/components/models/ModelSelect.js";
import { getModelSelectMenuLayout } from "../../src/ui/components/models/model-select-layout.js";
import { filterComposerModelOptions } from "../../src/ui/components/prompt-input/ComposerModelMenu.js";
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
import {
  isBokeGatewayBaseURL,
  resolveSharedApiProviderMode,
} from "../../src/shared/models/model-provider-routing.js";

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
  const aiInterfaceSettingsSource = readFileSync("src/ui/components/settings/AiInterfaceSettingsPage.tsx", "utf8");
  const modelRoutingSettingsSource = readFileSync("src/ui/components/settings/ModelRoutingSettingsPage.tsx", "utf8");
  const modelCatalogSettingsSource = readFileSync("src/ui/components/settings/ModelCatalogSettingsPage.tsx", "utf8");
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
  assert.match(modelRoutingSettingsSource, /Prompt 分析模型/);
  assert.match(apiProfilesSettingsSource, /测试连接/);
  assert.match(apiProfilesSettingsSource, /onChange\(\(current\) => \[profile, \.\.\.current\]\)/);
  assert.match(aiInterfaceSettingsSource, /接口连接/);
  assert.match(aiInterfaceSettingsSource, /模型目录/);
  assert.match(aiInterfaceSettingsSource, /路由策略/);
  assert.match(modelCatalogSettingsSource, /恢复默认使用/);
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

test("model catalog filters use the app-styled accessible listbox", () => {
  const modelCatalogSettingsSource = readFileSync("src/ui/components/settings/ModelCatalogSettingsPage.tsx", "utf8");

  assert.doesNotMatch(modelCatalogSettingsSource, /<select/);
  assert.doesNotMatch(modelCatalogSettingsSource, /<option/);
  assert.match(modelCatalogSettingsSource, /role="combobox"/);
  assert.match(modelCatalogSettingsSource, /role="listbox"/);
  assert.match(modelCatalogSettingsSource, /role="option"/);
  assert.match(modelCatalogSettingsSource, /aria-activedescendant/);
  assert.match(modelCatalogSettingsSource, /event\.key === "ArrowDown"/);
  assert.match(modelCatalogSettingsSource, /event\.stopPropagation\(\)/);
  assert.match(modelCatalogSettingsSource, /document\.addEventListener\("pointerdown"/);
});

test("model catalog keeps scrolling inside the table viewport", () => {
  const modelCatalogSettingsSource = readFileSync("src/ui/components/settings/ModelCatalogSettingsPage.tsx", "utf8");

  assert.match(modelCatalogSettingsSource, /relative grid h-full min-h-0 overflow-hidden/);
  assert.match(modelCatalogSettingsSource, /<section className="flex min-h-0 min-w-0 flex-col overflow-hidden">/);
  assert.match(modelCatalogSettingsSource, /data-model-catalog-scroll-region/);
  assert.match(modelCatalogSettingsSource, /className="min-h-0 flex-1 overflow-auto overscroll-contain"/);
  assert.doesNotMatch(modelCatalogSettingsSource, /min-h-\[calc\(100vh-230px\)\]/);
});

test("model catalog presents manual exclusion as the default routing policy", () => {
  const modelCatalogSettingsSource = readFileSync("src/ui/components/settings/ModelCatalogSettingsPage.tsx", "utf8");

  assert.match(modelCatalogSettingsSource, />路由状态</);
  assert.match(modelCatalogSettingsSource, />默认可用</);
  assert.match(modelCatalogSettingsSource, />手动排除</);
  assert.match(modelCatalogSettingsSource, />网关未启用</);
  assert.doesNotMatch(modelCatalogSettingsSource, /:\s*"未使用"/);
  assert.doesNotMatch(modelCatalogSettingsSource, /待纳管/);
});

test("model import preserves context and Boke gateway catalog metadata", () => {
  const models = extractApiModelsFromListPayload({
    data: [
      {
        id: "gpt-5.5",
        context_window: 200_000,
        owned_by: "openai",
        supported_endpoint_types: ["openai", "openai-response"],
        created: 1_752_470_400,
      },
      { id: "deepseek-v4-pro", context_length: "1M" },
      { id: "openrouter-model", top_provider: { context_length: "128k" } },
      { name: "limit-model", limits: { contextWindow: "32,768" } },
      "plain-model",
      {
        id: "gpt-5.5",
        metadata: { context_window: 400_000 },
        supported_endpoint_types: ["openai-response", "image-generation", ""],
      },
    ],
  });

  assert.deepEqual(models, [
    {
      name: "gpt-5.5",
      contextWindow: 200_000,
      ownedBy: "openai",
      supportedEndpointTypes: ["openai", "openai-response", "image-generation"],
      createdAt: 1_752_470_400,
    },
    { name: "deepseek-v4-pro", contextWindow: 1_000_000 },
    { name: "openrouter-model", contextWindow: 128_000 },
    { name: "limit-model", contextWindow: 32_768 },
    { name: "plain-model", contextWindow: undefined },
  ]);
});

test("Boke provider is locked to the exact gateway hostname", () => {
  assert.equal(isBokeGatewayBaseURL("https://ai.pocketcity.com/v1"), true);
  assert.equal(isBokeGatewayBaseURL("HTTPS://AI.POCKETCITY.COM:443/v1"), true);
  assert.equal(isBokeGatewayBaseURL("https://edge.ai.pocketcity.com/v1"), false);
  assert.equal(isBokeGatewayBaseURL("https://ai.pocketcity.com.evil.test/v1"), false);
  assert.equal(isBokeGatewayBaseURL("https://notai.pocketcity.com/v1"), false);
  assert.equal(isBokeGatewayBaseURL("not a url"), false);

  assert.equal(resolveSharedApiProviderMode(undefined, "https://ai.pocketcity.com/v1"), "boke");
  assert.equal(resolveSharedApiProviderMode("custom", "https://ai.pocketcity.com/v1"), "boke");
  assert.equal(resolveSharedApiProviderMode("boke", "https://example.com/v1"), "custom");
  assert.equal(resolveSharedApiProviderMode("custom", "https://api.deepseek.com/anthropic"), "custom");
});

test("legacy Boke profile normalizes to the locked provider without changing Anthropic mode", () => {
  const normalized = normalizeProfile({
    id: "boke-profile",
    name: "波克",
    apiKey: "sk-test",
    baseURL: "https://ai.pocketcity.com/v1",
    model: "openai/gpt-5.5",
    models: [{
      name: "openai/gpt-5.5",
      ownedBy: "openai",
      supportedEndpointTypes: ["openai", "openai-response"],
      createdAt: 1_752_470_400,
    }],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  });

  assert.equal(normalized.provider, "boke");
  assert.equal(normalized.apiType, "anthropic");
  assert.deepEqual(normalized.models?.[0], {
    name: "openai/gpt-5.5",
    contextWindow: 200_000,
      compressionThresholdPercent: 70,
      routingWeight: undefined,
      catalogStatus: undefined,
      alias: undefined,
      tags: undefined,
      notes: undefined,
      ownedBy: "openai",
    supportedEndpointTypes: ["openai", "openai-response"],
    createdAt: 1_752_470_400,
  });
});

test("profile normalization auto-manages discovered models while preserving explicit exclusions", () => {
  const normalized = normalizeProfile({
    id: "default-managed-catalog",
    name: "Default managed catalog",
    apiKey: "sk-test",
    baseURL: "https://example.com/v1",
    model: "text-model",
    models: [
      { name: "text-model", catalogStatus: "managed" },
      {
        name: "doubao-seedream-5-0-pro-260628",
        catalogStatus: "discovered",
        supportedEndpointTypes: ["image-generation"],
      },
      {
        name: "excluded-image-model",
        catalogStatus: "excluded",
        supportedEndpointTypes: ["image-generation"],
      },
    ],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  });

  assert.equal(
    normalized.models?.find((model) => model.name === "doubao-seedream-5-0-pro-260628")?.catalogStatus,
    "managed",
  );
  assert.equal(
    normalized.models?.find((model) => model.name === "excluded-image-model")?.catalogStatus,
    "excluded",
  );
  assert.deepEqual(getImageGenerationModelsForProfiles([normalized]), [
    "doubao-seedream-5-0-pro-260628",
  ]);
});

test("gateway imports default every non-excluded model into the managed pool", () => {
  const source = readFileSync("src/ui/components/settings/ApiProfilesSettingsPage.tsx", "utf8");

  assert.match(
    source,
    /catalogStatus:\s*existing\?\.catalogStatus === "excluded"\s*\?\s*"excluded"\s*:\s*"managed"/,
  );
  assert.doesNotMatch(source, /catalogStatus:\s*existing\s*\?\s*existing\.catalogStatus\s*:\s*"discovered"/);
});

test("Boke factory and endpoint metadata separate image models from the full catalog", () => {
  const profile = {
    ...createBokeGatewayProfile(),
    id: "boke-capabilities",
    apiKey: "sk-test",
    model: "openai/gpt-5.5",
    models: [
      {
        name: "openai/gpt-5.5",
        ownedBy: "openai",
        supportedEndpointTypes: ["openai", "openai-response"],
      },
      {
        name: "openai/gpt-image-1",
        ownedBy: "openai",
        supportedEndpointTypes: ["openai", "image-generation"],
      },
      {
        name: "qwen/qwen-vl-max",
        ownedBy: "qwen",
        supportedEndpointTypes: ["openai"],
      },
    ],
  };

  assert.equal(profile.provider, "boke");
  assert.equal(profile.baseURL, "https://ai.pocketcity.com/v1");

  const state = buildSharedModelRoutingState([profile]);
  assert.deepEqual(state.imageGenerationModels, ["openai/gpt-image-1"]);
  assert.deepEqual(state.imageUnderstandingModels, ["openai/gpt-5.5", "qwen/qwen-vl-max"]);

  const option = getRoutedModelOptionsForProfiles([profile])
    .find((item) => item.value === "openai/gpt-5.5");
  assert.equal(option?.provider, "boke");
  assert.equal(option?.providerLabel, "波克网关");
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
  assert.match(modelSelectSource, /createPortal/);
  assert.match(modelSelectSource, /z-\[50000\]/);
  assert.doesNotMatch(modelRoutingSource, /<select/);
  assert.match(modelRoutingSource, /overflow-visible rounded-\[18px\]/);
  assert.doesNotMatch(modelRoutingSource, /overflow-hidden rounded-\[18px\]/);
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

test("composer model search treats dotted versions as one term and ignores opaque deployment keys", () => {
  const options = [
    {
      value: "profile-with-5-and-6::deepseek-v4-flash",
      label: "deepseek-v4-flash",
      displayLabel: "deepseek-v4-flash",
      detailLabel: "W10",
    },
    {
      value: "profile::doubao-seedream-5-0-pro-260628",
      label: "doubao-seedream-5-0-pro-260628",
      displayLabel: "doubao-seedream-5-0-pro-260628",
      detailLabel: "Boke",
    },
    {
      value: "profile::gpt-5.6-sol",
      label: "gpt-5.6-sol",
      displayLabel: "gpt-5.6-sol",
      detailLabel: "Boke",
    },
  ];

  assert.deepEqual(
    filterComposerModelOptions(options, "5.6").map((option) => option.displayLabel),
    ["gpt-5.6-sol"],
  );
});

test("model select menu escapes settings clipping and flips above a short viewport", () => {
  const layout = getModelSelectMenuLayout(
    { left: 580, top: 558, bottom: 600, width: 254 },
    1280,
    720,
    "bottom",
    false,
  );

  assert.deepEqual(layout, {
    direction: "top",
    left: 580,
    width: 254,
    bottom: 170,
  });
});

test("model select menu keeps its preferred lower placement when space is available", () => {
  const layout = getModelSelectMenuLayout(
    { left: 48, top: 72, bottom: 114, width: 420 },
    1280,
    720,
    "bottom",
    false,
  );

  assert.deepEqual(layout, {
    direction: "bottom",
    left: 48,
    width: 420,
    top: 122,
  });
});

test("prompt analysis tasks prefer the configured analysis model over the background model", () => {
  const utilSource = readFileSync("src/electron/libs/util.ts", "utf8");
  const commitMessageSource = readFileSync("src/electron/libs/git/commit-message.ts", "utf8");

  assert.match(utilSource, /currentApiConfig\.analysisModel\?\.trim\(\) \|\| currentApiConfig\.smallModel\?\.trim\(\)/);
  assert.match(commitMessageSource, /currentApiConfig\.analysisModel\?\.trim\(\) \|\| currentApiConfig\.smallModel\?\.trim\(\)/);
  assert.match(utilSource, /resolveApiConfigForModel\(requestedModel\)/);
  assert.match(commitMessageSource, /resolveApiConfigForModel\(requestedModel\)/);
  assert.match(utilSource, /buildEnvForConfig\(apiConfig, routedModel\)/);
  assert.match(commitMessageSource, /buildEnvForConfig\(apiConfig, routedModel\)/);
  assert.match(utilSource, /purpose: "session-title"/);
  assert.match(commitMessageSource, /purpose: "commit-message"/);
});

test("model select ranks direct group matches ahead of loose fuzzy matches", () => {
  const groups = buildGroupedModelOptions([
    "gpt-5-codex-openai-compact",
    "deepseek-v4-pro",
  ], "dee");
  assert.equal(groups[0]?.id, "deepseek");
  assert.equal(groups[0]?.options[0]?.value, "deepseek-v4-pro");
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
  const promptFooterSource = readFileSync("src/ui/components/prompt-input/PromptComposerFooter.tsx", "utf8");
  const modelSelectSource = readFileSync("src/ui/components/models/ModelSelect.tsx", "utf8");
  const composerModelMenuSource = readFileSync("src/ui/components/prompt-input/ComposerModelMenu.tsx", "utf8");

  assert.match(promptFooterSource, /import \{ ComposerModelMenu \} from "\.\/ComposerModelMenu"/);
  assert.match(promptInputSource, /getAutomaticRoutedModelOptionsForProfiles/);
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
    "first-extra",
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
  assert.equal(resolveAvailableModelName("minimax-m3", availableModels), "MiniMax-M3");
  assert.equal(resolveAvailableModelName("MiniMax-M3", availableModels), "MiniMax-M3");
  assert.equal(resolveAvailableModelName("minimax-m3", ["MiniMax-M3"]), "MiniMax-M3");

  const options = getRoutedModelOptionsForProfiles(getEnabledProfiles(profiles));
  const officialOption = options.find((option) => option.value === "MiniMax-M3");
  const gatewayOption = options.find((option) => option.value === "minimax-m3");
  assert.equal(officialOption?.profileId, "official-minimax");
  assert.equal(officialOption?.provider, "minimax");
  assert.equal(officialOption?.contextWindow, 1_000_000);
  assert.equal(gatewayOption, undefined);

  const deploymentOptions = getModelDeploymentOptionsForProfiles(getEnabledProfiles(profiles));
  assert.equal(deploymentOptions.find((option) => option.value === "minimax-m3")?.profileId, "gateway");
});

test("automatic routing excludes managed models that are not assigned to a route slot", () => {
  const profile = {
    id: "minimax",
    name: "MiniMax Official",
    apiKey: "sk-cp-test",
    baseURL: "https://api.minimaxi.com/anthropic",
    model: "MiniMax-M2.7",
    expertModel: "MiniMax-M2.7",
    smallModel: "MiniMax-M2.7",
    analysisModel: "MiniMax-M2.7",
    models: [
      { name: "MiniMax-M2.7" },
      { name: "MiniMax-M3", routingWeight: 100 },
    ],
    enabled: true,
    provider: "minimax" as const,
    apiType: "anthropic" as const,
  };

  const catalogOptions = getRoutedModelOptionsForProfiles([profile]);
  const automaticOptions = getAutomaticRoutedModelOptionsForProfiles([profile]);
  assert.equal(catalogOptions.some((option) => option.value === "MiniMax-M3"), true);
  assert.equal(automaticOptions.some((option) => option.value === "MiniMax-M3"), false);
  assert.deepEqual(automaticOptions.map((option) => option.value), ["MiniMax-M2.7"]);
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
  assert.match(settingsPageSource, /inferModelCapabilities/);
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

test("imageGenerationModel persists, normalizes, and clears independently from imageModel", () => {
  const profiles = [
    {
      id: "gateway",
      name: "Gateway",
      apiKey: "sk-test",
      baseURL: "https://example.com/v1",
      model: "gpt-image-2",
      expertModel: "gpt-image-2",
      smallModel: "gpt-image-2",
      imageModel: "gemini-3-pro-image-preview",
      imageGenerationModel: "gpt-image-2",
      analysisModel: "gpt-image-2",
      models: [{ name: "gpt-image-2" }, { name: "gemini-3-pro-image-preview" }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const state = buildSharedModelRoutingState(profiles);
  assert.equal(state.imageGenerationModel, "gpt-image-2");
  assert.equal(state.imageModel, "gemini-3-pro-image-preview");
  assert.notEqual(state.imageGenerationModel, state.imageModel);

  const normalized = normalizeProfile(profiles[0]);
  assert.equal(normalized.imageGenerationModel, "gpt-image-2");
  assert.equal(normalizeProfile({ ...profiles[0], imageGenerationModel: undefined }).imageGenerationModel, undefined);

  const legacy = normalizeProfile({
    id: "legacy",
    name: "Legacy",
    apiKey: "sk-test",
    baseURL: "https://example.com/v1",
    model: "gpt-image-2",
    expertModel: "gpt-image-2",
    smallModel: "gpt-image-2",
    analysisModel: "gpt-image-2",
    models: [{ name: "gpt-image-2" }],
    enabled: true,
    provider: "custom" as const,
    apiType: "anthropic" as const,
  });
  assert.equal(legacy.imageGenerationModel, undefined);
  assert.equal(legacy.imageModel, undefined);

  const cleared = applySharedModelRoutingPatch(profiles, { imageGenerationModel: "" });
  assert.equal(cleared[0]?.imageGenerationModel, undefined);
  assert.equal(cleared[0]?.imageModel, "gemini-3-pro-image-preview");
});

test("shared model routing switches to a compatible role gateway without changing the main model", () => {
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
      models: [{ name: "deepseek-v4-flash" }, { name: "deepseek-v4-pro" }, { name: "GLM-5.1-FP8", routingWeight: 10 }, { name: "gpt-5.4" }],
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
  assert.deepEqual(state.roleModels, [
    "gpt-5.4",
    "gpt-5.3-codex-spark",
    "deepseek-v4-flash",
    "deepseek-v4-pro",
    "GLM-5.1-FP8",
  ]);

  const nextProfiles = applySharedModelRoutingPatch(profiles, { smallModel: "GLM-5.1-FP8" });
  assert.deepEqual(nextProfiles.map((profile) => profile.id), ["default", "codex"]);
  assert.equal(nextProfiles[0]?.model, "gpt-5.4");
  assert.equal(nextProfiles[0]?.expertModel, "gpt-5.4");
  assert.equal(nextProfiles[0]?.smallModel, "GLM-5.1-FP8");
  assert.equal(nextProfiles[1]?.smallModel, "gpt-5.3-codex-spark");
  assert.equal(nextProfiles[0]?.models?.find((model) => model.name === "GLM-5.1-FP8")?.routingWeight, 10);
  assert.equal(nextProfiles[1]?.models?.find((model) => model.name === "gpt-5.4")?.routingWeight, 25);
  assert.equal(buildSharedModelRoutingState(nextProfiles).roleProfileId, "default");

  const withoutImageModels = applySharedModelRoutingPatch(nextProfiles, { imageModel: "" });
  assert.equal(withoutImageModels[0]?.imageModel, undefined);
  assert.equal(withoutImageModels[1]?.imageModel, undefined);

  const withImageGenerationModels = applySharedModelRoutingPatch(nextProfiles, { imageGenerationModel: "GLM-5.1-FP8" });
  assert.equal(withImageGenerationModels[0]?.imageGenerationModel, "GLM-5.1-FP8");
  assert.equal(withImageGenerationModels[1]?.imageGenerationModel, undefined);

  const withoutImageGenerationModels = applySharedModelRoutingPatch(withImageGenerationModels, { imageGenerationModel: "" });
  assert.equal(withoutImageGenerationModels[0]?.imageGenerationModel, undefined);
  assert.equal(withoutImageGenerationModels[1]?.imageGenerationModel, undefined);

  const withForeignExpert = applySharedModelRoutingPatch(nextProfiles, { expertModel: "GLM-5.1-FP8" });
  assert.equal(withForeignExpert[0]?.expertModel, "GLM-5.1-FP8");
  assert.equal(withForeignExpert[1]?.expertModel, "gpt-5.4");
  assert.equal(validateProfiles(withForeignExpert.map(normalizeProfile)), null);

  const withGatewayMain = applySharedModelRoutingPatch(nextProfiles, { model: "GLM-5.1-FP8" });
  assert.deepEqual(withGatewayMain.map((profile) => profile.id), ["default", "codex"]);
  const gatewayState = buildSharedModelRoutingState(withGatewayMain);
  assert.equal(gatewayState.mainModel, "GLM-5.1-FP8");
  assert.deepEqual(gatewayState.roleModels, ["GLM-5.1-FP8", "gpt-5.4", "deepseek-v4-flash", "deepseek-v4-pro"]);
  assert.equal(validateProfiles(withGatewayMain.map(normalizeProfile)), null);
});

test("Prompt analysis options display the highest-weight gateway independently", () => {
  const profiles = [
    {
      id: "boke",
      name: "波克网关",
      apiKey: "sk-boke",
      baseURL: "https://ai.pocketcity.com/v1",
      model: "gpt-5.6-terra",
      expertModel: "gpt-5.6-terra",
      smallModel: "deepseek-v4-flash",
      analysisModel: "MiniMax-M3",
      models: [
        { name: "gpt-5.6-terra" },
        { name: "deepseek-v4-flash" },
        { name: "MiniMax-M3", routingWeight: 0 },
      ],
      enabled: true,
      provider: "boke" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "minimax",
      name: "MiniMax 官方",
      apiKey: "sk-minimax",
      baseURL: "https://api.minimaxi.com/anthropic",
      model: "MiniMax-M2.7",
      expertModel: "MiniMax-M2.7",
      smallModel: "MiniMax-M2.7-highspeed",
      analysisModel: "MiniMax-M2.7",
      models: [
        { name: "MiniMax-M2.7" },
        { name: "MiniMax-M2.7-highspeed" },
        { name: "MiniMax-M3", routingWeight: 100 },
      ],
      enabled: true,
      provider: "minimax" as const,
      apiType: "anthropic" as const,
    },
  ];

  const state = buildSharedModelRoutingState(profiles);
  const option = state.analysisModelOptions.find((item) => item.value === "MiniMax-M3");

  assert.equal(state.analysisModel, "MiniMax-M3");
  assert.equal(option?.profileId, "minimax");
  assert.equal(option?.routingWeight, 100);
  assert.match(option?.routeLabel ?? "", /MiniMax 官方/);
});

test("model deployment options keep same-name gateway and Codex routes separate", () => {
  const profiles = [
    {
      id: "gateway",
      name: "Boke Gateway",
      apiKey: "sk-gateway",
      baseURL: "https://ai.pocketcity.com/v1",
      model: "gpt-5.6-terra",
      models: [{ name: "gpt-5.6-terra", routingWeight: 0 }],
      enabled: true,
      provider: "boke" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "codex",
      name: "Codex OAuth",
      apiKey: "{}",
      baseURL: "https://chatgpt.com",
      model: "gpt-5.6-terra",
      models: [{ name: "gpt-5.6-terra", routingWeight: 10 }],
      enabled: true,
      provider: "codex" as const,
      apiType: "anthropic" as const,
    },
  ];

  const deployments = getModelDeploymentOptionsForProfiles(profiles);
  assert.deepEqual(deployments.map((option) => option.profileId), ["gateway", "codex"]);
  assert.equal(new Set(deployments.map((option) => option.deploymentKey)).size, 2);
  assert.deepEqual(deployments.map((option) => option.value), ["gpt-5.6-terra", "gpt-5.6-terra"]);
});

test("profile normalization repairs legacy role slots to locally managed models", () => {
  const normalized = normalizeProfile({
    id: "legacy",
    name: "Legacy gateway",
    apiKey: "sk-test",
    baseURL: "https://example.com/v1",
    model: "foreign-main",
    expertModel: "foreign-expert",
    smallModel: "foreign-small",
    analysisModel: "foreign-analysis",
    imageModel: "foreign-vision",
    imageGenerationModel: "foreign-image-generation",
    models: [{ name: "local-model", catalogStatus: "managed", contextWindow: 128_000 }],
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
  });

  assert.equal(normalized.model, "local-model");
  assert.equal(normalized.expertModel, "local-model");
  assert.equal(normalized.smallModel, "local-model");
  assert.equal(normalized.analysisModel, "local-model");
  assert.equal(normalized.imageModel, undefined);
  assert.equal(normalized.imageGenerationModel, undefined);
  assert.equal(validateProfiles([normalized]), null);
});

test("official profile normalization drops provider-incompatible historical shared-catalog copies", () => {
  const normalized = normalizeProfile({
    id: "legacy-codex",
    name: "Codex OAuth",
    apiKey: "{}",
    baseURL: "https://chatgpt.com",
    model: "gpt-5.5",
    expertModel: "foreign-model",
    smallModel: "foreign-model",
    analysisModel: "foreign-model",
    models: [
      { name: "gpt-5.5", contextWindow: 200_000 },
      { name: "foreign-model", contextWindow: 200_000 },
    ],
    enabled: true,
    provider: "codex",
    apiType: "anthropic",
  });

  assert.deepEqual(normalized.models?.map((model) => model.name), ["gpt-5.5"]);
  assert.equal(normalized.expertModel, "gpt-5.5");
  assert.equal(normalized.smallModel, "gpt-5.5");
  assert.equal(normalized.analysisModel, "gpt-5.5");
});

test("image routing candidates use the same explicit capability aliases as the model catalog", () => {
  const profiles = [{
    id: "gateway",
    name: "Gateway",
    apiKey: "sk-test",
    baseURL: "https://example.com/v1",
    model: "opaque-text-model",
    expertModel: "opaque-text-model",
    smallModel: "opaque-text-model",
    analysisModel: "opaque-text-model",
    models: [
      { name: "opaque-text-model", catalogStatus: "managed" as const },
      { name: "opaque-vision-model", catalogStatus: "managed" as const, supportedEndpointTypes: ["openai", "vision"] },
      { name: "opaque-multimodal-model", catalogStatus: "managed" as const, supportedEndpointTypes: ["multimodal"] },
      { name: "opaque-understanding-model", catalogStatus: "managed" as const, supportedEndpointTypes: ["image-understanding"] },
      { name: "opaque-images-model", catalogStatus: "managed" as const, supportedEndpointTypes: ["openai", "images"] },
      { name: "opaque-generation-model", catalogStatus: "managed" as const, supportedEndpointTypes: ["image-generation"] },
    ],
    enabled: true,
    provider: "custom" as const,
    apiType: "anthropic" as const,
  }];

  assert.deepEqual(getImageUnderstandingModelsForProfiles(profiles), [
    "opaque-vision-model",
    "opaque-multimodal-model",
    "opaque-understanding-model",
  ]);
  assert.deepEqual(getImageGenerationModelsForProfiles(profiles), [
    "opaque-images-model",
    "opaque-generation-model",
  ]);
});

test("image capability routing follows the weighted deployment owner for duplicate model IDs", () => {
  const profiles = [
    {
      id: "text-owner",
      name: "Text owner",
      apiKey: "sk-a",
      baseURL: "https://a.example/v1",
      model: "opaque-shared-model",
      models: [{
        name: "opaque-shared-model",
        catalogStatus: "managed" as const,
        routingWeight: 20,
        supportedEndpointTypes: ["openai"],
      }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
    {
      id: "vision-owner",
      name: "Vision owner",
      apiKey: "sk-b",
      baseURL: "https://b.example/v1",
      model: "opaque-shared-model",
      models: [{
        name: "opaque-shared-model",
        catalogStatus: "managed" as const,
        routingWeight: 10,
        supportedEndpointTypes: ["vision"],
      }],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  assert.deepEqual(getImageUnderstandingModelsForProfiles(profiles), []);

  profiles[1]!.models[0]!.routingWeight = 30;
  assert.deepEqual(getImageUnderstandingModelsForProfiles(profiles), ["opaque-shared-model"]);
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
      imageGenerationModel: "gpt-image-2",
      models: [
        { name: "DeepSeek-V4-Pro" },
        { name: "gpt-5.5" },
        { name: "MiniMax-M3" },
        { name: "gemini-3.1-pro-preview" },
        { name: "gpt-image-2" },
      ],
      enabled: true,
      provider: "custom" as const,
      apiType: "anthropic" as const,
    },
  ];

  const state = buildSharedModelRoutingState(profiles);

  assert.equal(state.imageModel, "gemini-3.1-pro-preview");
  assert.equal(state.imageGenerationModel, "gpt-image-2");
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
