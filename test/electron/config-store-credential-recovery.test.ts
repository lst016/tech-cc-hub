import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { app } from "electron";
import {
  loadApiConfigSettings,
  mergeRendererApiConfigSettings,
  redactApiConfigSettingsForRenderer,
  saveApiConfigSettings,
} from "../../src/electron/libs/config-store.js";
import { CODEX_OAUTH_STORED_CREDENTIAL } from "../../src/shared/codex-oauth.js";
import {
  getEnabledUsableApiConfigs,
  resolveApiConfigForModel,
} from "../../src/electron/libs/claude/claude-settings.js";

test("an unreadable Codex safeStorage value does not hide every API profile", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-credential-recovery-${Date.now()}`);
  const unreadableCredential = "safe-storage:v1:not-valid-ciphertext";
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "codex-profile",
        name: "Codex OAuth",
        apiKey: unreadableCredential,
        baseURL: "https://chatgpt.com",
        model: "gpt-5.5",
        enabled: true,
        provider: "codex",
        apiType: "anthropic",
        models: [{ name: "gpt-5.5" }],
      },
      {
        id: "custom-profile",
        name: "Custom",
        apiKey: "custom-secret",
        baseURL: "https://example.test/v1",
        model: "example-model",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [{ name: "example-model" }],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const loaded = loadApiConfigSettings();
    assert.deepEqual(loaded.profiles.map((profile) => profile.id), ["codex-profile", "custom-profile"]);
    assert.equal(loaded.profiles[0]!.apiKey, unreadableCredential);
    assert.deepEqual(getEnabledUsableApiConfigs().map((profile) => profile.id), ["custom-profile"]);
    assert.equal(resolveApiConfigForModel("gpt-5.5", "codex-profile"), null);

    const rendererSettings = redactApiConfigSettingsForRenderer(loaded);
    assert.equal(rendererSettings.profiles[0]!.apiKey, CODEX_OAUTH_STORED_CREDENTIAL);

    rendererSettings.profiles[1]!.name = "Renamed Custom";
    saveApiConfigSettings(mergeRendererApiConfigSettings(rendererSettings, loaded));
    const persisted = JSON.parse(readFileSync(join(root, "api-config.json"), "utf8")) as {
      profiles: Array<{ id: string; apiKey: string }>;
    };
    assert.equal(persisted.profiles.find((profile) => profile.id === "codex-profile")?.apiKey, unreadableCredential);
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("an explicit profile keeps same-name gateway and Codex deployments independently routable", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-deployment-routing-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "boke-profile",
        name: "Boke Gateway",
        apiKey: "boke-secret",
        baseURL: "https://ai.pocketcity.com/v1",
        model: "gpt-5.6-terra",
        enabled: true,
        provider: "boke",
        apiType: "anthropic",
        models: [{ name: "gpt-5.6-terra", routingWeight: 0 }],
      },
      {
        id: "codex-profile",
        name: "Codex OAuth",
        apiKey: "{\"access_token\":\"test\"}",
        baseURL: "https://chatgpt.com",
        model: "gpt-5.6-terra",
        enabled: true,
        provider: "codex",
        apiType: "anthropic",
        models: [{ name: "gpt-5.6-terra", routingWeight: 10 }],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    assert.equal(resolveApiConfigForModel("gpt-5.6-terra")?.config.id, "codex-profile");
    assert.equal(resolveApiConfigForModel("gpt-5.6-terra", "boke-profile")?.config.id, "boke-profile");
    assert.equal(resolveApiConfigForModel("gpt-5.6-terra", "codex-profile")?.config.id, "codex-profile");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("MiniMax routing wins when a gateway returns the same model with different casing", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-minimax-routing-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "gateway-profile",
        name: "Default Gateway",
        apiKey: "gateway-secret",
        baseURL: "https://gateway.example.com/v1",
        model: "minimax-m3",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [{ name: "minimax-m3", routingWeight: 0 }],
      },
      {
        id: "minimax-profile",
        name: "MiniMax Official",
        apiKey: "minimax-secret",
        baseURL: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M3",
        enabled: true,
        provider: "minimax",
        apiType: "anthropic",
        models: [{ name: "MiniMax-M3", routingWeight: 100 }],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const resolved = resolveApiConfigForModel("minimax-m3");
    assert.equal(resolved?.config.id, "minimax-profile");
    assert.equal(resolved?.model, "MiniMax-M3");

    const explicitlyPinned = resolveApiConfigForModel("minimax-m3", "gateway-profile");
    assert.equal(explicitlyPinned?.config.id, "gateway-profile");
    assert.equal(explicitlyPinned?.model, "minimax-m3");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unassigned managed MiniMax model does not enter automatic routing", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-minimax-unassigned-routing-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "gateway-profile",
        name: "Default Gateway",
        apiKey: "gateway-secret",
        baseURL: "https://gateway.example.com/v1",
        model: "gateway-main",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [{ name: "gateway-main", routingWeight: 0 }],
      },
      {
        id: "minimax-profile",
        name: "MiniMax Official",
        apiKey: "minimax-secret",
        baseURL: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M2.7",
        enabled: true,
        provider: "minimax",
        apiType: "anthropic",
        models: [
          { name: "MiniMax-M2.7", routingWeight: 0 },
          { name: "MiniMax-M3", routingWeight: 100 },
        ],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const automaticResolution = resolveApiConfigForModel("MiniMax-M3");
    assert.equal(automaticResolution?.config.id, "gateway-profile");
    assert.equal(automaticResolution?.model, "gateway-main");
    assert.equal(automaticResolution?.fellBack, true);

    const explicitlyPinned = resolveApiConfigForModel("MiniMax-M3", "minimax-profile");
    assert.equal(explicitlyPinned?.config.id, "minimax-profile");
    assert.equal(explicitlyPinned?.model, "MiniMax-M3");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("an assigned Prompt model routes to the highest-weight catalog owner", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-minimax-prompt-routing-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "gateway-profile",
        name: "Boke Gateway",
        apiKey: "gateway-secret",
        baseURL: "https://ai.pocketcity.com/v1",
        model: "gpt-5.6-terra",
        analysisModel: "MiniMax-M3",
        enabled: true,
        provider: "boke",
        apiType: "anthropic",
        models: [
          { name: "gpt-5.6-terra", routingWeight: 0 },
          { name: "MiniMax-M3", routingWeight: 0 },
        ],
      },
      {
        id: "minimax-profile",
        name: "MiniMax Official",
        apiKey: "minimax-secret",
        baseURL: "https://api.minimaxi.com/anthropic",
        model: "MiniMax-M2.7",
        analysisModel: "MiniMax-M2.7",
        enabled: true,
        provider: "minimax",
        apiType: "anthropic",
        models: [
          { name: "MiniMax-M2.7", routingWeight: 0 },
          { name: "MiniMax-M3", routingWeight: 100 },
        ],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const resolved = resolveApiConfigForModel("MiniMax-M3");
    assert.equal(resolved?.config.id, "minimax-profile");
    assert.equal(resolved?.model, "MiniMax-M3");
    assert.equal(resolved?.fellBack, false);
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy Boke gateway config migrates by domain and preserves catalog metadata", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-boke-config-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [{
      id: "boke-profile",
      name: "波克网关",
      apiKey: "boke-secret",
      baseURL: "https://ai.pocketcity.com/v1",
      model: "openai/gpt-5.5",
      enabled: true,
      provider: "custom",
      apiType: "anthropic",
      models: [{
        name: "openai/gpt-5.5",
        catalogStatus: "managed",
        alias: "GPT 5.5",
        tags: ["旗舰", "推理"],
        notes: "波克主模型",
        routingWeight: 80,
        ownedBy: "openai",
        supportedEndpointTypes: ["openai", "openai-response"],
        createdAt: 1_752_470_400,
      }],
    }],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const loaded = loadApiConfigSettings();
    assert.equal(loaded.profiles[0]?.provider, "boke");
    assert.equal(loaded.profiles[0]?.apiType, "anthropic");
    assert.equal(loaded.profiles[0]?.models?.[0]?.ownedBy, "openai");
    assert.deepEqual(loaded.profiles[0]?.models?.[0]?.supportedEndpointTypes, ["openai", "openai-response"]);
    assert.equal(loaded.profiles[0]?.models?.[0]?.catalogStatus, "managed");
    assert.equal(loaded.profiles[0]?.models?.[0]?.alias, "GPT 5.5");
    assert.deepEqual(loaded.profiles[0]?.models?.[0]?.tags, ["旗舰", "推理"]);
    assert.equal(loaded.profiles[0]?.models?.[0]?.notes, "波克主模型");
    assert.equal(loaded.profiles[0]?.models?.[0]?.routingWeight, 80);

    saveApiConfigSettings(loaded);
    const reloaded = loadApiConfigSettings();
    assert.equal(reloaded.profiles[0]?.provider, "boke");
    assert.equal(reloaded.profiles[0]?.models?.[0]?.createdAt, 1_752_470_400);
    assert.equal(reloaded.profiles[0]?.models?.[0]?.catalogStatus, "managed");
    assert.equal(reloaded.profiles[0]?.models?.[0]?.alias, "GPT 5.5");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("loading API settings auto-manages discovered models and preserves manual exclusions", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-default-managed-catalog-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [{
      id: "default-managed-catalog",
      name: "Default managed catalog",
      apiKey: "catalog-secret",
      baseURL: "https://catalog.example/v1",
      model: "text-model",
      enabled: true,
      provider: "custom",
      apiType: "anthropic",
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
    }],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const [profile] = loadApiConfigSettings().profiles;
    assert.equal(
      profile?.models?.find((model) => model.name === "doubao-seedream-5-0-pro-260628")?.catalogStatus,
      "managed",
    );
    assert.equal(
      profile?.models?.find((model) => model.name === "excluded-image-model")?.catalogStatus,
      "excluded",
    );
    assert.equal(resolveApiConfigForModel("doubao-seedream-5-0-pro-260628")?.config.id, profile?.id);
    const excludedResolution = resolveApiConfigForModel("excluded-image-model");
    assert.equal(excludedResolution?.fellBack, true);
    assert.equal(excludedResolution?.model, "text-model");

    saveApiConfigSettings({ profiles: [profile!] });
    const persisted = JSON.parse(readFileSync(join(root, "api-config.json"), "utf8")) as {
      profiles: Array<{ models?: Array<{ name: string; catalogStatus?: string }> }>;
    };
    assert.equal(
      persisted.profiles[0]?.models?.find((model) => model.name === "doubao-seedream-5-0-pro-260628")?.catalogStatus,
      "managed",
    );
    assert.equal(
      persisted.profiles[0]?.models?.find((model) => model.name === "excluded-image-model")?.catalogStatus,
      "excluded",
    );
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("an excluded main model stays excluded and routing falls back to a non-excluded model", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-excluded-main-model-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [{
      id: "manual-exclusion-profile",
      name: "Manual exclusion profile",
      apiKey: "manual-exclusion-secret",
      baseURL: "https://manual-exclusion.example/v1",
      model: "excluded-main-model",
      enabled: true,
      provider: "custom",
      apiType: "anthropic",
      models: [
        { name: "excluded-main-model", catalogStatus: "excluded" },
        { name: "available-fallback-model", catalogStatus: "managed" },
      ],
    }],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const [profile] = loadApiConfigSettings().profiles;
    assert.equal(profile?.model, "available-fallback-model");
    assert.equal(
      profile?.models?.find((model) => model.name === "excluded-main-model")?.catalogStatus,
      "excluded",
    );
    assert.equal(resolveApiConfigForModel("excluded-main-model")?.fellBack, true);
    assert.equal(resolveApiConfigForModel("excluded-main-model")?.model, "available-fallback-model");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("malformed model metadata is ignored without hiding valid profiles or credentials", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-model-recovery-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [
      {
        id: "recoverable-profile",
        name: "Recoverable",
        apiKey: "recoverable-secret",
        baseURL: "https://recoverable.example/v1",
        model: "valid-model",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [
          null,
          {},
          { name: "", ownedBy: 123 },
          { name: "valid-model", ownedBy: 123, supportedEndpointTypes: ["OPENAI", null] },
        ],
      },
      {
        id: "healthy-profile",
        name: "Healthy",
        apiKey: "healthy-secret",
        baseURL: "https://healthy.example/v1",
        model: "healthy-model",
        enabled: true,
        provider: "custom",
        apiType: "anthropic",
        models: [{ name: "healthy-model" }],
      },
    ],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const loaded = loadApiConfigSettings();
    assert.deepEqual(loaded.profiles.map((profile) => profile.id), ["recoverable-profile", "healthy-profile"]);
    assert.equal(loaded.profiles[0]?.apiKey, "recoverable-secret");
    assert.deepEqual(loaded.profiles[0]?.models?.map((model) => model.name), ["valid-model"]);
    assert.equal(loaded.profiles[0]?.models?.[0]?.ownedBy, undefined);
    assert.deepEqual(loaded.profiles[0]?.models?.[0]?.supportedEndpointTypes, ["openai"]);
    assert.equal(loaded.profiles[1]?.apiKey, "healthy-secret");
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});

test("legacy role slots missing from a declared catalog fall back to local managed models", () => {
  const previousUserData = app.getPath("userData");
  const root = join(tmpdir(), `tech-cc-hub-role-recovery-${Date.now()}`);
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "api-config.json"), JSON.stringify({
    profiles: [{
      id: "legacy-role-profile",
      name: "Legacy roles",
      apiKey: "legacy-secret",
      baseURL: "https://legacy.example/v1",
      model: "missing-main",
      expertModel: "missing-expert",
      smallModel: "missing-small",
      analysisModel: "missing-analysis",
      imageModel: "missing-vision",
      imageGenerationModel: "missing-image-generation",
      enabled: true,
      provider: "custom",
      apiType: "anthropic",
      models: [{ name: "local-managed", catalogStatus: "managed", contextWindow: 64_000 }],
    }],
  }), "utf8");

  try {
    app.setPath("userData", root);
    const [profile] = loadApiConfigSettings().profiles;
    assert.equal(profile?.apiKey, "legacy-secret");
    assert.equal(profile?.model, "local-managed");
    assert.equal(profile?.expertModel, "local-managed");
    assert.equal(profile?.smallModel, "local-managed");
    assert.equal(profile?.analysisModel, "local-managed");
    assert.equal(profile?.imageModel, undefined);
    assert.equal(profile?.imageGenerationModel, undefined);
    assert.deepEqual(profile?.models?.map((model) => model.name), ["local-managed"]);
  } finally {
    app.setPath("userData", previousUserData);
    rmSync(root, { recursive: true, force: true });
  }
});
