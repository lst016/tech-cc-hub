import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  MODEL_CATALOG_STARTUP_SYNC_DELAY_MS,
  MODEL_CATALOG_SYNC_INTERVAL_MS,
  startModelCatalogSyncScheduler,
  syncManagedModelCatalog,
  type ModelCatalogSyncTimerHandle,
} from "../../src/electron/libs/model-catalog-sync.js";
import type { ApiConfigSettings } from "../../src/electron/libs/config-store.js";
import { mergeAutoSyncedModelsIntoDraft } from "../../src/ui/utils/model-catalog-sync.js";

function createSettings(): ApiConfigSettings {
  return {
    profiles: [
      {
        id: "enabled-gateway",
        name: "波波网关",
        apiKey: "secret",
        baseURL: "https://gateway.example/v1",
        model: "existing-model",
        enabled: true,
        provider: "custom",
        models: [
          {
            name: "existing-model",
            catalogStatus: "managed",
            alias: "本地别名",
            notes: "本地备注",
            routingWeight: 80,
            contextWindow: 128_000,
            supportedEndpointTypes: ["openai"],
          },
          {
            name: "excluded-image-model",
            catalogStatus: "excluded",
          },
          {
            name: "temporarily-missing-model",
            catalogStatus: "managed",
          },
        ],
      },
      {
        id: "disabled-gateway",
        name: "已停用网关",
        apiKey: "unused",
        baseURL: "https://disabled.example/v1",
        model: "disabled-model",
        enabled: false,
        provider: "custom",
        models: [{ name: "disabled-model", catalogStatus: "managed" }],
      },
    ],
  };
}

test("automatic model catalog sync manages new models and preserves local decisions", async () => {
  let currentSettings = createSettings();
  const savedSettings: ApiConfigSettings[] = [];
  const notifications: Array<{ modelName: string; profileId: string }> = [];
  const fetchedProfileIds: string[] = [];

  const firstResult = await syncManagedModelCatalog({
    loadSettings: () => currentSettings,
    saveSettings: (settings) => {
      currentSettings = settings;
      savedSettings.push(settings);
    },
    fetchModels: async (profile) => {
      fetchedProfileIds.push(profile.id);
      return {
        success: true,
        baseURL: "https://gateway.example/v1",
        models: [
          {
            name: "existing-model",
            contextWindow: 200_000,
            ownedBy: "gateway",
            supportedEndpointTypes: ["vision"],
          },
          {
            name: "doubao-seedream-5-0-pro-260628",
            contextWindow: 200_000,
            ownedBy: "doubao",
            supportedEndpointTypes: ["images"],
          },
        ],
      };
    },
    onModelsAdded: ({ addedModels }) => notifications.push(...addedModels),
  });

  assert.deepEqual(fetchedProfileIds, ["enabled-gateway"]);
  assert.equal(firstResult.changed, true);
  assert.deepEqual(firstResult.addedModels.map((item) => item.modelName), ["doubao-seedream-5-0-pro-260628"]);
  assert.equal(savedSettings.length, 1);
  assert.deepEqual(notifications.map((item) => item.modelName), ["doubao-seedream-5-0-pro-260628"]);

  const syncedProfile = currentSettings.profiles[0];
  const existing = syncedProfile?.models?.find((model) => model.name === "existing-model");
  const added = syncedProfile?.models?.find((model) => model.name === "doubao-seedream-5-0-pro-260628");
  assert.equal(existing?.alias, "本地别名");
  assert.equal(existing?.notes, "本地备注");
  assert.equal(existing?.routingWeight, 80);
  assert.equal(existing?.contextWindow, 128_000);
  assert.deepEqual(existing?.supportedEndpointTypes, ["openai", "vision"]);
  assert.equal(existing?.ownedBy, "gateway");
  assert.equal(added?.catalogStatus, "managed");
  assert.equal(added?.ownedBy, "doubao");
  assert.equal(
    syncedProfile?.models?.find((model) => model.name === "excluded-image-model")?.catalogStatus,
    "excluded",
  );
  assert.ok(syncedProfile?.models?.some((model) => model.name === "temporarily-missing-model"));

  notifications.length = 0;
  fetchedProfileIds.length = 0;
  const secondResult = await syncManagedModelCatalog({
    loadSettings: () => currentSettings,
    saveSettings: (settings) => {
      currentSettings = settings;
      savedSettings.push(settings);
    },
    fetchModels: async (profile) => {
      fetchedProfileIds.push(profile.id);
      return {
        success: true,
        baseURL: profile.baseURL,
        models: profile.models?.filter((model) => (
          model.name === "existing-model" || model.name === "doubao-seedream-5-0-pro-260628"
        )),
      };
    },
    onModelsAdded: ({ addedModels }) => notifications.push(...addedModels),
  });

  assert.equal(secondResult.changed, false);
  assert.deepEqual(secondResult.addedModels, []);
  assert.deepEqual(notifications, []);
  assert.equal(savedSettings.length, 1);
});

