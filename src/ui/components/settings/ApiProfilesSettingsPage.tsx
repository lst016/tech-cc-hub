import type { ApiConfigProfile } from "../../types";
import type { DevElectronRuntimeSource } from "../../dev-electron-shim";
import { ChevronDown, Plus } from "lucide-react";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
  CODEX_OAUTH_STORED_CREDENTIAL,
  mergeCodexModelIds,
} from "../../../shared/codex-oauth";
import {
  extractApiModelsFromListPayload,
  getImportedApiModelNames,
  toImportedApiModels,
  type ImportedApiModel,
} from "../../../shared/models/api-model-metadata";
import { isLikelyImageUnderstandingModel } from "../../../shared/models/model-capabilities";
import { ModelSelect } from "../models/ModelSelect";
import {
  createCodexOAuthProfile,
  createDeepSeekOfficialProfile,
  createMiniMaxOfficialProfile,
  createModel,
  createProfile,
  DEEPSEEK_OFFICIAL_BASE_URL,
  DEEPSEEK_OFFICIAL_MODELS,
  MINIMAX_OFFICIAL_BASE_URL,
  getAvailableModels,
} from "./settings-utils";
import {
  MINIMAX_DEFAULT_MODEL,
  MINIMAX_M2_CONTEXT_WINDOW,
  MINIMAX_M3_CONTEXT_WINDOW,
  MINIMAX_MODEL_CONFIGS,
  MINIMAX_SMALL_MODEL,
} from "../../../shared/models/minimax";
import { useEffect, useState } from "react";

type ApiProfilesSettingsPageProps = {
  profiles: ApiConfigProfile[];
  runtimeSource: DevElectronRuntimeSource;
  onChange: (updater: (current: ApiConfigProfile[]) => ApiConfigProfile[]) => void;
};

const runtimeSourceMeta: Record<DevElectronRuntimeSource, { label: string; description: string; className: string }> = {
  bridge: {
    label: "Dev Bridge",
    description: "数据来自当前 Electron 开发后端",
    className: "border-emerald-500/20 bg-emerald-50 text-emerald-700",
  },
  fallback: {
    label: "Fallback",
    description: "当前使用浏览器预览占位数据",
    className: "border-amber-500/24 bg-amber-50 text-amber-700",
  },
  electron: {
    label: "Electron IPC",
    description: "数据来自桌面端 preload IPC",
    className: "border-sky-500/20 bg-sky-50 text-sky-700",
  },
};

const DEFAULT_IMPORTED_CONTEXT_WINDOW = 200_000;
const DEEPSEEK_CONTEXT_WINDOW = 1_000_000;
const DEEPSEEK_MODELS_ENDPOINT = "https://api.deepseek.com/models";
const MINIMAX_MODELS_ENDPOINT = "https://api.minimaxi.com/anthropic/v1/models";

type ModelImportStatus = {
  profileId: string;
  tone: "error" | "success";
  message: string;
} | null;

type CodexRuntimeLoginState = {
  attemptId?: string;
  phase: "starting" | "browser" | "device-code";
  verificationUrl?: string;
  userCode?: string;
};

type ApiProviderMode = NonNullable<ApiConfigProfile["provider"]>;

type ApiModelsFetchResult = {
  success: boolean;
  models?: Array<string | ImportedApiModel>;
  baseURL?: string;
  error?: string;
};

type CreateProfileOption = {
  id: string;
  label: string;
  description: string;
  create: () => ApiConfigProfile;
};

const createProfileOptions: CreateProfileOption[] = [
  {
    id: "custom",
    label: "自定义",
    description: "手动填写兼容 Anthropic 的接口地址、密钥和模型。",
    create: createProfile,
  },
  {
    id: "deepseek",
    label: "DeepSeek 官方",
    description: "只填 SK，自动使用 DeepSeek 官方 Anthropic 接口。",
    create: createDeepSeekOfficialProfile,
  },
  {
    id: "codex",
    label: "Codex OAuth",
    description: "通过 OpenAI OAuth 接入 Codex 响应模型。",
    create: createCodexOAuthProfile,
  },
  {
    id: "minimax",
    label: "MiniMax 官方",
    description: "填 Token Plan Subscription Key，使用 MiniMax Anthropic 官方接口。",
    create: createMiniMaxOfficialProfile,
  },
];

type ApiProfileTestResult = {
  success: boolean;
  message?: string;
  endpoint?: string;
  model?: string;
  error?: string;
};

type CodexManualCredential = {
  access_token: string;
  refresh_token?: string;
  account_id: string;
  email?: string;
  type?: string;
  expired?: string;
  last_refresh?: string;
};

function isDeepSeekBaseURL(baseURL: string | undefined): boolean {
  try {
    return new URL(baseURL?.trim() || "").hostname === "api.deepseek.com";
  } catch {
    return false;
  }
}

function isMiniMaxBaseURL(baseURL: string | undefined): boolean {
  try {
    const hostname = new URL(baseURL?.trim() || "").hostname;
    return hostname === "api.minimax.io" || hostname === "api.minimaxi.com";
  } catch {
    return false;
  }
}

function getProviderMode(profile: ApiConfigProfile): ApiProviderMode {
  if (profile.provider === "custom" || profile.provider === "deepseek" || profile.provider === "codex" || profile.provider === "minimax") {
    return profile.provider;
  }

  if (isDeepSeekBaseURL(profile.baseURL)) return "deepseek";
  if (isMiniMaxBaseURL(profile.baseURL)) return "minimax";
  return "custom";
}

function buildModelsEndpoint(baseURL: string, provider: ApiProviderMode = "custom"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_MODELS_ENDPOINT;
  }
  if (provider === "codex") {
    return `${CODEX_OAUTH_BASE_URL}/backend-api/codex/models`;
  }
  if (provider === "minimax") {
    return MINIMAX_MODELS_ENDPOINT;
  }

  const url = new URL(baseURL.trim());
  const trimmedPath = url.pathname.replace(/\/+$/, "");

  if (!trimmedPath || trimmedPath === "/" || trimmedPath.startsWith("/console")) {
    url.pathname = "/v1/models";
    return url.toString();
  }

  url.pathname = trimmedPath.endsWith("/v1") ? `${trimmedPath}/models` : `${trimmedPath}/v1/models`;
  return url.toString();
}

