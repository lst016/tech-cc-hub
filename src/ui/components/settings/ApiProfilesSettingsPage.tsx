import type { ApiConfigProfile } from "../../types";
import type { DevElectronRuntimeSource } from "../../dev-electron-shim";
import { ChevronDown, Plus } from "lucide-react";
import {
  createDeepSeekOfficialProfile,
  createModel,
  createProfile,
  DEEPSEEK_OFFICIAL_BASE_URL,
  DEEPSEEK_OFFICIAL_MODELS,
  getAvailableModels,
} from "./settings-utils";
import { useState } from "react";

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

type ModelImportStatus = {
  profileId: string;
  tone: "error" | "success";
  message: string;
} | null;

type ApiProviderMode = NonNullable<ApiConfigProfile["provider"]>;

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
];

type ApiProfileTestResult = {
  success: boolean;
  message?: string;
  endpoint?: string;
  model?: string;
  error?: string;
};

function isDeepSeekBaseURL(baseURL: string | undefined): boolean {
  try {
    return new URL(baseURL?.trim() || "").hostname === "api.deepseek.com";
  } catch {
    return false;
  }
}

function getProviderMode(profile: ApiConfigProfile): ApiProviderMode {
  if (profile.provider === "custom" || profile.provider === "deepseek") {
    return profile.provider;
  }

  return isDeepSeekBaseURL(profile.baseURL) ? "deepseek" : "custom";
}