test("automatic model catalog sync isolates one gateway failure", async () => {
  const settings = createSettings();
  settings.profiles[1] = {
    ...settings.profiles[1]!,
    enabled: true,
  };
  const savedSettings: ApiConfigSettings[] = [];

  const result = await syncManagedModelCatalog({
    loadSettings: () => settings,
    saveSettings: (next) => {
      savedSettings.push(next);
    },
    fetchModels: async (profile) => (
      profile.id === "enabled-gateway"
        ? { success: false, error: "gateway unavailable" }
        : { success: true, models: [{ name: "new-from-second-gateway" }] }
    ),
  });

  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0]?.profileId, "enabled-gateway");
  assert.deepEqual(result.addedModels.map((item) => item.modelName), ["new-from-second-gateway"]);
  assert.ok(savedSettings[0]?.profiles[1]?.models?.some((model) => model.name === "new-from-second-gateway"));
});

test("settings drafts absorb only genuinely added background models", () => {
  const draft = createSettings().profiles;
  const locallyEdited = draft.map((profile) => profile.id === "enabled-gateway"
    ? {
        ...profile,
        name: "尚未保存的新名称",
        models: profile.models?.filter((model) => model.name !== "temporarily-missing-model"),
      }
    : profile);

  const merged = mergeAutoSyncedModelsIntoDraft(locallyEdited, [
    {
      profileId: "enabled-gateway",
      profileName: "波波网关",
      modelName: "doubao-seedream-5-0-pro-260628",
      model: {
        name: "doubao-seedream-5-0-pro-260628",
        catalogStatus: "managed",
        supportedEndpointTypes: ["images"],
      },
    },
    {
      profileId: "missing-profile",
      profileName: "已删除网关",
      modelName: "ignored-model",
      model: { name: "ignored-model", catalogStatus: "managed" },
    },
  ]);

  assert.equal(merged[0]?.name, "尚未保存的新名称");
  assert.ok(merged[0]?.models?.some((model) => model.name === "doubao-seedream-5-0-pro-260628"));
  assert.ok(!merged[0]?.models?.some((model) => model.name === "temporarily-missing-model"));
  assert.equal(merged.some((profile) => profile.id === "missing-profile"), false);
});

test("automatic sync rebases on the latest settings before saving", async () => {
  const initial = createSettings();
  const latest: ApiConfigSettings = {
    profiles: initial.profiles.map((profile) => profile.id === "enabled-gateway"
      ? {
          ...profile,
          models: [
            ...(profile.models ?? []),
            { name: "manually-added-first", catalogStatus: "managed" as const },
          ],
        }
      : profile),
  };
  let loadCount = 0;
  let saveCount = 0;
  let notificationCount = 0;

  const result = await syncManagedModelCatalog({
    loadSettings: () => (++loadCount === 1 ? initial : latest),
    saveSettings: () => {
      saveCount += 1;
    },
    fetchModels: async () => ({ success: true, models: [{ name: "manually-added-first" }] }),
    onModelsAdded: () => {
      notificationCount += 1;
    },
  });

  assert.equal(result.changed, false);
  assert.deepEqual(result.addedModels, []);
  assert.equal(saveCount, 0);
  assert.equal(notificationCount, 0);
});

test("automatic sync discards a stale response after connection details change", async () => {
  const initial = createSettings();
  const latest: ApiConfigSettings = {
    profiles: initial.profiles.map((profile) => profile.id === "enabled-gateway"
      ? { ...profile, baseURL: "https://replacement.example/v1" }
      : profile),
  };
  let loadCount = 0;
  let saveCount = 0;

  const result = await syncManagedModelCatalog({
    loadSettings: () => (++loadCount === 1 ? initial : latest),
    saveSettings: () => {
      saveCount += 1;
    },
    fetchModels: async () => ({ success: true, models: [{ name: "stale-model" }] }),
  });

  assert.equal(result.changed, false);
  assert.equal(saveCount, 0);
  assert.deepEqual(result.addedModels, []);
});

