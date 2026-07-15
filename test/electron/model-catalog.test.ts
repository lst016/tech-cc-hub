import test from "node:test";
import assert from "node:assert/strict";
import {
  applyModelCatalogBulkAction,
  buildModelCatalogEntries,
  createModelDeploymentKey,
  filterModelCatalogEntries,
  inferModelCapabilities,
  normalizeModelCatalogTagsDraft,
  normalizeModelCatalogTextDraft,
  updateModelCatalogEntry,
} from "../../src/ui/components/settings/model-catalog-utils.js";
import type { ApiConfigProfile, ApiModelConfigProfile } from "../../src/ui/types.js";

function createProfile(
  id: string,
  models: ApiModelConfigProfile[],
  overrides: Partial<ApiConfigProfile> = {},
): ApiConfigProfile {
  const primaryModel = models[0]?.name ?? "";
  return {
    id,
    name: `Gateway ${id}`,
    apiKey: `key-${id}`,
    baseURL: `https://${id}.example.com/v1`,
    model: primaryModel,
    expertModel: primaryModel,
    smallModel: primaryModel,
    analysisModel: primaryModel,
    models,
    enabled: true,
    provider: "custom",
    apiType: "anthropic",
    ...overrides,
  };
}

test("deployment keys isolate the same upstream model across gateways", () => {
  assert.equal(createModelDeploymentKey("gateway-a", "shared/model"), "gateway-a\0shared/model");
  assert.notEqual(
    createModelDeploymentKey("gateway-a", "shared/model"),
    createModelDeploymentKey("gateway-b", "shared/model"),
  );
});

test("catalog entries treat every non-excluded status as managed", () => {
  const entries = buildModelCatalogEntries([
    createProfile("gateway-a", [
      { name: "legacy-model" },
      { name: "discovered-model", catalogStatus: "discovered" },
      { name: "excluded-model", catalogStatus: "excluded" },
    ]),
  ]);

  assert.equal(entries.find((entry) => entry.modelName === "legacy-model")?.managed, true);
  assert.equal(entries.find((entry) => entry.modelName === "discovered-model")?.catalogStatus, "managed");
  assert.equal(entries.find((entry) => entry.modelName === "discovered-model")?.managed, true);
  assert.equal(entries.find((entry) => entry.modelName === "discovered-model")?.routeState, "available");
  assert.equal(entries.find((entry) => entry.modelName === "excluded-model")?.managed, false);
});

test("catalog route state defaults every enabled non-excluded deployment to available", () => {
  const entries = buildModelCatalogEntries([
    createProfile("gateway-a", [
      { name: "assigned-model", catalogStatus: "managed" },
      { name: "default-available-model", catalogStatus: "managed" },
      { name: "excluded-model", catalogStatus: "excluded" },
    ], {
      model: "assigned-model",
      expertModel: "assigned-model",
      smallModel: "assigned-model",
      analysisModel: "assigned-model",
    }),
    createProfile("gateway-b", [
      { name: "disabled-model", catalogStatus: "managed" },
    ], {
      enabled: false,
    }),
  ]);

  assert.equal(entries.find((entry) => entry.modelName === "assigned-model")?.routeState, "assigned");
  assert.equal(entries.find((entry) => entry.modelName === "default-available-model")?.routeState, "available");
  assert.equal(entries.find((entry) => entry.modelName === "excluded-model")?.routeState, "excluded");
  assert.equal(entries.find((entry) => entry.modelName === "disabled-model")?.routeState, "gateway-disabled");
});

test("catalog entries expose the effective default routing weight without mutating profiles", () => {
  const profile = createProfile("gateway-a", [{ name: "unweighted-model" }]);
  const [entry] = buildModelCatalogEntries([profile]);

  assert.equal(entry?.routingWeight, 0);
  assert.equal(profile.models?.[0]?.routingWeight, undefined);
});