function buildModelsEndpoint(baseURL: string, provider: ApiProviderMode = "custom"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_MODELS_ENDPOINT;
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

function getModelIds(payload: unknown): string[] {
  if (typeof payload !== "object" || payload === null) return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  return Array.from(new Set(data
    .map((item) => {
      if (typeof item === "string") return item;
      if (typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string") {
        return (item as { id: string }).id;
      }
      return "";
    })
    .map((item) => item.trim())
    .filter(Boolean)));
}

function isLikelyVisionUnderstandingModel(modelName: string): boolean {
  return /(^|[-_.])(vl|vision|visual|ocr|omni)([-_.]|$)|qwen.*vl|glm.*v|gpt-4o|gemini.*vision/i.test(modelName)
    && !/image-?0?1|speech|music|hailuo/i.test(modelName);
}

async function fetchModelsInBrowser(baseURL: string, apiKey: string, provider: ApiProviderMode = "custom"): Promise<{ success: boolean; models?: string[]; baseURL?: string; error?: string }> {
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
    return {
      success: true,
      models: getModelIds(payload),
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

  const url = new URL(baseURL.trim());
  const trimmedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = trimmedPath.endsWith("/v1") ? trimmedPath : `${trimmedPath || ""}/v1`;
  return url.toString().replace(/\/$/, "");
}

async function testApiConfigInBrowser(profile: ApiConfigProfile, provider: ApiProviderMode): Promise<ApiProfileTestResult> {
  const baseURL = provider === "deepseek" ? DEEPSEEK_OFFICIAL_BASE_URL : profile.baseURL.trim();
  const model = profile.model?.trim() || profile.models?.find((item) => item.name.trim())?.name.trim() || "";
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

export function ApiProfilesSettingsPage({ profiles, runtimeSource, onChange }: ApiProfilesSettingsPageProps) {
  const sourceMeta = runtimeSourceMeta[runtimeSource];
  const [importingProfileId, setImportingProfileId] = useState<string | null>(null);
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<ModelImportStatus>(null);
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [expandedModelLists, setExpandedModelLists] = useState<Record<string, boolean>>({});

  const handleImportModels = async (profile: ApiConfigProfile) => {
    setImportStatus(null);
    const provider = getProviderMode(profile);
    const baseURL = provider === "deepseek" ? DEEPSEEK_OFFICIAL_BASE_URL : profile.baseURL.trim();

    if (!baseURL) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "请先填写接口地址。" });
      return;
    }
    if (!profile.apiKey.trim()) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "请先填写 API 密钥。" });
      return;
    }

    setImportingProfileId(profile.id);
    try {
      const electronApi = window.electron as typeof window.electron & {
        fetchApiModels?: (payload: { baseURL: string; apiKey: string; provider?: ApiProviderMode }) => Promise<{ success: boolean; models?: string[]; baseURL?: string; error?: string }>;
      };
      const result = typeof electronApi.fetchApiModels === "function"
        ? await electronApi.fetchApiModels({ baseURL, apiKey: profile.apiKey, provider })
        : await fetchModelsInBrowser(baseURL, profile.apiKey, provider);

      if (!result.success) {
        if (provider === "deepseek") {
          const modelIds = [...DEEPSEEK_OFFICIAL_MODELS];
          onChange((current) => current.map((item) => {
            if (item.id !== profile.id) return item;
            const existingModels = new Map((item.models ?? []).map((model) => [model.name, model]));
            const nextModels = modelIds.map((name) => ({
              name,
              contextWindow: existingModels.get(name)?.contextWindow ?? DEEPSEEK_CONTEXT_WINDOW,
              compressionThresholdPercent: existingModels.get(name)?.compressionThresholdPercent ?? 70,
            }));
            const fallbackModel = item.model && modelIds.includes(item.model as typeof DEEPSEEK_OFFICIAL_MODELS[number]) ? item.model : modelIds[0];
            return {
              ...item,
              baseURL: DEEPSEEK_OFFICIAL_BASE_URL,
              models: nextModels,
              model: fallbackModel,
              expertModel: item.expertModel && modelIds.includes(item.expertModel as typeof DEEPSEEK_OFFICIAL_MODELS[number]) ? item.expertModel : "deepseek-v4-pro",
              smallModel: item.smallModel && modelIds.includes(item.smallModel as typeof DEEPSEEK_OFFICIAL_MODELS[number]) ? item.smallModel : "deepseek-v4-flash",
              imageModel: undefined,
              analysisModel: item.analysisModel && modelIds.includes(item.analysisModel as typeof DEEPSEEK_OFFICIAL_MODELS[number]) ? item.analysisModel : fallbackModel,
              provider: "deepseek",
            };
          }));
          setImportStatus({
            profileId: profile.id,
            tone: "success",
            message: `官方模型接口暂时没拉到，已使用内置 DeepSeek 模型列表；原始错误：${result.error || "未知错误"}`,
          });
          return;
        }
        throw new Error(result.error || "拉取模型失败。");
      }

      const modelIds = result.models ?? [];
      if (modelIds.length === 0) {
        throw new Error("接口没有返回可用模型。");
      }

      const normalizedBaseURL = result.baseURL ?? normalizeApiBaseURL(baseURL, provider);
      onChange((current) => current.map((item) => {
        if (item.id !== profile.id) return item;
        const existingModels = new Map((item.models ?? []).map((model) => [model.name, model]));
        const nextModels = modelIds.map((name) => ({
          name,
          contextWindow: existingModels.get(name)?.contextWindow ?? (provider === "deepseek" ? DEEPSEEK_CONTEXT_WINDOW : DEFAULT_IMPORTED_CONTEXT_WINDOW),
          compressionThresholdPercent: existingModels.get(name)?.compressionThresholdPercent ?? 70,
        }));
        const fallbackModel = item.model && modelIds.includes(item.model) ? item.model : modelIds[0];
        const fallbackAnalysisModel = item.analysisModel && modelIds.includes(item.analysisModel) ? item.analysisModel : fallbackModel;
        const fallbackExpertModel = item.expertModel && modelIds.includes(item.expertModel) ? item.expertModel : fallbackModel;
        const fallbackSmallModel = item.smallModel && modelIds.includes(item.smallModel) ? item.smallModel : fallbackAnalysisModel;
        const fallbackImageModel = item.imageModel && modelIds.includes(item.imageModel) && isLikelyVisionUnderstandingModel(item.imageModel)
          ? item.imageModel
          : modelIds.find(isLikelyVisionUnderstandingModel);

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
      setImportStatus({ profileId: profile.id, tone: "success", message: `已拉取 ${modelIds.length} 个模型，接口地址已规范为 ${normalizedBaseURL}` });
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
    const baseURL = provider === "deepseek" ? DEEPSEEK_OFFICIAL_BASE_URL : profile.baseURL.trim();
    const model = profile.model?.trim() || profile.models?.find((item) => item.name.trim())?.name.trim() || "";

    if (!baseURL || !profile.apiKey.trim() || !model) {
      setImportStatus({ profileId: profile.id, tone: "error", message: "请先填写接口地址、API Key 和默认主模型。" });
      return;
    }

    setTestingProfileId(profile.id);
    try {
      const electronApi = window.electron as typeof window.electron & {
        testApiConfig?: (payload: { baseURL: string; apiKey: string; model: string; provider?: ApiProviderMode }) => Promise<ApiProfileTestResult>;
      };
      const result = typeof electronApi.testApiConfig === "function"
        ? await electronApi.testApiConfig({ baseURL, apiKey: profile.apiKey, model, provider })
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
                    className="rounded-full border border-ink-900/10 p-2 text-muted hover:bg-surface hover:text-ink-700"
                    onClick={() => onChange((current) => {
                      const next = current.filter((item) => item.id !== profile.id);
                      if (next.every((item) => !item.enabled) && next[0]) {
                        next[0] = { ...next[0], enabled: true };
                      }
                      return next;
                    })}
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
                  className={`rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 ${providerMode === "deepseek" ? "cursor-not-allowed text-muted" : ""}`}
                  placeholder="https://..."
                  value={providerMode === "deepseek" ? DEEPSEEK_OFFICIAL_BASE_URL : profile.baseURL}
                  readOnly={providerMode === "deepseek"}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, baseURL: event.target.value }
                      : item
                  )))}
                />
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">API 密钥</span>
                <input
                  type="text"
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 placeholder:text-muted-light transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  placeholder="sk-..."
                  value={profile.apiKey}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, apiKey: event.target.value }
                      : item
                  )))}
                />
              </label>

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
                      {importingProfileId === profile.id ? "拉取中..." : providerMode === "deepseek" ? "从 DeepSeek 拉取模型" : "从接口拉取模型"}
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
                          <div className="grid flex-1 gap-3 lg:grid-cols-3">
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

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">默认主模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.model}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, model: event.target.value }
                      : item
                  )))}
                >
                  {getAvailableModels(profile).map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">小模型 / 后台模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.smallModel ?? profile.model}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, smallModel: event.target.value }
                      : item
                  )))}
                >
                  {getAvailableModels(profile).map((item) => (
                    <option key={`small-${item}`} value={item}>{item}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  用于标题生成、Haiku / small-fast 后台调用，避免 Claude Code 请求网关没有的官方小模型。
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">图片预处理模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.imageModel ?? ""}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, imageModel: event.target.value || undefined }
                      : item
                  )))}
                >
                  <option value="">不预处理图片</option>
                  {getAvailableModels(profile).map((item) => (
                    <option key={`image-${item}`} value={item}>{item}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  有图片附件时，先走图片模型提取 OCR 和界面摘要，再把文本交给主 Agent。
                </span>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-muted">Prompt 分析模型</span>
                <select
                  className="rounded-xl border border-ink-900/10 bg-surface px-4 py-2.5 text-sm text-ink-800 transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
                  value={profile.analysisModel ?? profile.model}
                  onChange={(event) => onChange((current) => current.map((item) => (
                    item.id === profile.id
                      ? { ...item, analysisModel: event.target.value }
                      : item
                  )))}
                >
                  {getAvailableModels(profile).map((item) => (
                    <option key={`analysis-${item}`} value={item}>{item}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted">
                  用于 Prompt 分布诊断、改写建议和上下文压缩建议，避免占用主执行模型的路由。
                </span>
              </label>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