function normalizeApiBaseURL(baseURL: string, provider: ApiProviderMode = "custom"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_OFFICIAL_BASE_URL;
  }
  if (provider === "codex") {
    return CODEX_OAUTH_BASE_URL;
  }
  if (provider === "minimax") {
    return MINIMAX_OFFICIAL_BASE_URL;
  }

  const url = new URL(baseURL.trim());
  const trimmedPath = url.pathname.replace(/\/+$/, "");

  if (!trimmedPath || trimmedPath === "/" || trimmedPath.startsWith("/console")) {
    url.pathname = "/v1";
    return url.toString().replace(/\/$/, "");
  }

  if (trimmedPath.endsWith("/models")) {
    url.pathname = trimmedPath.replace(/\/models$/, "");
    return url.toString().replace(/\/$/, "");
  }

  return url.toString().replace(/\/$/, "");
}

function normalizeImportedModels(models: Array<string | ImportedApiModel> | undefined): ImportedApiModel[] {
  const deduped = new Map<string, ImportedApiModel>();
  for (const model of models ?? []) {
    const name = typeof model === "string" ? model.trim() : model.name.trim();
    if (!name) continue;

    const contextWindow = typeof model === "string" ? undefined : model.contextWindow;
    const previous = deduped.get(name);
    deduped.set(name, {
      name,
      contextWindow: previous?.contextWindow ?? contextWindow,
    });
  }

  return Array.from(deduped.values());
}

function buildImportedModelConfigs(
  importedModels: ImportedApiModel[],
  existingModels: Map<string, NonNullable<ApiConfigProfile["models"]>[number]>,
  fallbackContextWindow: number,
): NonNullable<ApiConfigProfile["models"]> {
  return importedModels.map((model) => {
    const existing = existingModels.get(model.name);
    return {
      name: model.name,
      contextWindow: resolveImportedContextWindow(existing?.contextWindow, model.contextWindow, fallbackContextWindow),
      compressionThresholdPercent: existing?.compressionThresholdPercent ?? 70,
      routingWeight: existing?.routingWeight,
    };
  });
}

function resolveImportedContextWindow(existingContextWindow: number | undefined, importedContextWindow: number | undefined, fallbackContextWindow: number): number {
  if (
    importedContextWindow
    && (!existingContextWindow || existingContextWindow === fallbackContextWindow || existingContextWindow === DEFAULT_IMPORTED_CONTEXT_WINDOW)
  ) {
    return importedContextWindow;
  }

  return existingContextWindow ?? importedContextWindow ?? fallbackContextWindow;
}

function getMiniMaxFallbackContextWindow(modelName: string): number {
  return modelName === MINIMAX_DEFAULT_MODEL ? MINIMAX_M3_CONTEXT_WINDOW : MINIMAX_M2_CONTEXT_WINDOW;
}

function getFallbackImportedModelsForProvider(provider: ApiProviderMode): ImportedApiModel[] {
  if (provider === "minimax") {
    return MINIMAX_MODEL_CONFIGS.map((model) => ({
      name: model.name,
      contextWindow: model.contextWindow,
    }));
  }
  if (provider === "deepseek") {
    return toImportedApiModels([...DEEPSEEK_OFFICIAL_MODELS], DEEPSEEK_CONTEXT_WINDOW);
  }
  return [];
}

