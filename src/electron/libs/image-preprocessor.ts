import { readFile } from "fs/promises";
import { basename, extname } from "path";

import type { PromptAttachment } from "../types.js";
import type { ApiConfig } from "./config-store.js";
import { persistImageAttachmentReference } from "./attachment-store.js";
import {
  CODEX_OAUTH_BASE_URL,
  CODEX_OAUTH_COMPACT_MODEL_SUFFIX,
  buildCodexRequestHeaders,
  getCodexResponsesPath,
  parseCodexOAuthCredential,
  toAnthropicMessageResponse,
  type CodexOAuthCredential,
} from "./codex-oauth.js";
import { preprocessImageAttachmentsCore, type ImagePreprocessResult } from "./image-preprocessor-core.js";

const IMAGE_SUMMARY_MAX_TOKENS = 2400;
const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
};

type ImageSummaryInput = {
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
};
export async function preprocessImageAttachments(options: {
  config: ApiConfig | null;
  prompt: string;
  selectedModel?: string;
  attachments: PromptAttachment[];
}): Promise<ImagePreprocessResult> {
  const { config, prompt, selectedModel, attachments } = options;
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");

  if (imageAttachments.length === 0) {
    return { success: true, attachments };
  }

  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return { success: true, attachments };
  }

  return preprocessImageAttachmentsCore({
    imageModel,
    selectedModel,
    attachments,
    failOnSummaryError: true,
    persistImageAttachmentReference,
    summarizeImageAttachment: ({ attachment }) => summarizeBase64Image({
      config,
      prompt,
      attachmentName: attachment.name,
      mimeType: attachment.mimeType,
      base64Data: stripDataUrlPrefix(attachment.runtimeData ?? attachment.data),
    }),
  });
}

export async function summarizeLocalImageFile(options: {
  config: ApiConfig | null;
  prompt: string;
  filePath: string;
  strictPrompt?: boolean;
}): Promise<string | null> {
  const result = await summarizeLocalImageFiles({
    config: options.config,
    prompt: options.prompt,
    files: [{ filePath: options.filePath }],
    strictPrompt: options.strictPrompt,
  });
  return result;
}

export async function summarizeLocalImageFiles(options: {
  config: ApiConfig | null;
  prompt: string;
  files: Array<{ filePath: string; attachmentName?: string }>;
  strictPrompt?: boolean;
}): Promise<string | null> {
  const { config, prompt, files } = options;
  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return null;
  }

  const images: ImageSummaryInput[] = [];
  for (const file of files) {
    const mimeType = getImageMimeType(file.filePath);
    if (!mimeType) {
      throw new Error(`Unsupported image format: ${file.filePath}`);
    }

    const buffer = await readFile(file.filePath);
    images.push({
      attachmentName: file.attachmentName ?? basename(file.filePath),
      mimeType,
      base64Data: buffer.toString("base64"),
    });
  }

  return summarizeBase64Images({
    config,
    prompt,
    images,
    strictPrompt: options.strictPrompt,
  });
}

export async function summarizeBase64Image(options: {
  config: ApiConfig | null;
  prompt: string;
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
  strictPrompt?: boolean;
}): Promise<string | null> {
  return summarizeBase64Images({
    config: options.config,
    prompt: options.prompt,
    strictPrompt: options.strictPrompt,
    images: [{
      attachmentName: options.attachmentName,
      mimeType: options.mimeType,
      base64Data: options.base64Data,
    }],
  });
}

export async function summarizeBase64Images(options: {
  config: ApiConfig | null;
  prompt: string;
  images: ImageSummaryInput[];
  strictPrompt?: boolean;
}): Promise<string | null> {
  const { config, prompt, images } = options;
  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return null;
  }

  return summarizeImagesBase64WithModel({
    config,
    imageModel,
    prompt,
    images,
    strictPrompt: options.strictPrompt,
  });
}