test("endpoint metadata wins over name fallback when inferring capabilities", () => {
  assert.deepEqual(inferModelCapabilities({
    name: "text-embedding-3-large",
    supportedEndpointTypes: ["image-generation"],
  }), ["image-generation"]);

  assert.deepEqual(inferModelCapabilities({ name: "text-embedding-3-large" }), ["embedding"]);
  assert.deepEqual(inferModelCapabilities({
    name: "text-embedding-3-large",
    supportedEndpointTypes: ["openai"],
  }), ["embedding"]);
  assert.deepEqual(inferModelCapabilities({ name: "gpt-image-1" }), ["image-generation"]);
});

test("catalog capability inference recognizes multimodal model families without upstream metadata", () => {
  for (const name of [
    "gpt-5.6-sol",
    "gpt-5.6-terra",
    "gpt-5.6-luna-openai-compact",
    "gpt-5.5",
    "gpt-5.4-mini",
    "gpt-4.1",
    "gpt-4o-mini",
    "gemini-3.1-pro-preview",
    "claude-opus-4-6",
  ]) {
    assert.deepEqual(
      inferModelCapabilities({ name, supportedEndpointTypes: [] }),
      ["image-understanding"],
      name,
    );
  }
});

test("catalog query and facets are combined with AND semantics", () => {
  const entries = buildModelCatalogEntries([
    createProfile("gateway-a", [
      {
        name: "vision-pro",
        alias: "Vision Primary",
        ownedBy: "openai",
        supportedEndpointTypes: ["vision"],
      },
      {
        name: "vision-excluded",
        ownedBy: "openai",
        supportedEndpointTypes: ["vision"],
        catalogStatus: "excluded",
      },
    ]),
    createProfile("gateway-b", [
      {
        name: "vision-pro",
        ownedBy: "google",
        supportedEndpointTypes: ["vision"],
      },
    ]),
  ]);

  const filtered = filterModelCatalogEntries(entries, {
    query: "primary",
    profileId: "gateway-a",
    ownedBy: "openai",
    capability: "image-understanding",
    managed: true,
  });

  assert.deepEqual(filtered.map((entry) => entry.key), [
    createModelDeploymentKey("gateway-a", "vision-pro"),
  ]);
});

test("bulk manage and exclude are immutable and scoped by deployment key", () => {
  const profiles = [
    createProfile("gateway-a", [
      { name: "shared/model", catalogStatus: "managed" },
      { name: "fallback-a", catalogStatus: "managed" },
    ], {
      model: "fallback-a",
      expertModel: "fallback-a",
      smallModel: "fallback-a",
      analysisModel: "fallback-a",
    }),
    createProfile("gateway-b", [
      { name: "shared/model", catalogStatus: "excluded" },
      { name: "fallback-b", catalogStatus: "managed" },
    ], {
      model: "fallback-b",
      expertModel: "fallback-b",
      smallModel: "fallback-b",
      analysisModel: "fallback-b",
    }),
  ];
  const original = structuredClone(profiles);

  const managed = applyModelCatalogBulkAction(
    profiles,
    [createModelDeploymentKey("gateway-b", "shared/model")],
    "manage",
  );

  assert.deepEqual(profiles, original);
  assert.deepEqual(managed.blockedKeys, []);
  assert.equal(managed.profiles[0]?.models?.[0]?.catalogStatus, "managed");
  assert.equal(managed.profiles[1]?.models?.[0]?.catalogStatus, "managed");

  const excluded = applyModelCatalogBulkAction(
    managed.profiles,
    [createModelDeploymentKey("gateway-a", "shared/model")],
    "exclude",
  );

  assert.deepEqual(excluded.blockedKeys, []);
  assert.equal(excluded.profiles[0]?.models?.[0]?.catalogStatus, "excluded");
  assert.equal(excluded.profiles[1]?.models?.[0]?.catalogStatus, "managed");
});

