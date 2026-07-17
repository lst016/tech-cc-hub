import { normalizeImportedApiModels, type ImportedApiModel } from "../../shared/models/api-model-metadata.js";
import type {
  ApiConfig,
  ApiConfigSettings,
  ApiModelConfig,
} from "./config-store.js";

export const MODEL_CATALOG_STARTUP_SYNC_DELAY_MS = 3_000;
export const MODEL_CATALOG_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const MODEL_CATALOG_REQUEST_TIMEOUT_MS = 45_000;

export type ModelCatalogAddedModel = {
  profileId: string;
  profileName: string;
  modelName: string;
  model: ApiModelConfig;
};

export type ModelCatalogUpdatedPayload = {
  addedModels: ModelCatalogAddedModel[];
  syncedAt: number;
};

export type ModelCatalogFetchResult = {
  success: boolean;
  models?: ImportedApiModel[];
  baseURL?: string;
  error?: string;
};

export type ModelCatalogSyncError = {
  profileId: string;
  profileName: string;
  error: string;
};

export type ModelCatalogSyncResult = {
  changed: boolean;
  addedModels: ModelCatalogAddedModel[];
  errors: ModelCatalogSyncError[];
};

type ModelCatalogSyncDependencies = {
  loadSettings: () => ApiConfigSettings;
  saveSettings: (settings: ApiConfigSettings) => void;
  fetchModels: (profile: ApiConfig, signal: AbortSignal) => Promise<ModelCatalogFetchResult>;
  onModelsAdded?: (payload: ModelCatalogUpdatedPayload) => void;
  signal?: AbortSignal;
  now?: () => number;
  requestTimeoutMs?: number;
};

type FetchedProfileCatalog = {
  profile: ApiConfig;
  requestSignature: string;
  result: ModelCatalogFetchResult;
};

function getProfileRequestSignature(profile: ApiConfig): string {
  return JSON.stringify([
    profile.provider ?? "custom",
    profile.baseURL.trim(),
    profile.apiKey,
  ]);
}

function mergeEndpointTypes(
  current: readonly string[] | undefined,
  imported: readonly string[] | undefined,
): string[] | undefined {
  const merged = Array.from(new Set([
    ...(current ?? []),
    ...(imported ?? []),
  ].map((value) => value.trim().toLowerCase()).filter(Boolean)));
  return merged.length > 0 ? merged : undefined;
}

function mergeExistingModel(existing: ApiModelConfig, imported: ImportedApiModel): ApiModelConfig {
  const next: ApiModelConfig = {
    ...existing,
    catalogStatus: existing.catalogStatus === "excluded" ? "excluded" : "managed",
  };

  const supportedEndpointTypes = mergeEndpointTypes(
    existing.supportedEndpointTypes,
    imported.supportedEndpointTypes,
  );
  if (supportedEndpointTypes) next.supportedEndpointTypes = supportedEndpointTypes;
  if (imported.ownedBy) next.ownedBy = imported.ownedBy;
  if (imported.createdAt) next.createdAt = imported.createdAt;
  if (next.contextWindow === undefined && imported.contextWindow !== undefined) {
    next.contextWindow = imported.contextWindow;
  }
  return next;
}

function createManagedModel(imported: ImportedApiModel): ApiModelConfig {
  return {
    ...imported,
    catalogStatus: "managed",
  };
}

function mergeProfileCatalog(
  profile: ApiConfig,
  result: ModelCatalogFetchResult,
): { profile: ApiConfig; addedModels: ModelCatalogAddedModel[] } {
  const models = [...(profile.models ?? [])];
  const modelIndexes = new Map(models.map((model, index) => [model.name, index]));
  const addedModels: ModelCatalogAddedModel[] = [];

  for (const imported of normalizeImportedApiModels(result.models ?? [])) {
    const existingIndex = modelIndexes.get(imported.name);
    if (existingIndex !== undefined) {
      const existing = models[existingIndex];
      if (existing) models[existingIndex] = mergeExistingModel(existing, imported);
      continue;
    }

    const model = createManagedModel(imported);
    modelIndexes.set(model.name, models.length);
    models.push(model);
    addedModels.push({
      profileId: profile.id,
      profileName: profile.name,
      modelName: model.name,
      model,
    });
  }

  return {
    profile: {
      ...profile,
      baseURL: result.baseURL?.trim() || profile.baseURL,
      models,
    },
    addedModels,
  };
}

