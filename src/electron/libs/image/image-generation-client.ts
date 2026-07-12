// 生图 Image API Client：调用 OpenAI 兼容的 /images/generations 和 /images/edits。
// 详见 .omx/plans/2026-07-10-image-generation-integration.md §6。
// 不引入第三方依赖，全部使用 Node 内置 fetch / FormData / Blob。
import { readFile } from "fs/promises";
import { basename } from "path";

import {
  resolveImageGenerationRoute,
  buildImageApiEndpoint,
  type ImageGenerationRouteConfig,
  type ResolvedImageGenerationRoute,
} from "../../../shared/models/image-generation-routing.js";
import {
  persistGeneratedImageBuffer,
  validateReferenceImagePath,
  type GeneratedImageArtifact,
  type ReferenceImageValidation,
  MAX_REFERENCE_IMAGES,
  REMOTE_DOWNLOAD_TIMEOUT_MS,
} from "./image-generation-artifacts.js";

export type ImageGenerationAction = "auto" | "generate" | "edit";

export type ImageGenerationRequest = {
  prompt: string;
  action?: ImageGenerationAction;
  referenceImagePaths?: string[];
  maskPath?: string;
  size?: string;
  quality?: "auto" | "low" | "medium" | "high";
  outputFormat?: "png" | "jpeg" | "webp";
  background?: "auto" | "opaque" | "transparent";
  count?: number;
};

export type ImageGenerationSuccessResult = {
  action: "image_generate";
  success: true;
  mode: "generate" | "edit";
  model: string;
  profileId?: string;
  profileName?: string;
  artifacts: Array<Pick<GeneratedImageArtifact, "path" | "mimeType" | "sizeBytes" | "width" | "height" | "revisedPrompt">>;
  outputHint?: string;
};

export type ImageGenerationErrorResult = {
  action: "image_generate";
  success: false;
  code:
    | "NOT_CONFIGURED"
    | "UNSUPPORTED_PROVIDER"
    | "INVALID_REFERENCE"
    | "UNSUPPORTED_OPTION"
    | "AUTHENTICATION_FAILED"
    | "RATE_LIMITED"
    | "MODERATION_BLOCKED"
    | "UPSTREAM_ERROR"
    | "TIMEOUT"
    | "WRITE_FAILED";
  message: string;
  status?: number;
  requestId?: string;
};

export type ImageGenerationToolResult = ImageGenerationSuccessResult | ImageGenerationErrorResult;

const MAX_PROMPT_LENGTH = 8_000;
const MIN_COUNT = 1;
const MAX_COUNT = 4;
const REQUEST_TIMEOUT_MS = 180_000;

type ResolveContext = {
  selectedConfig: ImageGenerationRouteConfig | null;
  enabledConfigs: ImageGenerationRouteConfig[];
};

export type GenerateImageParams = {
  sessionId: string;
  cwd?: string;
  request: ImageGenerationRequest;
  context: ResolveContext;
};

const SUPPORTED_QUALITIES = new Set(["auto", "low", "medium", "high"]);
const SUPPORTED_FORMATS = new Set(["png", "jpeg", "webp"]);
const SUPPORTED_BACKGROUNDS = new Set(["auto", "opaque", "transparent"]);
const DOUBAO_SEEDREAM_MODEL_PATTERN = /(?:^|[-_])(?:doubao[-_])?seedream(?:[-_]|$)/i;

export async function generateImages(params: GenerateContext): Promise<ImageGenerationToolResult> {
  const route = resolveImageGenerationRoute(params.context.selectedConfig, params.context.enabledConfigs);
  if (!route.ok) {
    return toError(route.code, route.message);
  }

  const validation = validateRequest(params.request);
  if (!validation.ok) {
    return toError("UNSUPPORTED_OPTION", validation.error);
  }

  const mode = resolveMode(params.request);
  const endpoint = buildImageApiEndpoint(route.baseURL, mode === "edit" ? "edit" : "generate");
  if (!endpoint.ok) {
    return toError("UNSUPPORTED_OPTION", endpoint.error);
  }

  try {
    if (mode === "edit") {
      return await runEditRequest({ endpoint: endpoint.url, route, params, mode });
    }
    return await runGenerateRequest({ endpoint: endpoint.url, route, params, mode });
  } catch (error) {
    return mapExceptionToError(error);
  }
}