test("excluding a model used by any routing slot is blocked", () => {
  const profile = createProfile("gateway-a", [
    { name: "routed-model", catalogStatus: "managed" },
    { name: "fallback-model", catalogStatus: "managed" },
  ], {
    model: "fallback-model",
    expertModel: "routed-model",
    smallModel: "fallback-model",
    analysisModel: "routed-model",
    imageModel: "routed-model",
    imageGenerationModel: "fallback-model",
  });
  const key = createModelDeploymentKey(profile.id, "routed-model");
  const result = applyModelCatalogBulkAction([profile], [key], "exclude");

  assert.deepEqual(result.blockedKeys, [key]);
  assert.deepEqual(result.profiles, [profile]);
  assert.equal(result.profiles[0]?.models?.[0]?.catalogStatus, "managed");
});

test("bulk exclusion applies free deployments while retaining routed deployments", () => {
  const profile = createProfile("gateway-a", [
    { name: "routed-model", catalogStatus: "managed" },
    { name: "free-model", catalogStatus: "managed" },
  ], {
    model: "routed-model",
    expertModel: "routed-model",
    smallModel: "routed-model",
    analysisModel: "routed-model",
  });
  const routedKey = createModelDeploymentKey(profile.id, "routed-model");
  const freeKey = createModelDeploymentKey(profile.id, "free-model");
  const result = applyModelCatalogBulkAction([profile], [routedKey, freeKey], "exclude");

  assert.deepEqual(result.blockedKeys, [routedKey]);
  assert.equal(result.profiles[0]?.models?.[0]?.catalogStatus, "managed");
  assert.equal(result.profiles[0]?.models?.[1]?.catalogStatus, "excluded");
});

test("detail draft normalization preserves internal spaces and cleans delimiters on commit", () => {
  assert.equal(normalizeModelCatalogTextDraft("  GPT 5.5 Primary  "), "GPT 5.5 Primary");
  assert.equal(normalizeModelCatalogTextDraft("   "), undefined);
  assert.deepEqual(
    normalizeModelCatalogTagsDraft(" flagship, reasoning, , flagship，vision， "),
    ["flagship", "reasoning", "vision"],
  );
  assert.equal(normalizeModelCatalogTagsDraft(" , ， "), undefined);
});

test("detail patches preserve discovery metadata and routing assignments", () => {
  const profile = createProfile("gateway-a", [{
    name: "openai/gpt-5.5",
    contextWindow: 128_000,
    routingWeight: 40,
    ownedBy: "openai",
    supportedEndpointTypes: ["openai", "openai-response"],
    createdAt: 1_752_470_400,
    catalogStatus: "managed",
  }], {
    model: "openai/gpt-5.5",
    expertModel: "openai/gpt-5.5",
    analysisModel: "openai/gpt-5.5",
  });
  const key = createModelDeploymentKey(profile.id, "openai/gpt-5.5");

  const updated = updateModelCatalogEntry([profile], key, {
    alias: "GPT 5.5",
    tags: ["flagship", "reasoning"],
    contextWindow: 200_000,
    routingWeight: 75,
  });

  assert.notStrictEqual(updated[0], profile);
  assert.deepEqual(updated[0]?.models?.[0], {
    name: "openai/gpt-5.5",
    alias: "GPT 5.5",
    tags: ["flagship", "reasoning"],
    contextWindow: 200_000,
    routingWeight: 75,
    ownedBy: "openai",
    supportedEndpointTypes: ["openai", "openai-response"],
    createdAt: 1_752_470_400,
    catalogStatus: "managed",
  });
  assert.equal(updated[0]?.model, "openai/gpt-5.5");
  assert.equal(updated[0]?.expertModel, "openai/gpt-5.5");
  assert.equal(updated[0]?.analysisModel, "openai/gpt-5.5");

  const [entry] = buildModelCatalogEntries(updated);
  assert.deepEqual(entry?.routeSlots, ["model", "expertModel", "smallModel", "analysisModel"]);
});