async function fetchModelsWithTimeout(
  profile: ApiConfig,
  dependencies: ModelCatalogSyncDependencies,
): Promise<ModelCatalogFetchResult> {
  const requestController = new AbortController();
  const abortFromParent = () => requestController.abort(dependencies.signal?.reason);
  if (dependencies.signal?.aborted) {
    abortFromParent();
  } else {
    dependencies.signal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timeout = setTimeout(
    () => requestController.abort(new Error("模型列表请求超时。")),
    dependencies.requestTimeoutMs ?? MODEL_CATALOG_REQUEST_TIMEOUT_MS,
  );
  timeout.unref?.();

  try {
    return await dependencies.fetchModels(profile, requestController.signal);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
    dependencies.signal?.removeEventListener("abort", abortFromParent);
  }
}

export async function syncManagedModelCatalog(
  dependencies: ModelCatalogSyncDependencies,
): Promise<ModelCatalogSyncResult> {
  const initialSettings = dependencies.loadSettings();
  const fetchedProfiles: FetchedProfileCatalog[] = [];
  const errors: ModelCatalogSyncError[] = [];

  for (const profile of initialSettings.profiles) {
    if (!profile.enabled || dependencies.signal?.aborted) continue;
    const result = await fetchModelsWithTimeout(profile, dependencies);
    if (dependencies.signal?.aborted) break;
    if (!result.success) {
      errors.push({
        profileId: profile.id,
        profileName: profile.name,
        error: result.error || "模型列表同步失败。",
      });
      continue;
    }
    fetchedProfiles.push({
      profile,
      requestSignature: getProfileRequestSignature(profile),
      result,
    });
  }

  if (dependencies.signal?.aborted) {
    return { changed: false, addedModels: [], errors };
  }

  const latestSettings = dependencies.loadSettings();
  const fetchedByProfileId = new Map(fetchedProfiles.map((item) => [item.profile.id, item]));
  const addedModels: ModelCatalogAddedModel[] = [];
  const nextSettings: ApiConfigSettings = {
    profiles: latestSettings.profiles.map((profile) => {
      const fetched = fetchedByProfileId.get(profile.id);
      if (
        !fetched
        || !profile.enabled
        || getProfileRequestSignature(profile) !== fetched.requestSignature
      ) {
        return profile;
      }
      const merged = mergeProfileCatalog(profile, fetched.result);
      addedModels.push(...merged.addedModels);
      return merged.profile;
    }),
  };

  const changed = JSON.stringify(nextSettings) !== JSON.stringify(latestSettings);
  if (!changed || dependencies.signal?.aborted) {
    return { changed: false, addedModels: [], errors };
  }

  dependencies.saveSettings(nextSettings);
  if (addedModels.length > 0) {
    dependencies.onModelsAdded?.({
      addedModels,
      syncedAt: (dependencies.now ?? Date.now)(),
    });
  }
  return { changed: true, addedModels, errors };
}

export type ModelCatalogSyncTimerHandle = {
  unref?: () => void;
};

type ModelCatalogSyncSchedulerOptions = {
  sync: (signal: AbortSignal) => Promise<void>;
  startupDelayMs?: number;
  intervalMs?: number;
  setTimer?: (callback: () => void, delayMs: number) => ModelCatalogSyncTimerHandle;
  clearTimer?: (handle: ModelCatalogSyncTimerHandle) => void;
  onError?: (error: unknown) => void;
};

export type ModelCatalogSyncScheduler = {
  runNow: () => Promise<void>;
  stop: () => void;
};

export function startModelCatalogSyncScheduler(
  options: ModelCatalogSyncSchedulerOptions,
): ModelCatalogSyncScheduler {
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  const intervalMs = options.intervalMs ?? MODEL_CATALOG_SYNC_INTERVAL_MS;
  let timer: ModelCatalogSyncTimerHandle | null = null;
  let stopped = false;
  let inFlight: Promise<void> | null = null;
  let activeController: AbortController | null = null;

  const cancelTimer = () => {
    if (!timer) return;
    clearTimer(timer);
    timer = null;
  };

  const schedule = (delayMs: number) => {
    if (stopped) return;
    cancelTimer();
    timer = setTimer(() => {
      timer = null;
      void runNow();
    }, delayMs);
    timer.unref?.();
  };

  const runNow = (): Promise<void> => {
    if (stopped) return Promise.resolve();
    if (inFlight) return inFlight;
    cancelTimer();
    activeController = new AbortController();
    const controller = activeController;
    inFlight = options.sync(controller.signal)
      .catch((error) => options.onError?.(error))
      .finally(() => {
        if (activeController === controller) activeController = null;
        inFlight = null;
        schedule(intervalMs);
      });
    return inFlight;
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelTimer();
    activeController?.abort(new Error("应用正在退出。"));
    activeController = null;
  };

  schedule(options.startupDelayMs ?? MODEL_CATALOG_STARTUP_SYNC_DELAY_MS);
  return { runNow, stop };
}