async function fetchModelsInBrowser(baseURL: string, apiKey: string, provider: ApiProviderMode = "custom"): Promise<ApiModelsFetchResult> {
  if (provider === "codex") {
    return {
      success: true,
      models: toImportedApiModels(CODEX_OAUTH_MODELS, DEFAULT_IMPORTED_CONTEXT_WINDOW),
      baseURL: CODEX_OAUTH_BASE_URL,
    };
  }

  try {
    const endpoint = buildModelsEndpoint(baseURL, provider);
    const response = await fetch(endpoint, {
      headers: {
        authorization: `Bearer ${apiKey}`,
        "x-api-key": apiKey,
      },
    });

    if (!response.ok) {
      const message = await response.text();
      return { success: false, error: message || response.statusText };
    }

    const payload = await response.json() as unknown;
    const fallbackContextWindow = provider === "deepseek" ? DEEPSEEK_CONTEXT_WINDOW : undefined;
    return {
      success: true,
      models: extractApiModelsFromListPayload(payload).map((model) => ({
        ...model,
        contextWindow: model.contextWindow ?? (provider === "minimax" ? getMiniMaxFallbackContextWindow(model.name) : fallbackContextWindow),
      })),
      baseURL: normalizeApiBaseURL(baseURL, provider),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function normalizeMessagesBaseURL(baseURL: string, provider: ApiProviderMode): string {
  if (provider === "deepseek") {
    return `${DEEPSEEK_OFFICIAL_BASE_URL}/v1`;
  }
  if (provider === "codex") {
    return CODEX_OAUTH_BASE_URL;
  }
  if (provider === "minimax") {
    return `${MINIMAX_OFFICIAL_BASE_URL}/v1`;
  }

  const url = new URL(baseURL.trim());
  const trimmedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = trimmedPath.endsWith("/v1") ? trimmedPath : `${trimmedPath || ""}/v1`;
  return url.toString().replace(/\/$/, "");
}

async function testApiConfigInBrowser(profile: ApiConfigProfile, provider: ApiProviderMode): Promise<ApiProfileTestResult> {
  const baseURL = provider === "deepseek"
    ? DEEPSEEK_OFFICIAL_BASE_URL
    : provider === "codex"
      ? CODEX_OAUTH_BASE_URL
      : provider === "minimax"
        ? MINIMAX_OFFICIAL_BASE_URL
        : profile.baseURL.trim();
  const model = profile.model?.trim() || profile.models?.find((item) => item.name.trim())?.name.trim() || "";
  if (provider === "codex") {
    return { success: false, model, error: "Codex OAuth 测试需要 Electron 后端。" };
  }
  if (!baseURL || !profile.apiKey.trim() || !model) {
    return { success: false, error: "请先填写接口地址、API Key 和默认主模型。" };
  }

  try {
    const endpoint = `${normalizeMessagesBaseURL(baseURL, provider)}/messages`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
        authorization: `Bearer ${profile.apiKey}`,
        "x-api-key": profile.apiKey,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }],
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      return { success: false, endpoint, model, error: text || response.statusText };
    }

    return { success: true, endpoint, model, message: "连接成功，模型可以响应。" };
  } catch (error) {
    return {
      success: false,
      model,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function removeUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}

function parseJwtPayload(token: string): Record<string, unknown> | null {
  const [, payload] = token.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractCodexAccountId(accessToken: string): string {
  const payload = parseJwtPayload(accessToken);
  if (!isRecord(payload)) return "";

  const authClaim = payload["https://api.openai.com/auth"];
  return stringValue(payload.chatgpt_account_id)
    || stringValue(payload.account_id)
    || (isRecord(authClaim) ? stringValue(authClaim.chatgpt_account_id) : "");
}

function extractCodexEmail(accessToken: string, idToken?: string): string {
  return stringValue(parseJwtPayload(accessToken)?.email)
    || (idToken ? stringValue(parseJwtPayload(idToken)?.email) : "");
}

function normalizeCodexManualCredentialInput(raw: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Manual Codex credential must be valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new Error("Manual Codex credential must be a JSON object.");
  }

  const candidates = [
    isRecord(parsed.tokens) ? parsed.tokens : null,
    isRecord(parsed.auth) ? parsed.auth : null,
    parsed,
  ].filter((item): item is Record<string, unknown> => Boolean(item));

  for (const candidate of candidates) {
    const accessToken = stringValue(candidate.access_token) || stringValue(candidate.accessToken);
    if (!accessToken) continue;

    const accountId = stringValue(candidate.account_id)
      || stringValue(candidate.accountId)
      || extractCodexAccountId(accessToken);
    if (!accountId) continue;

    const idToken = stringValue(candidate.id_token) || stringValue(candidate.idToken);
    const credential: CodexManualCredential = {
      access_token: accessToken,
      refresh_token: stringValue(candidate.refresh_token) || stringValue(candidate.refreshToken) || undefined,
      account_id: accountId,
      email: stringValue(candidate.email) || extractCodexEmail(accessToken, idToken) || undefined,
      type: "codex",
      expired: stringValue(candidate.expired) || stringValue(candidate.expires_at) || stringValue(candidate.expiresAt) || undefined,
      last_refresh: stringValue(candidate.last_refresh) || stringValue(candidate.lastRefresh) || stringValue(parsed.last_refresh) || stringValue(parsed.lastRefresh) || undefined,
    };
    return JSON.stringify(removeUndefined(credential), null, 2);
  }

  throw new Error("Manual Codex JSON needs access_token plus account_id, or an official Codex auth.json that contains them.");
}

export function ApiProfilesSettingsPage({ profiles, runtimeSource, onChange }: ApiProfilesSettingsPageProps) {
  const sourceMeta = runtimeSourceMeta[runtimeSource];
  const [importingProfileId, setImportingProfileId] = useState<string | null>(null);
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ModelImportStatus>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [expandedModelLists, setExpandedModelLists] = useState<Record<string, boolean>>({});
  const [codexRuntimeLogins, setCodexRuntimeLogins] = useState<Record<string, CodexRuntimeLoginState>>({});
  const [manualCodexCredentialDrafts, setManualCodexCredentialDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const electronApi = window.electron as typeof window.electron & {
      onCodexOAuthRuntimeEvent?: typeof window.electron.onCodexOAuthRuntimeEvent;
    };
    if (typeof electronApi.onCodexOAuthRuntimeEvent !== "function") return;
    return electronApi.onCodexOAuthRuntimeEvent((event) => {
      if (event.type === "opening-browser") {
        setCodexRuntimeLogins((current) => ({
          ...current,
          [event.profileId]: { attemptId: event.attemptId, phase: "browser" },
        }));
        return;
      }
      if (event.type === "device-code") {
        setCodexRuntimeLogins((current) => ({
          ...current,
          [event.profileId]: {
            attemptId: event.attemptId,
            phase: "device-code",
            verificationUrl: event.verificationUrl,
            userCode: event.userCode,
          },
        }));
        return;
      }

      setCodexRuntimeLogins((current) => {
        const next = { ...current };
        delete next[event.profileId];
        return next;
      });
      if (event.type === "completed") {
        onChange((current) => current.map((profile) => profile.id === event.profileId
          ? {
              ...profile,
              apiKey: CODEX_OAUTH_STORED_CREDENTIAL,
              baseURL: CODEX_OAUTH_BASE_URL,
              provider: "codex",
            }
          : profile));
        const account = event.email || (event.accountIdSuffix ? `账号 …${event.accountIdSuffix}` : "ChatGPT 账号");
        setImportStatus({ profileId: event.profileId, tone: "success", message: `${account} 已连接，凭据已安全保存。` });
        return;
      }
      if (event.type === "cancelled") {
        setImportStatus({ profileId: event.profileId, tone: "error", message: "已取消 ChatGPT 账号连接。" });
        return;
      }
      setImportStatus({ profileId: event.profileId, tone: "error", message: event.error || "ChatGPT 账号连接失败。" });
    });
  }, [onChange]);

  const handleImportModels = async (profile: ApiConfigProfile) => {
    setImportStatus(null);
    const provider = getProviderMode(profile);
    const baseURL = provider === "deepseek"
      ? DEEPSEEK_OFFICIAL_BASE_URL
      : provider === "codex"
        ? CODEX_OAUTH_BASE_URL
        : provider === "minimax"
          ? MINIMAX_OFFICIAL_BASE_URL
          : profile.baseURL.trim();

    if (!baseURL) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "请先填写接口地址。" });
      return;
    }
    if (provider === "codex") {
      setImportingProfileId(profile.id);
      const electronApi = window.electron as typeof window.electron & {
        fetchApiModels?: (payload: { baseURL: string; apiKey: string; provider?: ApiProviderMode }) => Promise<ApiModelsFetchResult>;
      };
      const result = await (async () => {
        try {
          return typeof electronApi.fetchApiModels === "function"
            ? await electronApi.fetchApiModels({ baseURL, apiKey: profile.apiKey, provider })
            : await fetchModelsInBrowser(baseURL, profile.apiKey, provider);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      })();
      const importedResultModels = normalizeImportedModels(
        result.success ? result.models : toImportedApiModels(CODEX_OAUTH_MODELS, DEFAULT_IMPORTED_CONTEXT_WINDOW),
      );
      const importedModelsByName = new Map(importedResultModels.map((model) => [model.name, model]));
      const modelIds = mergeCodexModelIds(getImportedApiModelNames(importedResultModels));
      const importedModels = toImportedApiModels(modelIds, DEFAULT_IMPORTED_CONTEXT_WINDOW).map((model) => ({
        ...model,
        contextWindow: importedModelsByName.get(model.name)?.contextWindow ?? model.contextWindow,
      }));
      onChange((current) => current.map((item) => {
        if (item.id !== profile.id) return item;
        const existingModels = new Map((item.models ?? []).map((model) => [model.name, model]));
        const nextModels = buildImportedModelConfigs(importedModels, existingModels, DEFAULT_IMPORTED_CONTEXT_WINDOW);
        const fallbackModel = item.model && modelIds.includes(item.model) ? item.model : CODEX_OAUTH_DEFAULT_MODEL;
        return {
          ...item,
          baseURL: CODEX_OAUTH_BASE_URL,
          models: nextModels,
          model: fallbackModel,
          expertModel: item.expertModel && modelIds.includes(item.expertModel) ? item.expertModel : fallbackModel,
          smallModel: item.smallModel && modelIds.includes(item.smallModel) ? item.smallModel : CODEX_OAUTH_SMALL_MODEL,
          imageModel: undefined,
          analysisModel: item.analysisModel && modelIds.includes(item.analysisModel) ? item.analysisModel : CODEX_OAUTH_SMALL_MODEL,
          provider: "codex",
        };
      }));
      setImportingProfileId(null);
      setImportStatus({
        profileId: profile.id,
        tone: "success",
        message: result.success
          ? `已使用 Codex 模型列表，共 ${modelIds.length} 个。`
          : `读取 Codex 模型缓存失败，已使用内置 Codex 模型列表，共 ${modelIds.length} 个。`,
      });
      return;
    }
    if (!profile.apiKey.trim()) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "请先填写 API 密钥。" });
      return;
    }

    setImportingProfileId(profile.id);
    try {
      const electronApi = window.electron as typeof window.electron & {
        fetchApiModels?: (payload: { baseURL: string; apiKey: string; provider?: ApiProviderMode }) => Promise<ApiModelsFetchResult>;
      };
      const result = typeof electronApi.fetchApiModels === "function"
        ? await electronApi.fetchApiModels({ baseURL, apiKey: profile.apiKey, provider })
        : await fetchModelsInBrowser(baseURL, profile.apiKey, provider);

      if (!result.success) {
        if (provider === "deepseek" || provider === "minimax") {
          const importedModels = getFallbackImportedModelsForProvider(provider);
          const modelIds = getImportedApiModelNames(importedModels);
          const fallbackMainModel = provider === "minimax" ? MINIMAX_DEFAULT_MODEL : modelIds[0];
          const fallbackExpertModel = provider === "minimax" ? MINIMAX_DEFAULT_MODEL : "deepseek-v4-pro";
          const fallbackSmallModel = provider === "minimax" ? MINIMAX_SMALL_MODEL : "deepseek-v4-flash";
          onChange((current) => current.map((item) => {
            if (item.id !== profile.id) return item;
            const existingModels = new Map((item.models ?? []).map((model) => [model.name, model]));
            const nextModels = buildImportedModelConfigs(
              importedModels,
              existingModels,
              provider === "minimax" ? MINIMAX_M2_CONTEXT_WINDOW : DEEPSEEK_CONTEXT_WINDOW,
            );
            const fallbackModel = item.model && modelIds.includes(item.model) ? item.model : fallbackMainModel;
            return {
              ...item,
              baseURL: provider === "minimax" ? MINIMAX_OFFICIAL_BASE_URL : DEEPSEEK_OFFICIAL_BASE_URL,
              models: nextModels,
              model: fallbackModel,
              expertModel: item.expertModel && modelIds.includes(item.expertModel) ? item.expertModel : fallbackExpertModel,
              smallModel: item.smallModel && modelIds.includes(item.smallModel) ? item.smallModel : fallbackSmallModel,
              imageModel: undefined,
              analysisModel: item.analysisModel && modelIds.includes(item.analysisModel) ? item.analysisModel : fallbackSmallModel,
              provider,
            };
          }));
          setImportStatus({
            profileId: profile.id,
            tone: "success",
            message: `官方模型接口暂时没拉到，已使用内置 ${provider === "minimax" ? "MiniMax" : "DeepSeek"} 模型列表；原始错误：${result.error || "未知错误"}`,
          });
          return;
        }
        throw new Error(result.error || "拉取模型失败。");
      }

      const importedModels = normalizeImportedModels(result.models);
      const modelIds = getImportedApiModelNames(importedModels);
      if (modelIds.length === 0) {
        throw new Error("接口没有返回可用模型。");
      }

      const normalizedBaseURL = result.baseURL ?? normalizeApiBaseURL(baseURL, provider);
      onChange((current) => current.map((item) => {
        if (item.id !== profile.id) return item;
        const existingModels = new Map((item.models ?? []).map((model) => [model.name, model]));
        const nextModels = buildImportedModelConfigs(
          importedModels,
          existingModels,
          provider === "deepseek"
            ? DEEPSEEK_CONTEXT_WINDOW
            : provider === "minimax"
              ? MINIMAX_M2_CONTEXT_WINDOW
              : DEFAULT_IMPORTED_CONTEXT_WINDOW,
        );
        const fallbackModel = item.model && modelIds.includes(item.model) ? item.model : modelIds[0];
        const fallbackAnalysisModel = item.analysisModel && modelIds.includes(item.analysisModel) ? item.analysisModel : fallbackModel;
        const fallbackExpertModel = item.expertModel && modelIds.includes(item.expertModel) ? item.expertModel : fallbackModel;
        const fallbackSmallModel = item.smallModel && modelIds.includes(item.smallModel) ? item.smallModel : fallbackAnalysisModel;
        const fallbackImageModel = item.imageModel && modelIds.includes(item.imageModel) && isLikelyImageUnderstandingModel(item.imageModel)
          ? item.imageModel
          : modelIds.find(isLikelyImageUnderstandingModel);

        return {
          ...item,
          baseURL: normalizedBaseURL,
          models: nextModels,
          model: fallbackModel,
          expertModel: fallbackExpertModel,
          smallModel: fallbackSmallModel,
          imageModel: fallbackImageModel && modelIds.includes(fallbackImageModel) ? fallbackImageModel : undefined,
          analysisModel: fallbackAnalysisModel,
          provider,
        };
      }));
      const contextCount = importedModels.filter((model) => model.contextWindow).length;
      setImportStatus({
        profileId: profile.id,
        tone: "success",
        message: `已拉取 ${modelIds.length} 个模型${contextCount > 0 ? `，同步 ${contextCount} 个上下文窗口` : ""}，接口地址已规范为 ${normalizedBaseURL}`,
      });
    } catch (error) {
      setImportStatus({
        profileId: profile.id,
        tone: "error",
        message: error instanceof Error ? error.message : "拉取模型失败。",
      });
    } finally {
      setImportingProfileId(null);
    }
  };

  const handleTestConnection = async (profile: ApiConfigProfile) => {
    setImportStatus(null);
    const provider = getProviderMode(profile);
    const baseURL = provider === "deepseek"
      ? DEEPSEEK_OFFICIAL_BASE_URL
      : provider === "codex"
        ? CODEX_OAUTH_BASE_URL
        : provider === "minimax"
          ? MINIMAX_OFFICIAL_BASE_URL
          : profile.baseURL.trim();
    const model = profile.model?.trim() || profile.models?.find((item) => item.name.trim())?.name.trim() || "";

    if (!baseURL || !profile.apiKey.trim() || !model) {
      setImportStatus({ profileId: profile.id, tone: "error", message: provider === "codex" ? "请先连接 ChatGPT 账号并选择默认主模型。" : provider === "minimax" ? "请先填写 MiniMax Token Plan Subscription Key 并选择默认主模型。" : "请先填写接口地址、API Key 和默认主模型。" });
      return;
    }

    setTestingProfileId(profile.id);
    try {
      const electronApi = window.electron as typeof window.electron & {
        testApiConfig?: (payload: { profileId?: string; baseURL: string; apiKey: string; model: string; provider?: ApiProviderMode }) => Promise<ApiProfileTestResult>;
      };
      const result = typeof electronApi.testApiConfig === "function"
        ? await electronApi.testApiConfig({ profileId: profile.id, baseURL, apiKey: profile.apiKey, model, provider })
        : await testApiConfigInBrowser({ ...profile, baseURL, model }, provider);

      setImportStatus({
        profileId: profile.id,
        tone: result.success ? "success" : "error",
        message: result.success
          ? result.message || `测试通过：${result.model || model}`
          : result.error || "测试连接失败。",
      });
    } catch (error) {
      setImportStatus({
        profileId: profile.id,
        tone: "error",
        message: error instanceof Error ? error.message : "测试连接失败。",
      });
    } finally {
      setTestingProfileId(null);
    }
  };

  const handleCreateProfile = (create: () => ApiConfigProfile) => {
    setCreateMenuOpen(false);
    onChange((current) => [create(), ...current]);
  };

  const handleStartCodexRuntimeLogin = async (profile: ApiConfigProfile, mode: CodexRuntimeLoginMode = "browser") => {
    setImportStatus(null);
    setCodexRuntimeLogins((current) => ({
      ...current,
      [profile.id]: { phase: "starting" },
    }));
    try {
      const saveResult = await window.electron.saveApiConfig({ profiles });
      if (!saveResult.success) {
        throw new Error(saveResult.error || "保存 Codex 配置失败。");
      }
      const result = await window.electron.startCodexOAuthRuntime({ profile, mode });
      if (!result.success || !result.attemptId) {
        throw new Error(result.error || "无法启动内置 Codex 登录 runtime。" );
      }
      setCodexRuntimeLogins((current) => ({
        ...current,
        [profile.id]: {
          attemptId: result.attemptId,
          phase: mode === "device-code" ? "device-code" : "browser",
          verificationUrl: result.verificationUrl,
          userCode: result.userCode,
        },
      }));
    } catch (error) {
      setCodexRuntimeLogins((current) => {
        const next = { ...current };
        delete next[profile.id];
        return next;
      });
      setImportStatus({ profileId: profile.id, tone: "error", message: error instanceof Error ? error.message : "启动 ChatGPT 登录失败。" });
    }
  };

  const handleCancelCodexRuntimeLogin = async (profileId: string, attemptId: string | undefined) => {
    if (!attemptId) return;
    const result = await window.electron.cancelCodexOAuthRuntime(attemptId);
    if (!result.success) {
      setImportStatus({ profileId, tone: "error", message: result.error || "取消 ChatGPT 登录失败。" });
    }
  };

  const handleApplyManualCodexCredential = (profile: ApiConfigProfile) => {
    const raw = manualCodexCredentialDrafts[profile.id]?.trim() ?? "";
    if (!raw) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "Paste Codex credential JSON first." });
      return;
    }

    try {
      const credential = normalizeCodexManualCredentialInput(raw);
      onChange((current) => current.map((item) => (
        item.id === profile.id
          ? {
            ...item,
            apiKey: credential,
            baseURL: CODEX_OAUTH_BASE_URL,
            provider: "codex",
          }
          : item
      )));
      setManualCodexCredentialDrafts((current) => ({ ...current, [profile.id]: "" }));
      setImportStatus({ profileId: profile.id, tone: "success", message: "Manual Codex credential applied. Click the settings save button to persist it; secret values were not printed." });
    } catch (error) {
      setImportStatus({
        profileId: profile.id,
        tone: "error",
        message: error instanceof Error ? error.message : "Manual Codex credential is invalid.",
      });
    }
  };

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted">配置列表</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${sourceMeta.className}`}>
              {sourceMeta.label}
            </span>
            <span className="text-[11px] text-muted">{sourceMeta.description}</span>
          </div>
        </div>
        <div
          className="relative"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setCreateMenuOpen(false);
            }
          }}
        >
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-accent/20 bg-accent/8 px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/12"
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
            onClick={() => setCreateMenuOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setCreateMenuOpen(false);
              }
            }}
          >
            <Plus className="h-4 w-4" />
            <span>新增配置</span>
            <ChevronDown className={`h-4 w-4 text-accent/70 transition-transform ${createMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {createMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] z-[80] w-[260px] rounded-xl border border-ink-900/10 bg-white p-1.5 shadow-[0_18px_44px_rgba(24,32,46,0.16)]"
            >
              {createProfileOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="menuitem"
                  className="grid w-full cursor-pointer gap-0.5 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-ink-900/5 focus:bg-ink-900/5"
                  onClick={() => handleCreateProfile(option.create)}
                >
                  <span className="text-sm font-semibold text-ink-900">{option.label}</span>
                  <span className="text-xs leading-5 text-muted">{option.description}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4">
        {profiles.map((profile) => {
          const providerMode = getProviderMode(profile);
          const modelListExpanded = Boolean(expandedModelLists[profile.id]);
          const officialProvider = providerMode === "deepseek" || providerMode === "codex" || providerMode === "minimax";
          const codexLogin = codexRuntimeLogins[profile.id];
          return (
          <div key={profile.id} className="rounded-[28px] border border-ink-900/10 bg-white/86 p-5 shadow-[0_18px_44px_rgba(24,32,46,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink-900">{profile.name || "未命名配置"}</div>
                <div className="mt-1 text-[11px] text-muted">{profile.enabled ? "当前启用" : "未启用"}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${profile.enabled ? "bg-accent text-white" : "border border-ink-900/10 bg-white text-ink-700 hover:bg-surface"}`}
                  onClick={() => onChange((current) => {
                    const enabledCount = current.filter((item) => item.enabled).length;
                    return current.map((item) => item.id === profile.id
                      ? { ...item, enabled: item.enabled ? enabledCount <= 1 : true }
                      : item);
                  })}
                >
                  {profile.enabled ? "启用中" : "启用"}
                </button>
                {profiles.length > 1 && (
                  <button
                    type="button"
                    className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-surface hover:text-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={Boolean(codexLogin)}
                    onClick={() => {
                      if (codexLogin) return;
                      onChange((current) => {
                        const next = current.filter((item) => item.id !== profile.id);
                        if (next.every((item) => !item.enabled) && next[0]) {
                          next[0] = { ...next[0], enabled: true };
                        }
                        return next;
                      });
                    }}
                    aria-label={`删除配置 ${profile.name}`}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">配置名称</span>
                <input
                  type="text"
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  placeholder="例如：兼容网关"
                  value={profile.name}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, name: event.target.value }
                      : item
                  )))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">接口地址</span>
                <input
                  type="url"
                  className={`rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 ${officialProvider ? "cursor-not-allowed text-muted" : ""}`}
                  placeholder="https://..."
                  value={providerMode === "deepseek" ? DEEPSEEK_OFFICIAL_BASE_URL : providerMode === "codex" ? CODEX_OAUTH_BASE_URL : providerMode === "minimax" ? MINIMAX_OFFICIAL_BASE_URL : profile.baseURL}
                  readOnly={officialProvider}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, baseURL: event.target.value }
                      : item
                  )))}
                />
              </label>

              {providerMode === "codex" ? (
                <div className="grid gap-3 rounded-2xl border border-accent/15 bg-accent/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-ink-900">OpenAI 账号接入</div>
                      <div className="mt-1 text-xs leading-5 text-muted">
                        使用应用内置的官方 Codex runtime 打开 ChatGPT 登录；无需另装 Codex，敏感令牌只在主进程保存。
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {!codexLogin && (
                        <button
                          type="button"
                          className="inline-flex h-8 items-center rounded-full border border-ink-900/10 bg-white px-3 text-xs font-medium text-ink-700 transition hover:bg-surface"
                          onClick={() => void handleStartCodexRuntimeLogin(profile, "device-code")}
                        >
                          使用设备码
                        </button>
                      )}
                      <button
                        type="button"
                        className="inline-flex h-8 items-center rounded-full border border-[#F0C7B4] bg-[#FFF4EF] px-3 text-xs font-semibold text-[#C9572C] transition hover:border-[#D96B3A] hover:bg-[#FFEADF] disabled:cursor-not-allowed disabled:border-[#E5E6EB] disabled:bg-[#F7F8FA] disabled:text-[#86909C]"
                        onClick={() => codexLogin
                          ? void handleCancelCodexRuntimeLogin(profile.id, codexLogin.attemptId)
                          : void handleStartCodexRuntimeLogin(profile)}
                        disabled={codexLogin?.phase === "starting"}
                      >
                        {codexLogin?.phase === "starting"
                          ? "正在启动..."
                          : codexLogin
                            ? "取消登录"
                            : profile.apiKey.trim()
                              ? "重新连接 ChatGPT"
                              : "连接 ChatGPT"}
                      </button>
                    </div>
                  </div>
                  {codexLogin && (
                    <div className="rounded-xl border border-sky-500/15 bg-sky-50 px-3 py-2 text-xs leading-5 text-sky-800">
                      {codexLogin.phase === "starting" && "正在启动应用内置的 Codex 登录 runtime…"}
                      {codexLogin.phase === "browser" && "登录页已在系统浏览器打开，完成 ChatGPT 授权后会自动返回。"}
                      {codexLogin.phase === "device-code" && (
                        <span>
                          在已打开的页面输入设备码：<strong className="select-all font-mono text-sm tracking-wider">{codexLogin.userCode}</strong>
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 text-[11px]">
                    <span className={`rounded-full border px-2.5 py-1 font-medium ${profile.apiKey.trim() ? "border-emerald-500/20 bg-emerald-50 text-emerald-700" : "border-amber-500/20 bg-amber-50 text-amber-700"}`}>
                      {profile.apiKey.trim() ? "已保存账号凭据" : "未完成账号接入"}
                    </span>
                    <span className="rounded-full border border-ink-900/10 bg-white px-2.5 py-1 text-muted">
                      Codex 响应模型
                    </span>
                  </div>
                  <details className="rounded-2xl border border-ink-900/10 bg-white/80 px-3 py-2 text-xs text-muted">
                    <summary className="cursor-pointer select-none font-semibold text-ink-800">
                      手动凭据 JSON 兜底
                    </summary>
                    <div className="mt-3 grid gap-2">
                      <p className="leading-5">
                        仅当内置 runtime 登录无法完成时再使用这里。你可以粘贴官方 Codex auth.json 内容，或者粘贴一个包含 access_token 和 account_id 的 JSON 对象。点击应用后，这里的内容会清空，之后再点设置页保存按钮即可持久化。
                      </p>
                      <textarea
                        spellCheck={false}
                        rows={5}
                        className="w-full rounded-xl border border-ink-900/10 bg-surface px-3 py-2 font-mono text-[11px] text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                        placeholder={'{"access_token":"...","refresh_token":"...","account_id":"..."}'}
                        value={manualCodexCredentialDrafts[profile.id] ?? ""}
                        onChange={(event) => setManualCodexCredentialDrafts((current) => ({
                          ...current,
                          [profile.id]: event.target.value,
                        }))}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={!manualCodexCredentialDrafts[profile.id]?.trim()}
                          onClick={() => handleApplyManualCodexCredential(profile)}
                        >
                          应用手动凭据
                        </button>
                        <button
                          type="button"
                          className="rounded-xl border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-surface"
                          onClick={() => setManualCodexCredentialDrafts((current) => ({ ...current, [profile.id]: "" }))}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  </details>
                </div>
              ) : (
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-muted">{providerMode === "minimax" ? "Token Plan Subscription Key" : "API 密钥"}</span>
                  <input
                    type="text"
                    className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                    placeholder={providerMode === "minimax" ? "sk-cp-..." : "sk-..."}
                    value={profile.apiKey}
                    onChange={(event) => onChange((current) => current.map((item) => (
                      item.id === profile.id
                        ? { ...item, apiKey: event.target.value }
                      : item
                    )))}
                  />
                </label>
              )}

              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">模型列表</span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-emerald-500/20 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleTestConnection(profile)}
                      disabled={testingProfileId === profile.id}
                    >
                      {testingProfileId === profile.id ? "测试中..." : "测试连接"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-accent/20 bg-accent/8 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/12 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void handleImportModels(profile)}
                      disabled={importingProfileId === profile.id}
                    >
                      {importingProfileId === profile.id ? "拉取中..." : providerMode === "deepseek" ? "从 DeepSeek 拉取模型" : providerMode === "minimax" ? "从 MiniMax 拉取模型" : providerMode === "codex" ? "使用内置 Codex 模型" : "从接口拉取模型"}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl border border-ink-900/10 bg-white px-3 py-1.5 text-xs text-ink-700 hover:bg-surface"
                      onClick={() => {
                        setExpandedModelLists((current) => ({ ...current, [profile.id]: true }));
                        onChange((current) => current.map((item) => (
                          item.id === profile.id
                            ? { ...item, models: [...(item.models ?? []), createModel()] }
                            : item
                        )));
                      }}
                    >
                      + 添加模型
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-ink-900/10 bg-white text-muted transition-colors hover:bg-surface hover:text-ink-800"
                      aria-label={modelListExpanded ? "收起模型列表" : "展开模型列表"}
                      title={modelListExpanded ? "收起模型列表" : "展开模型列表"}
                      aria-expanded={modelListExpanded}
                      onClick={() => setExpandedModelLists((current) => ({ ...current, [profile.id]: !modelListExpanded }))}
                    >
                      <ChevronDown className={`h-4 w-4 transition-transform ${modelListExpanded ? "rotate-180" : ""}`} />
                    </button>
                  </div>
                </div>
                {importStatus?.profileId === profile.id && (
                  <div className={`rounded-2xl border px-3 py-2 text-xs ${
                    importStatus.tone === "success"
                      ? "border-emerald-500/20 bg-emerald-50 text-emerald-700"
                      : "border-red-500/20 bg-red-50 text-red-700"
                  }`}>
                    {importStatus.message}
                  </div>
                )}
                {modelListExpanded && (
                  <div className="grid gap-3">
                    {(profile.models ?? []).map((modelItem, modelIndex) => (
                      <div key={`${profile.id}-${modelIndex}`} className="rounded-2xl border border-ink-900/10 bg-surface p-3">
                        <div className="flex items-start gap-2">
                          <div className="grid flex-1 gap-3 lg:grid-cols-4">
                            <label className="grid gap-1.5">
                              <span className="text-[11px] font-medium text-muted">模型名</span>
                              <input
                                type="text"
                                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                                placeholder="claude-sonnet-4-5"
                                value={modelItem.name}
                                onChange={(event) => onChange((current) => current.map((item) => {
                                  if (item.id !== profile.id) return item;
                                  const models = [...(item.models ?? [])];
                                  const previousName = models[modelIndex]?.name ?? "";
                                  models[modelIndex] = { ...models[modelIndex], name: event.target.value };
                                  return {
                                    ...item,
                                    models,
                                    model: item.model === previousName ? event.target.value : item.model,
                                    expertModel: item.expertModel === previousName ? event.target.value : item.expertModel,
                                    smallModel: item.smallModel === previousName ? event.target.value : item.smallModel,
                                    imageModel: item.imageModel === previousName ? event.target.value : item.imageModel,
                                    analysisModel: item.analysisModel === previousName ? event.target.value : item.analysisModel,
                                  };
                                }))}
                              />
                            </label>

                            <label className="grid gap-1.5">
                              <span className="text-[11px] font-medium text-muted">上下文窗口</span>
                              <input
                                type="number"
                                min={1}
                                step={1}
                                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                                placeholder="例如 200000"
                                value={modelItem.contextWindow ?? ""}
                                onChange={(event) => onChange((current) => current.map((item) => {
                                  if (item.id !== profile.id) return item;
                                  const models = [...(item.models ?? [])];
                                  models[modelIndex] = {
                                    ...models[modelIndex],
                                    contextWindow: event.target.value ? Number(event.target.value) : undefined,
                                  };
                                  return { ...item, models };
                                }))}
                              />
                            </label>

                            <label className="grid gap-1.5">
                              <span className="text-[11px] font-medium text-muted">压缩阈值 (%)</span>
                              <input
                                type="number"
                                min={1}
                                max={100}
                                step={1}
                                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                                placeholder="70"
                                value={modelItem.compressionThresholdPercent ?? ""}
                                onChange={(event) => onChange((current) => current.map((item) => {
                                  if (item.id !== profile.id) return item;
                                  const models = [...(item.models ?? [])];
                                  models[modelIndex] = {
                                    ...models[modelIndex],
                                    compressionThresholdPercent: event.target.value ? Number(event.target.value) : undefined,
                                  };
                                  return { ...item, models };
                                }))}
                              />
                            </label>

                            <label className="grid gap-1.5">
                              <span className="text-[11px] font-medium text-muted">路由权重</span>
                              <input
                                type="number"
                                min={0}
                                step={1}
                                className="rounded-xl border border-ink-900/10 bg-white px-3 py-2 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                                placeholder="0"
                                value={modelItem.routingWeight ?? ""}
                                onChange={(event) => onChange((current) => current.map((item) => {
                                  if (item.id !== profile.id) return item;
                                  const models = [...(item.models ?? [])];
                                  models[modelIndex] = {
                                    ...models[modelIndex],
                                    routingWeight: event.target.value ? Number(event.target.value) : undefined,
                                  };
                                  return { ...item, models };
                                }))}
                              />
                            </label>
                          </div>

                          {(profile.models ?? []).length > 1 && (
                            <button
                              type="button"
                              className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-white hover:text-ink-700"
                              onClick={() => onChange((current) => current.map((item) => {
                                if (item.id !== profile.id) return item;
                                const models = (item.models ?? []).filter((_, index) => index !== modelIndex);
                                const deletedName = modelItem.name;
                                const fallbackModel = models[0]?.name ?? "";
                                return {
                                  ...item,
                                  models,
                                  model: item.model === deletedName ? fallbackModel : item.model,
                                  expertModel: item.expertModel === deletedName ? fallbackModel : item.expertModel,
                                  smallModel: item.smallModel === deletedName ? fallbackModel : item.smallModel,
                                  imageModel: item.imageModel === deletedName ? undefined : item.imageModel,
                                  analysisModel: item.analysisModel === deletedName ? fallbackModel : item.analysisModel,
                                };
                              }))}
                              aria-label={`删除模型 ${modelItem.name || modelIndex + 1}`}
                            >
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M6 6l12 12M18 6 6 18" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <ModelSelect
                label="默认主模型"
                value={profile.model}
                models={getAvailableModels(profile)}
                onChange={(value) => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? { ...item, model: value }
                    : item
                )))}
              />

              <ModelSelect
                label="小模型 / 后台模型"
                value={profile.smallModel ?? profile.model}
                models={getAvailableModels(profile)}
                onChange={(value) => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? { ...item, smallModel: value }
                    : item
                )))}
              />
              <span className="-mt-0.5 text-[11px] text-muted">
                用于标题生成、Haiku / small-fast 后台调用，避免 Claude Code 请求网关没有的官方小模型。
              </span>

              <ModelSelect
                label="图片预处理模型"
                value={profile.imageModel ?? ""}
                models={getAvailableModels(profile)}
                emptyOption={{ value: "", label: "不预处理图片" }}
                onChange={(value) => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? { ...item, imageModel: value || undefined }
                    : item
                )))}
              />
              <span className="-mt-0.5 text-[11px] text-muted">
                有图片附件时，先走图片模型提取 OCR 和界面摘要，再把文本交给主 Agent。
              </span>

              <ModelSelect
                label="生图模型"
                value={profile.imageGenerationModel ?? ""}
                models={getAvailableModels(profile)}
                emptyOption={{ value: "", label: "不启用生图" }}
                onChange={(value) => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? { ...item, imageGenerationModel: value || undefined }
                    : item
                )))}
              />
              <span className="-mt-0.5 text-[11px] text-muted">
                图片预处理模型负责看图；生图模型负责生成和编辑图片。生图要求网关支持 OpenAI Images 兼容接口。
              </span>

              <ModelSelect
                label="Prompt 分析模型"
                value={profile.analysisModel ?? profile.model}
                models={getAvailableModels(profile)}
                onChange={(value) => onChange((current) => current.map((item) => (
                  item.id === profile.id
                    ? { ...item, analysisModel: value }
                    : item
                )))}
              />
              <span className="-mt-0.5 text-[11px] text-muted">
                用于 Prompt 分布诊断、改写建议和上下文压缩建议，避免占用主执行模型的路由。
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
