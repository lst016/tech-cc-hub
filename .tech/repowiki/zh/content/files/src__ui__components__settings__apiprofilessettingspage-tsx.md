# src/ui/components/settings/ApiProfilesSettingsPage.tsx

> 模块：`ui-shell` · 语言：`tsx` · 行数：959

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `isDeepSeekBaseURL@95`
- `getProviderMode@103`
- `buildModelsEndpoint@111`
- `normalizeApiBaseURL@131`
- `getModelIds@155`
- `isLikelyVisionUnderstandingModel@172`
- `fetchModelsInBrowser@177`
- `normalizeMessagesBaseURL@214`
- `testApiConfigInBrowser@228`
- `buildCodexGuidePrompt@270`
- `ApiProfilesSettingsPage@305`
- `DEFAULT_IMPORTED_CONTEXT_WINDOW@47`
- `DEEPSEEK_CONTEXT_WINDOW@49`
- `DEEPSEEK_MODELS_ENDPOINT@50`
- `url@119`
- `trimmedPath@121`
- `url@139`
- `trimmedPath@141`
- `data@158`
- `endpoint@188`
- `response@189`
- `message@197`
- `payload@200`
- `url@222`
- `trimmedPath@224`
- `baseURL@230`
- `model@231`
- `endpoint@240`
- `response@241`
- `text@255`
- `sourceMeta@307`
- `handleImportModels@314`
- `provider@317`
- `baseURL@318`
- `electronApi@326`
- `result@329`
- `modelIds@341`
- `existingModels@344`
- `nextModels@345`
- `fallbackModel@350`

## 依赖输入

- `../../types`
- `../../dev-electron-shim`
- `./ChannelsSettingsPage`
- `lucide-react`
- `../../../shared/codex-oauth`
- `./settings-utils`
- `react`

## 对外暴露

- `ApiProfilesSettingsPage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```tsx
import type { ApiConfigProfile } from "../../types";
import type { DevElectronRuntimeSource } from "../../dev-electron-shim";
import type { ChannelGuideSessionRequest } from "./ChannelsSettingsPage";
import { ChevronDown, Plus } from "lucide-react";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_DEFAULT_MODEL,
  CODEX_OAUTH_MODELS,
  CODEX_OAUTH_SMALL_MODEL,
  mergeCodexModelIds,
} from "../../../shared/codex-oauth";
import {
  createCodexOAuthProfile,
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
  onStartGuideSession?: (request: ChannelGuideSessionRequest) => Promise<void> | void;
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
  {
    id: "codex",
    label: "Codex OAuth",
    description: "通过 OpenAI OAuth 接入 Codex Responses 模型。",
    create: createCodexOAuthProfile,
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
  if (profile.provider === "custom" || profile.provider === "deepseek" || profile.provider === "codex") {
    return profile.provider;
  }

  return isDeepSeekBaseURL(profile.baseURL) ? "deepseek" : "custom";
}

function buildModelsEndpoint(baseURL: string, provider: ApiProviderMode = "custom"): string {
  if (provider === "deepseek") {
    return DEEPSEEK_MODELS_ENDPOINT;
  }
  if (provider === "codex") {
    return `${CODEX_OAUTH_BASE_URL}/backend-api/codex/models`;
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

  const url = new URL(baseURL.trim());
  const trimmedPath = url.pathname.replace(/\/+$/, "");

  if (!trimmedPath || trimmedPath === "/" || trimmedPath.startsWith("/console")) {
    url.pathname = "/v1";
    return url.toString().replace(/\/$/, "");
  }

  if (trim
... (truncated)
```