type FakeTimer = ModelCatalogSyncTimerHandle & {
  id: number;
  dueAt: number;
  callback: () => void;
};

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, FakeTimer>();

  return {
    setTimer(callback: () => void, delayMs: number): ModelCatalogSyncTimerHandle {
      const timer: FakeTimer = {
        id: nextId++,
        dueAt: now + delayMs,
        callback,
        unref() {},
      };
      timers.set(timer.id, timer);
      return timer;
    },
    clearTimer(handle: ModelCatalogSyncTimerHandle): void {
      timers.delete((handle as FakeTimer).id);
    },
    advance(delayMs: number): void {
      const target = now + delayMs;
      for (;;) {
        const next = [...timers.values()]
          .filter((timer) => timer.dueAt <= target)
          .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
        if (!next) break;
        timers.delete(next.id);
        now = next.dueAt;
        next.callback();
      }
      now = target;
    },
    pendingCount: () => timers.size,
  };
}

test("model catalog scheduler runs after startup and then every 24 hours", async () => {
  const timers = createFakeTimers();
  let syncCount = 0;
  const scheduler = startModelCatalogSyncScheduler({
    sync: async () => {
      syncCount += 1;
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  assert.equal(timers.pendingCount(), 1);
  timers.advance(MODEL_CATALOG_STARTUP_SYNC_DELAY_MS - 1);
  assert.equal(syncCount, 0);
  timers.advance(1);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(syncCount, 1);
  assert.equal(timers.pendingCount(), 1);

  timers.advance(MODEL_CATALOG_SYNC_INTERVAL_MS);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(syncCount, 2);
  assert.equal(timers.pendingCount(), 1);

  scheduler.stop();
  assert.equal(timers.pendingCount(), 0);
});

test("model catalog scheduler is single-flight and aborts cleanly on stop", async () => {
  const timers = createFakeTimers();
  let syncCount = 0;
  let aborted = false;
  let finishSync: (() => void) | null = null;
  const scheduler = startModelCatalogSyncScheduler({
    sync: async (signal) => {
      syncCount += 1;
      await new Promise<void>((resolve) => {
        finishSync = resolve;
        signal.addEventListener("abort", () => {
          aborted = true;
          resolve();
        }, { once: true });
      });
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  const firstRun = scheduler.runNow();
  const duplicateRun = scheduler.runNow();
  assert.equal(firstRun, duplicateRun);
  assert.equal(syncCount, 1);

  scheduler.stop();
  await firstRun;
  assert.equal(aborted, true);
  assert.equal(timers.pendingCount(), 0);
  assert.equal(typeof finishSync, "function");
});

test("main process wires automatic sync to renderer notifications and cleanup", () => {
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const electronTypesSource = readFileSync("src/electron/types.ts", "utf8");
  const uiTypesSource = readFileSync("src/ui/types.ts", "utf8");
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const settingsModalSource = readFileSync("src/ui/components/SettingsModal.tsx", "utf8");

  assert.match(mainSource, /startModelCatalogSyncScheduler\(/);
  assert.match(mainSource, /await loadRenderer\(mainWindow\);[\s\S]*startModelCatalogSyncScheduler\(/);
  assert.match(mainSource, /modelCatalogSyncScheduler\?\.stop\(\)/);
  assert.match(mainSource, /broadcastServerEvent\(\{\s*type: "model\.catalog\.updated"/);
  assert.match(ipcSource, /export function broadcastServerEvent\(event: ServerEvent\)/);
  assert.match(electronTypesSource, /type: "model\.catalog\.updated"/);
  assert.match(uiTypesSource, /type: "model\.catalog\.updated"/);
  assert.match(appSource, /event\.type === "model\.catalog\.updated"/);
  assert.match(appSource, /toast\.success\("发现新模型"/);
  assert.match(appSource, /window\.electron\.getApiConfig\(\)/);
  assert.match(appSource, /MODEL_CATALOG_UPDATED_EVENT/);
  assert.match(settingsModalSource, /mergeAutoSyncedModelsIntoDraft/);
});