type GenerateContext = GenerateImageParams;
type ResolvedRoute = Extract<ResolvedImageGenerationRoute, { ok: true }>;

type RequestCommon = {
  endpoint: string;
  route: ResolvedRoute;
  params: GenerateImageParams;
  mode: "generate" | "edit";
};

function validateRequest(request: ImageGenerationRequest): { ok: true } | { ok: false; error: string } {
  const prompt = request.prompt?.trim();
  if (!prompt) {
    return { ok: false, error: "prompt 不能为空。" };
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return { ok: false, error: `prompt 过长（${prompt.length} 字符，上限 ${MAX_PROMPT_LENGTH}）。` };
  }

  const count = request.count ?? 1;
  if (!Number.isInteger(count) || count < MIN_COUNT || count > MAX_COUNT) {
    return { ok: false, error: `count 必须是 ${MIN_COUNT}-${MAX_COUNT} 之间的整数。` };
  }

  const refs = request.referenceImagePaths ?? [];
  if (refs.length > MAX_REFERENCE_IMAGES) {
    return { ok: false, error: `参考图最多 ${MAX_REFERENCE_IMAGES} 张，本次传了 ${refs.length} 张。` };
  }

  if (request.size !== undefined && !request.size.trim()) {
    return { ok: false, error: "size 不能为空。" };
  }
  if (request.quality && !SUPPORTED_QUALITIES.has(request.quality)) {
    return { ok: false, error: `quality ${request.quality} 不在支持列表内。` };
  }
  if (request.outputFormat && !SUPPORTED_FORMATS.has(request.outputFormat)) {
    return { ok: false, error: `outputFormat ${request.outputFormat} 不在支持列表内。` };
  }
  if (request.background && !SUPPORTED_BACKGROUNDS.has(request.background)) {
    return { ok: false, error: `background ${request.background} 不在支持列表内。` };
  }

  return { ok: true };
}

function resolveMode(request: ImageGenerationRequest): "generate" | "edit" {
  const action = request.action ?? "auto";
  if (action === "generate") return "generate";
  if (action === "edit") return "edit";
  // auto：有参考图走 edit，无参考图走 generate
  return (request.referenceImagePaths?.length ?? 0) > 0 ? "edit" : "generate";
}

function shouldDisableWatermark(model: string): boolean {
  return DOUBAO_SEEDREAM_MODEL_PATTERN.test(model.trim());
}

async function runGenerateRequest(ctx: RequestCommon): Promise<ImageGenerationToolResult> {
  const { endpoint, route, params } = ctx;
  const body: Record<string, unknown> = {
    model: route.model,
    prompt: params.request.prompt.trim(),
    n: params.request.count ?? 1,
  };
  if (params.request.size) body.size = params.request.size;
  if (params.request.quality) body.quality = params.request.quality;
  if (params.request.outputFormat) body.output_format = params.request.outputFormat;
  if (params.request.background) body.background = params.request.background;
  if (shouldDisableWatermark(route.model)) body.watermark = false;

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, REQUEST_TIMEOUT_MS);

  const parsed = await parseUpstreamResponse(response);
  if (!parsed.ok) {
    return parsed.error;
  }

  const artifacts = await persistResponseImages(parsed.data, params, route.model);
  if (!artifacts.ok) {
    return artifacts.error;
  }

  return buildSuccess("generate", route, artifacts.artifacts, params.request.count ?? 1);
}

