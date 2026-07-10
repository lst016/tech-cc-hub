// 生图路由解析：根据当前主模型所在配置，找到能真正调用 OpenAI Images API 的配置槽。
// 解析顺序见 .omx/plans/2026-07-10-image-generation-integration.md §5.3。
import type { SharedApiProviderMode } from "./model-provider-routing.js";

export type ImageGenerationRouteConfig = {
  id?: string;
  name?: string;
  provider?: SharedApiProviderMode;
  baseURL?: string;
  apiKey?: string;
  imageGenerationModel?: string;
  models?: Array<{ name: string; routingWeight?: number }>;
};

export type ImageGenerationRoute = {
  profileId: string;
  profileName: string;
  provider: SharedApiProviderMode;
  baseURL: string;
  apiKey: string;
  model: string;
};

export type ImageGenerationRouteError = {
  code: "NOT_CONFIGURED" | "UNSUPPORTED_PROVIDER";
  message: string;
};

export type ResolvedImageGenerationRoute =
  | ({ ok: true } & ImageGenerationRoute)
  | ({ ok: false } & ImageGenerationRouteError);

const CODEX_OAUTH_BASE_URL = "https://chatgpt.com";

export function isLikelyImageGenerationModel(modelName: string | undefined | null): boolean {
  const normalized = modelName?.trim();
  if (!normalized) {
    return false;
  }

  // OpenAI gpt-image 系列是最典型的生图模型；其它常见别名也纳入自动推荐范围。
  // 自定义网关不靠这条正则拦截，只在设置页“推荐”标记时使用。
  return /gpt-image|dall-?e|stable-?diffusion|sdxl|flux|midjourney|imagen|seedream|kolors|cogview|wanx/i.test(normalized);
}

function hasUsableImageGenerationSlot(config: ImageGenerationRouteConfig): boolean {
  return Boolean(
    config.imageGenerationModel?.trim()
    && config.apiKey?.trim()
    && config.baseURL?.trim()
    && config.models?.some((model) => model.name === config.imageGenerationModel?.trim()),
  );
}

/**
 * 解析生图路由。解析顺序：
 *   1. selectedConfig 优先（当前主模型所在配置），若设置了 imageGenerationModel 且可用则采用。
 *   2. 否则按 enabledConfigs 顺序找第一个已设置生图模型、API Key 非空且模型在该配置模型列表中的配置。
 *   3. provider=codex 直接返回明确错误（OAuth 不能替代标准 Images API Key）。
 *   4. provider=deepseek|minimax 只有在该配置明确返回并配置了生图模型时才允许，不靠品牌推断。
 */
export function resolveImageGenerationRoute<T extends ImageGenerationRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
): ResolvedImageGenerationRoute {
  const ordered = orderSelectedFirst(selectedConfig, enabledConfigs);

  // 命中显式生图槽位的配置
  for (const config of ordered) {
    if (!hasUsableImageGenerationSlot(config)) {
      continue;
    }
    const resolved = toRoute(config);
    if (resolved) {
      return { ok: true, ...resolved };
    }
  }

  // 没有任何配置设置了生图槽位时，根据 provider 给出可操作错误
  const codexConfig = ordered.find((config) => config.provider === "codex");
  if (codexConfig) {
    return {
      ok: false,
      code: "UNSUPPORTED_PROVIDER",
      message:
        "当前主模型走 Codex OAuth，不能替代标准 Image API。请在 设置 → API 配置 中新增 OpenAI API Key 或支持 OpenAI Images 接口的自定义网关，并为其设置生图模型。",
    };
  }

  return {
    ok: false,
    code: "NOT_CONFIGURED",
    message: "尚未配置生图模型。请到 设置 → 模型路由 → 生图模型 选择一个支持 OpenAI Images 兼容接口的模型。",
  };
}

function orderSelectedFirst<T extends ImageGenerationRouteConfig>(
  selectedConfig: T | null | undefined,
  enabledConfigs: readonly T[],
): T[] {
  if (!selectedConfig) {
    return [...enabledConfigs];
  }

  const selectedId = selectedConfig.id?.trim();
  const matchesSelected = (config: T) => (
    selectedId
      ? config.id?.trim() === selectedId
      : config === selectedConfig
  );

  return [
    selectedConfig,
    ...enabledConfigs.filter((config) => !matchesSelected(config)),
  ];
}

function toRoute(config: ImageGenerationRouteConfig): ImageGenerationRoute | null {
  const model = config.imageGenerationModel?.trim();
  const apiKey = config.apiKey?.trim();
  const baseURL = config.baseURL?.trim();
  const provider = (config.provider ?? "custom") as SharedApiProviderMode;

  if (!model || !apiKey || !baseURL) {
    return null;
  }

  // provider=codex 永远拒绝：OAuth token 不能用于标准 Images API
  if (provider === "codex") {
    return null;
  }

  return {
    profileId: config.id?.trim() || "",
    profileName: config.name?.trim() || "未命名配置",
    provider,
    baseURL,
    apiKey,
    model,
  };
}

/**
 * Endpoint 规范化：仅接受能安全归一到 OpenAI 兼容 /v1 的 base URL。
 * 详见 §6.3。遇到 /anthropic、/messages 等专用路径时返回错误，不静默猜测。
 */
export function normalizeImageApiBaseURL(baseURL: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = baseURL.trim();
  if (!trimmed) {
    return { ok: false, error: "Images API Base URL 为空。" };
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: `Images API Base URL 格式不正确：${trimmed}` };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: `仅支持 http/https 的 Images API 入口：${trimmed}` };
  }

  // Codex OAuth 域名直接拒绝
  if (url.hostname === "chatgpt.com") {
    return { ok: false, error: "Codex OAuth 不能替代标准 Image API。请配置支持 OpenAI Images 接口的网关。" };
  }

  const pathname = url.pathname.replace(/\/+$/, "");

  // 专用 Anthropic 路径不静默猜测，提示用户单独配置 Images API 入口
  if (/\/(anthropic|messages|completions|chat)\b/i.test(pathname)) {
    return {
      ok: false,
      error:
        `当前 Base URL 路径 ${pathname || "/"} 看起来是文本对话专用入口，不能直接当 Images API。` +
        "请在配置里把 Base URL 改为 OpenAI 兼容的 /v1 根入口，或联系网关确认 Images 接口路径。",
    };
  }

  if (!pathname || pathname === "/" || pathname.startsWith("/console")) {
    url.pathname = "/v1";
  } else if (!pathname.startsWith("/v1")) {
    // 已带其它前缀（例如 /openai/v1）时原样保留，只保证不以 /v1 结尾重复
    if (!pathname.endsWith("/v1")) {
      url.pathname = `${pathname}/v1`.replace(/\/+/g, "/");
    }
  }

  return { ok: true, url: url.toString().replace(/\/$/, "") };
}

export function buildImageApiEndpoint(baseURL: string, action: "generate" | "edit"): { ok: true; url: string } | { ok: false; error: string } {
  const normalized = normalizeImageApiBaseURL(baseURL);
  if (!normalized.ok) {
    return normalized;
  }
  const suffix = action === "edit" ? "images/edits" : "images/generations";
  return { ok: true, url: `${normalized.url}/${suffix}` };
}

export { CODEX_OAUTH_BASE_URL };