async function summarizeImagesBase64WithModel(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  images: ImageSummaryInput[];
  strictPrompt?: boolean;
}): Promise<string> {
  const { config, imageModel, prompt, images, strictPrompt } = options;
  if (images.length === 0) {
    throw new Error("At least one image is required for image preprocessing.");
  }
  const candidateModels = buildImageModelCandidates(config, imageModel);
  let lastError: unknown;

  for (const candidateModel of candidateModels) {
    try {
      assertImageUnderstandingModel(candidateModel);

      if (isCodexOAuthConfig(config)) {
        return summarizeImageBase64WithCodexResponses({
          config,
          imageModel: candidateModel,
          prompt,
          images,
          strictPrompt,
        });
      }

      try {
        if (shouldUseOpenAIChatCompletions(config.baseURL)) {
          try {
            return await summarizeImageBase64WithOpenAIChat({
              config,
              imageModel: candidateModel,
              prompt,
              images,
              strictPrompt,
            });
          } catch (error) {
            if (!shouldRetryWithAnthropicMessages(error)) {
              throw error;
            }
          }
        }

        return await summarizeImageBase64WithAnthropicMessages({
          config,
          imageModel: candidateModel,
          prompt,
          images,
          strictPrompt,
        });
      } catch (error) {
        if (shouldRetryWithOpenAIChat(error)) {
          return await summarizeImageBase64WithOpenAIChat({
            config,
            imageModel: candidateModel,
            prompt,
            images,
            strictPrompt,
          });
        }
        throw error;
      }
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithAlternateImageModel(error)) {
        throw error;
      }
      console.warn("[image-preprocessor] image model failed; trying alternate model if available", {
        imageModel: candidateModel,
        error: error instanceof Error ? error.message : String(error || ""),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`鍥剧墖棰勫鐞嗗け璐ワ細${String(lastError || "鏈煡閿欒")}`);
}

function buildImageModelCandidates(config: ApiConfig, preferredImageModel: string): string[] {
  const configuredModels = [
    preferredImageModel,
    config.imageModel,
    ...(config.models ?? []).map((model) => model.name),
  ].map((model) => model?.trim()).filter((model): model is string => Boolean(model));

  return Array.from(new Set(configuredModels)).filter((model, index) => {
    if (index === 0) {
      return true;
    }
    return isLikelyImageUnderstandingModel(model);
  });
}

function isLikelyImageUnderstandingModel(modelName: string): boolean {
  return /(^|[-_.])(vl|vision|visual|ocr|omni)([-_.]|$)|qwen.*vl|glm.*v|gpt-4o|gemini|grok-2-vision/i.test(modelName)
    && !/image-?0?1|speech|music|embedding|coder/i.test(modelName);
}

async function summarizeImageBase64WithCodexResponses(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  images: ImageSummaryInput[];
  strictPrompt?: boolean;
}): Promise<string> {
  const { config, imageModel, prompt, images, strictPrompt } = options;
  const credential = readCodexCredential(config);
  const endpoint = new URL(getCodexResponsesPath(imageModel), CODEX_OAUTH_BASE_URL).toString();
  const model = imageModel.endsWith(CODEX_OAUTH_COMPACT_MODEL_SUFFIX)
    ? imageModel.slice(0, -CODEX_OAUTH_COMPACT_MODEL_SUFFIX.length)
    : imageModel;
  const attachmentNames = images.map((image) => image.attachmentName || "unnamed image");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: buildCodexRequestHeaders(credential, false),
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildImagePreprocessInstruction(prompt, attachmentNames, strictPrompt),
            },
            ...images.map((image) => ({
              type: "input_image",
              image_url: `data:${image.mimeType};base64,${image.base64Data}`,
            })),
          ],
        },
      ],
      store: false,
    }),
  });

  const payloadText = await response.text();
  if (!response.ok) {
    throw new Error(buildReadableImagePreprocessError(payloadText || response.statusText, imageModel));
  }

  let payload: unknown;
  try {
    payload = JSON.parse(payloadText);
  } catch {
    throw new Error(buildReadableImagePreprocessError(payloadText || "Codex Responses returned non-JSON payload.", imageModel));
  }

  const message = toAnthropicMessageResponse(payload, imageModel);
  const text = message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text.trim())
    .filter(Boolean)
    .join("\n\n");

  if (!text) {
    throw new Error(buildReadableImagePreprocessError("Codex Responses did not return usable image summary text.", imageModel));
  }
  assertModelActuallySawImage(text, imageModel);

  return wrapImagePreprocessResult(text, attachmentNames, strictPrompt);
}