async function runEditRequest(ctx: RequestCommon): Promise<ImageGenerationToolResult> {
  const { endpoint, route, params } = ctx;

  // 先校验所有参考图
  const validatedRefs: ReferenceImageValidation[] = [];
  for (const refPath of params.request.referenceImagePaths ?? []) {
    const validated = await validateReferenceImagePath({
      path: refPath,
      sessionId: params.sessionId,
      cwd: params.cwd,
    });
    if (!validated.ok) {
      return toError(validated.code, validated.message);
    }
    validatedRefs.push(validated);
  }

  const formData = new FormData();
  formData.append("model", route.model);
  formData.append("prompt", params.request.prompt.trim());
  formData.append("n", String(params.request.count ?? 1));
  if (params.request.size) formData.append("size", params.request.size);
  if (params.request.quality) formData.append("quality", params.request.quality);
  if (params.request.outputFormat) formData.append("output_format", params.request.outputFormat);
  if (params.request.background) formData.append("background", params.request.background);
  if (shouldDisableWatermark(route.model)) formData.append("watermark", "false");

  // 第一张作为 image[]；OpenAI edits 接受多个 image 字段
  for (const ref of validatedRefs) {
    if (!ref.ok) continue;
    const fileBuffer = await readFile(ref.realPath);
    const blob = new Blob([fileBuffer], { type: ref.mimeType });
    formData.append("image[]", blob, basename(ref.realPath));
  }

  if (params.request.maskPath) {
    const maskValidation = await validateReferenceImagePath({
      path: params.request.maskPath,
      sessionId: params.sessionId,
      cwd: params.cwd,
    });
    if (!maskValidation.ok) {
      return toError(maskValidation.code, maskValidation.message);
    }
    const maskBuffer = await readFile(maskValidation.realPath);
    const maskBlob = new Blob([maskBuffer], { type: maskValidation.mimeType });
    formData.append("mask", maskBlob, basename(maskValidation.realPath));
  }

  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${route.apiKey}`,
    },
    body: formData,
  }, REQUEST_TIMEOUT_MS);

  const parsed = await parseUpstreamResponse(response);
  if (!parsed.ok) {
    return parsed.error;
  }

  const artifacts = await persistResponseImages(parsed.data, params, route.model);
  if (!artifacts.ok) {
    return artifacts.error;
  }

  return buildSuccess("edit", route, artifacts.artifacts, params.request.count ?? 1);
}

type UpstreamImageData = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
};

type ParsedUpstream =
  | { ok: true; data: UpstreamImageData[] }
  | { ok: false; error: ImageGenerationErrorResult };

async function parseUpstreamResponse(response: Response): Promise<ParsedUpstream> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  const status = response.status;

  if (status === 401 || status === 403) {
    return { ok: false, error: toError("AUTHENTICATION_FAILED", `网关鉴权失败（${status}）。请检查 API Key 是否有效。`, status, requestId) };
  }
  if (status === 429) {
    return { ok: false, error: toError("RATE_LIMITED", "网关返回限流（429）。未自动重试，请稍后再试。", status, requestId) };
  }

  const rawText = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(rawText);
  } catch {
    return { ok: false, error: toError("UPSTREAM_ERROR", `网关返回非 JSON 响应（${status}）。`, status, requestId) };
  }

  if (!response.ok) {
    const message = extractUpstreamErrorMessage(payload) ?? `网关返回错误（${status}）。`;
    const code = classifyUpstreamError(status, message);
    return { ok: false, error: toError(code, message, status, requestId) };
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data) || data.length === 0) {
    return { ok: false, error: toError("UPSTREAM_ERROR", "网关响应中没有可用的图片数据。", status, requestId) };
  }

  const images: UpstreamImageData[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    images.push({
      b64_json: typeof record.b64_json === "string" ? record.b64_json : undefined,
      url: typeof record.url === "string" ? record.url : undefined,
      revised_prompt: typeof record.revised_prompt === "string" ? record.revised_prompt : undefined,
    });
  }

  if (images.length === 0) {
    return { ok: false, error: toError("UPSTREAM_ERROR", "网关响应中的图片条目为空。", status, requestId) };
  }

  return { ok: true, data: images };
}

function classifyUpstreamError(status: number, message: string): ImageGenerationErrorResult["code"] {
  const lower = message.toLowerCase();
  if (/moderat|safety|content.policy|敏感|违规|审核/.test(lower)) {
    return "MODERATION_BLOCKED";
  }
  if (status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 429) {
    return "UNSUPPORTED_OPTION";
  }
  return "UPSTREAM_ERROR";
}

function extractUpstreamErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  const message = (payload as { message?: unknown }).message;
  if (typeof message === "string") return message;
  return undefined;
}

type PersistedArtifact = Pick<GeneratedImageArtifact, "path" | "mimeType" | "sizeBytes" | "width" | "height" | "revisedPrompt">;

type PersistResult =
  | { ok: true; artifacts: PersistedArtifact[] }
  | { ok: false; error: ImageGenerationErrorResult };

async function persistResponseImages(
  images: UpstreamImageData[],
  params: GenerateImageParams,
  model: string,
): Promise<PersistResult> {
  const artifacts: PersistedArtifact[] = [];
  for (const image of images) {
    let buffer: Buffer | null = null;
    let mimeType: string | undefined;
    let suggestedName: string | undefined;

    if (image.b64_json) {
      buffer = Buffer.from(image.b64_json, "base64");
      mimeType = undefined; // 由扩展名决定
    } else if (image.url) {
      const downloaded = await downloadRemoteImage(image.url);
      if (!downloaded.ok) {
        return { ok: false, error: downloaded.error };
      }
      buffer = downloaded.buffer;
      mimeType = downloaded.mimeType;
      suggestedName = image.url.split("/").pop()?.split("?")[0];
    } else {
      continue;
    }

    try {
      const artifact = await persistGeneratedImageBuffer({
        sessionId: params.sessionId,
        buffer,
        mimeType,
        suggestedName,
        model,
        revisedPrompt: image.revised_prompt,
      });
      artifacts.push({
        path: artifact.path,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        width: artifact.width,
        height: artifact.height,
        revisedPrompt: artifact.revisedPrompt,
      });
    } catch (error) {
      return {
        ok: false,
        error: toError(
          "WRITE_FAILED",
          `生成图落盘失败：${error instanceof Error ? error.message : String(error)}`,
        ),
      };
    }
  }

  if (artifacts.length === 0) {
    return { ok: false, error: toError("UPSTREAM_ERROR", "网关响应中没有任何可落盘的图片。") };
  }

  return { ok: true, artifacts };
}

async function downloadRemoteImage(url: string): Promise<
  | { ok: true; buffer: Buffer; mimeType?: string }
  | { ok: false; error: ImageGenerationErrorResult }
> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return { ok: false, error: toError("UPSTREAM_ERROR", `远端图片 URL 无效：${url}`) };
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    return { ok: false, error: toError("UPSTREAM_ERROR", `远端图片协议不支持：${parsedUrl.protocol}`) };
  }

  try {
    const response = await fetchWithTimeout(url, { method: "GET" }, REMOTE_DOWNLOAD_TIMEOUT_MS);
    if (!response.ok) {
      return { ok: false, error: toError("UPSTREAM_ERROR", `下载远端图片失败（${response.status}）。`) };
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") ?? undefined;
    return { ok: true, buffer: Buffer.from(arrayBuffer), mimeType: mimeType?.split(";")[0] };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: toError("TIMEOUT", `下载远端图片超时（${REMOTE_DOWNLOAD_TIMEOUT_MS}ms）。`) };
    }
    return { ok: false, error: toError("UPSTREAM_ERROR", `下载远端图片失败：${error instanceof Error ? error.message : String(error)}`) };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildSuccess(
  mode: "generate" | "edit",
  route: ResolvedRoute,
  artifacts: PersistedArtifact[],
  requestedCount: number,
): ImageGenerationSuccessResult {
  const hint = artifacts.length < requestedCount
    ? `已生成 ${artifacts.length}/${requestedCount} 张。`
    : "Generated image saved locally.";
  return {
    action: "image_generate",
    success: true,
    mode,
    model: route.model,
    profileId: route.profileId,
    profileName: route.profileName,
    artifacts,
    outputHint: hint,
  };
}

function toError(
  code: ImageGenerationErrorResult["code"],
  message: string,
  status?: number,
  requestId?: string,
): ImageGenerationErrorResult {
  return { action: "image_generate", success: false, code, message, status, requestId };
}

function mapExceptionToError(error: unknown): ImageGenerationErrorResult {
  if (error instanceof Error && error.name === "AbortError") {
    return toError("TIMEOUT", `生图请求超时（${REQUEST_TIMEOUT_MS}ms）。`);
  }
  return toError(
    "UPSTREAM_ERROR",
    `生图请求失败：${error instanceof Error ? error.message : String(error)}`,
  );
}

// 暴露给测试的工具函数
export const __test__ = {
  resolveMode,
  validateRequest,
  classifyUpstreamError,
  extractUpstreamErrorMessage,
};