async function summarizeImageBase64WithAnthropicMessages(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  images: ImageSummaryInput[];
  strictPrompt?: boolean;
}): Promise<string> {
  const { config, imageModel, prompt, images, strictPrompt } = options;
  const attachmentNames = images.map((image) => image.attachmentName || "unnamed image");
  const response = await fetch(buildMessagesEndpoint(config.baseURL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: imageModel,
      max_tokens: IMAGE_SUMMARY_MAX_TOKENS,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildImagePreprocessInstruction(prompt, attachmentNames, strictPrompt),
            },
            ...images.map((image) => ({
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: image.base64Data,
              },
            })),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(buildReadableImagePreprocessError(message || response.statusText, imageModel));
  }

  const payload = await response.json() as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
  };

  const text = payload.content
    ?.filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter(Boolean)
    .join("\n\n");

  if (!text) {
    throw new Error(payload.error?.message || "\u56fe\u7247\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u53ef\u7528\u6458\u8981\u3002");
  }
  assertModelActuallySawImage(text, imageModel);

  return wrapImagePreprocessResult(text, attachmentNames, strictPrompt);
}

async function summarizeImageBase64WithOpenAIChat(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  images: ImageSummaryInput[];
  strictPrompt?: boolean;
}): Promise<string> {
  const { config, imageModel, prompt, images, strictPrompt } = options;
  const attachmentNames = images.map((image) => image.attachmentName || "unnamed image");
  const response = await fetch(buildChatCompletionsEndpoint(config.baseURL), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: imageModel,
      max_tokens: IMAGE_SUMMARY_MAX_TOKENS,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildImagePreprocessInstruction(prompt, attachmentNames, strictPrompt),
            },
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.base64Data}`,
              },
            })),
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(buildReadableImagePreprocessError(message || response.statusText, imageModel));
  }

  const payload = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string | Array<{ type?: string; text?: string }>;
      };
    }>;
    error?: { message?: string };
  };

  const content = payload.choices?.[0]?.message?.content;
  const text = typeof content === "string"
    ? content.trim()
    : content
      ?.filter((item) => item.type === "text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n\n");

  if (!text) {
    throw new Error(payload.error?.message || "\u56fe\u7247\u6a21\u578b\u6ca1\u6709\u8fd4\u56de\u53ef\u7528\u6458\u8981\u3002");
  }
  assertModelActuallySawImage(text, imageModel);

  return wrapImagePreprocessResult(text, attachmentNames, strictPrompt);
}

function buildMessagesEndpoint(baseURL: string): string {
  const url = new URL(baseURL);
  const trimmedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = trimmedPath.endsWith("/v1") ? `${trimmedPath}/messages` : `${trimmedPath}/v1/messages`;
  return url.toString();
}

function buildChatCompletionsEndpoint(baseURL: string): string {
  const url = new URL(baseURL);
  const trimmedPath = url.pathname.replace(/\/+$/, "");
  url.pathname = trimmedPath.endsWith("/v1") ? `${trimmedPath}/chat/completions` : `${trimmedPath}/v1/chat/completions`;
  return url.toString();
}

function shouldUseOpenAIChatCompletions(baseURL: string): boolean {
  try {
    const url = new URL(baseURL);
    const hostname = url.hostname.toLowerCase();
    const pathname = url.pathname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return true;
    }
    if (hostname.includes("anthropic.com") || pathname.includes("anthropic")) {
      return false;
    }
    return pathname.replace(/\/+$/, "").endsWith("/v1");
  } catch {
    return false;
  }
}

function isCodexOAuthConfig(config: ApiConfig): boolean {
  if (config.provider === "codex") {
    return true;
  }
  try {
    return new URL(config.baseURL).origin === new URL(CODEX_OAUTH_BASE_URL).origin;
  } catch {
    return false;
  }
}

function readCodexCredential(config: ApiConfig): CodexOAuthCredential {
  const rawApiKey = (config as unknown as { apiKey?: unknown }).apiKey;
  if (typeof rawApiKey === "string") {
    return parseCodexOAuthCredential(rawApiKey);
  }
  if (rawApiKey && typeof rawApiKey === "object" && !Array.isArray(rawApiKey)) {
    const record = rawApiKey as Record<string, unknown>;
    const accessToken = stringValue(record.access_token) || stringValue(record.accessToken);
    const accountId = stringValue(record.account_id) || stringValue(record.accountId);
    if (accessToken && accountId) {
      return {
        accessToken,
        accountId,
        refreshToken: stringValue(record.refresh_token) || stringValue(record.refreshToken) || undefined,
        email: stringValue(record.email) || undefined,
        type: stringValue(record.type) || undefined,
        expired: stringValue(record.expired) || undefined,
        lastRefresh: stringValue(record.last_refresh) || stringValue(record.lastRefresh) || undefined,
      };
    }
  }
  throw new Error("Codex OAuth \u56fe\u7247\u9884\u5904\u7406\u7f3a\u5c11\u53ef\u7528\u7684 access_token / account_id\u3002\u8bf7\u91cd\u65b0\u5b8c\u6210 Codex OAuth \u6388\u6743\u3002");
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function shouldRetryWithOpenAIChat(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /new_api_error|endpoint not supported|not supported|\/v1\/messages/i.test(message);
}

function shouldRetryWithAnthropicMessages(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /\/v1\/chat\/completions endpoint not supported|endpoint not supported/i.test(message);
}

function shouldRetryWithAlternateImageModel(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /model_not_found|No available channel|not supported|new_api_error|convert_request_failed|image_parse_error|unsupported image|upstream_error|bad response status code 400|路由不支持|上游拒绝|图片预处理请求被/i.test(message);
}

function assertImageUnderstandingModel(imageModel: string): void {
  if (/^(codex|MiniMax-M2(?:\.|$))/i.test(imageModel)) {
    throw new Error(`\u6a21\u578b ${imageModel} \u4e0d\u662f\u53ef\u7528\u7684\u56fe\u7247\u7406\u89e3\u6a21\u578b\uff0c\u4e0d\u80fd\u7528\u4e8e\u56fe\u7247\u9884\u5904\u7406\u3002\u8bf7\u5728 new-api \u91cc\u914d\u7f6e\u652f\u6301\u89c6\u89c9\u7406\u89e3\u7684\u6a21\u578b\u3002`);
  }
}

function assertModelActuallySawImage(text: string, imageModel: string): void {
  if (/no image (?:attached|provided|visible)|cannot see (?:the )?image|can't see (?:the )?image/i.test(text)) {
    throw new Error(`\u6a21\u578b ${imageModel} \u8fd4\u56de\u4e86\u6587\u672c\uff0c\u4f46\u6ca1\u6709\u5b9e\u9645\u8bfb\u53d6\u5230\u56fe\u7247\u3002\u8bf7\u6362\u6210\u771f\u6b63\u652f\u6301\u56fe\u7247\u7406\u89e3\u7684\u6a21\u578b\u3002`);
  }
}

function buildReadableImagePreprocessError(rawMessage: string, imageModel: string): string {
  const message = rawMessage.trim();
  if (/\/v1\/chat\/completions endpoint not supported|\/v1\/messages endpoint not supported|Stream must be set to true|new_api_error|convert_request_failed/i.test(message)) {
    return `\u6a21\u578b ${imageModel} \u5f53\u524d\u8def\u7531\u4e0d\u652f\u6301\u56fe\u7247\u9884\u5904\u7406\u6240\u9700\u7684\u89c6\u89c9\u5bf9\u8bdd\u63a5\u53e3\u3002\u8bf7\u6362\u6210 VL / vision / ocr / gemini / gpt-4o \u7c7b\u89c6\u89c9\u6a21\u578b\u3002`;
  }
  if (/request.*parameter|upstream_error|bad response status code 400|model_not_found|No available channel/i.test(message)) {
    return `\u6a21\u578b ${imageModel} \u7684\u56fe\u7247\u9884\u5904\u7406\u8bf7\u6c42\u88ab\u4e0a\u6e38\u62d2\u7edd\uff1a${message}`;
  }
  return `\u56fe\u7247\u9884\u5904\u7406\u5931\u8d25\uff1a${message}`;
}

function stripDataUrlPrefix(data: string): string {
  const [, base64Data = data] = data.split(",", 2);
  return base64Data.replace(/\s+/g, "");
}

function getImageMimeType(filePath: string): string | null {
  return IMAGE_MIME_TYPES[extname(filePath).toLowerCase()] ?? null;
}

function wrapImagePreprocessResult(text: string, attachmentNames: string[], strictPrompt?: boolean): string {
  if (strictPrompt) {
    return text;
  }

  return [
    `\u56fe\u7247\u9644\u4ef6\uff1a${attachmentNames.join(", ") || "\u672a\u547d\u540d\u56fe\u7247"}`,
    "\u4ee5\u4e0b\u5185\u5bb9\u7531\u56fe\u7247\u9884\u5904\u7406\u6a21\u578b\u63d0\u53d6\uff0c\u8bf7\u4f5c\u4e3a\u56fe\u7247\u4e0a\u4e0b\u6587\u7406\u89e3\uff1a",
    text,
  ].join("\n\n");
}

function buildImagePreprocessInstruction(prompt: string, attachmentNames: string[] = [], strictPrompt?: boolean): string {
  const normalizedPrompt = prompt.trim() || "\u7528\u6237\u672a\u63d0\u4f9b\u989d\u5916\u8bf4\u660e\u3002";
  const nameLabel = attachmentNames.join(", ") || "\u672a\u547d\u540d\u56fe\u7247";
  if (strictPrompt) {
    return [
      `\u4f60\u5728\u4e3a\u7f16\u7801 Agent \u9884\u5904\u7406\u56fe\u7247\u9644\u4ef6\u300a${nameLabel}\u300b\u3002`,
      "\u8bf7\u4e25\u683c\u6309\u7528\u6237\u4efb\u52a1\u8f93\u51fa\u3002\u5982\u679c\u4efb\u52a1\u8981\u6c42 JSON\uff0c\u53ea\u8f93\u51fa JSON\uff0c\u4e0d\u8981 Markdown\uff0c\u4e0d\u8981\u989d\u5916\u89e3\u91ca\u3002",
      normalizedPrompt,
    ].join("\n");
  }

  return [
    `\u4f60\u5728\u4e3a\u7f16\u7801 Agent \u9884\u5904\u7406\u56fe\u7247\u9644\u4ef6\u300a${nameLabel}\u300b\u3002`,
    "\u8bf7\u8f93\u51fa\u9002\u5408\u7ee7\u7eed\u4ea4\u7ed9 Agent \u7684\u4e2d\u6587\u6458\u8981\uff0c\u4e25\u683c\u63a7\u5236\u5728 500 \u5b57\u4ee5\u5185\u3002",
    "\u4f18\u5148\u63d0\u53d6\uff1a",
    "1. \u754c\u9762\u7ed3\u6784\u3001\u6a21\u5757\u5e03\u5c40\u3001\u6309\u94ae\u3001\u8f93\u5165\u6846\u3001\u8868\u683c\u7b49\u5173\u952e\u5143\u7d20",
    "2. \u622a\u56fe\u4e2d\u53ef\u8bfb\u7684\u6807\u9898\u3001\u5b57\u6bb5\u540d\u3001\u9519\u8bef\u63d0\u793a\u3001\u8def\u5f84\u3001\u7248\u672c\u53f7\u3001\u65f6\u95f4\u3001\u6570\u5b57",
    "3. \u5982\u679c\u662f\u8bbe\u8ba1\u7a3f\u6216\u4ea7\u54c1\u56fe\uff0c\u6982\u62ec\u6838\u5fc3\u4ea4\u4e92\u548c\u89c6\u89c9\u5c42\u7ea7",
    "4. \u4e0e\u7528\u6237\u5f53\u524d\u95ee\u9898\u6700\u76f8\u5173\u7684\u4fe1\u606f",
    "\u4e0d\u8981\u8f93\u51fa\u81c6\u6d4b\u5185\u5bb9\uff0c\u4e0d\u8981\u7f16\u9020\u770b\u4e0d\u6e05\u7684\u4fe1\u606f\uff0c\u770b\u4e0d\u6e05\u5c31\u660e\u786e\u8bf4\u660e\u3002",
    `\u7528\u6237\u5f53\u524d\u95ee\u9898\uff1a${normalizedPrompt}`,
  ].join("\n");
}
