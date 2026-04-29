import { readFile } from "fs/promises";
import { basename, extname } from "path";

import type { PromptAttachment } from "../types.js";
import type { ApiConfig } from "./config-store.js";
import { persistImageAttachmentReference } from "./attachment-store.js";
import { preprocessImageAttachmentsCore, type ImagePreprocessResult } from "./image-preprocessor-core.js";

const IMAGE_SUMMARY_MAX_TOKENS = 1600;
const IMAGE_MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
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
}): Promise<string | null> {
  const { config, prompt, filePath } = options;
  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return null;
  }

  const mimeType = getImageMimeType(filePath);
  if (!mimeType) {
    throw new Error(`Unsupported image format: ${filePath}`);
  }

  const buffer = await readFile(filePath);
  return summarizeBase64Image({
    config,
    prompt,
    attachmentName: basename(filePath),
    mimeType,
    base64Data: buffer.toString("base64"),
  });
}

export async function summarizeBase64Image(options: {
  config: ApiConfig | null;
  prompt: string;
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
}): Promise<string | null> {
  const { config, prompt, attachmentName, mimeType, base64Data } = options;
  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return null;
  }

  return summarizeImageBase64WithModel({
    config,
    imageModel,
    prompt,
    attachmentName,
    mimeType,
    base64Data,
  });
}

async function summarizeImageBase64WithModel(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
}): Promise<string> {
  const { config, imageModel, prompt, attachmentName, mimeType, base64Data } = options;
  assertImageUnderstandingModel(imageModel);

  if (shouldUseOpenAIChatCompletions(config.baseURL)) {
    return summarizeImageBase64WithOpenAIChat({
      config,
      imageModel,
      prompt,
      attachmentName,
      mimeType,
      base64Data,
    });
  }

  try {
    return await summarizeImageBase64WithAnthropicMessages({
      config,
      imageModel,
      prompt,
      attachmentName,
      mimeType,
      base64Data,
    });
  } catch (error) {
    if (shouldRetryWithOpenAIChat(error)) {
      return summarizeImageBase64WithOpenAIChat({
        config,
        imageModel,
        prompt,
        attachmentName,
        mimeType,
        base64Data,
      });
    }
    throw error;
  }
}

async function summarizeImageBase64WithAnthropicMessages(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
}): Promise<string> {
  const { config, imageModel, prompt, attachmentName, mimeType, base64Data } = options;
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
              text: buildImagePreprocessInstruction(prompt, attachmentName),
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Data,
              },
            },
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
    throw new Error(payload.error?.message || "图片模型没有返回可用摘要。");
  }
  assertModelActuallySawImage(text, imageModel);

  return [
    `图片附件：${attachmentName || "未命名图片"}`,
    "以下内容由图片预处理模型提取，请作为图片上下文理解：",
    text,
  ].join("\n\n");
}

async function summarizeImageBase64WithOpenAIChat(options: {
  config: ApiConfig;
  imageModel: string;
  prompt: string;
  attachmentName?: string;
  mimeType: string;
  base64Data: string;
}): Promise<string> {
  const { config, imageModel, prompt, attachmentName, mimeType, base64Data } = options;
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
              text: buildImagePreprocessInstruction(prompt, attachmentName),
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`,
              },
            },
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
    throw new Error(payload.error?.message || "图片模型没有返回可用摘要。");
  }
  assertModelActuallySawImage(text, imageModel);

  return [
    `图片附件：${attachmentName || "未命名图片"}`,
    "以下内容由图片预处理模型提取，请作为图片上下文理解：",
    text,
  ].join("\n\n");
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
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function shouldRetryWithOpenAIChat(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  return /new_api_error|endpoint not supported|not supported|\/v1\/messages/i.test(message);
}

function assertImageUnderstandingModel(imageModel: string): void {
  if (/^(gpt-|gpt_|codex|MiniMax-M2(?:\.|$))/i.test(imageModel)) {
    throw new Error(`模型 ${imageModel} 不是可用的图片理解模型，不能用于图片预处理。请在 new-api 里配置一个支持视觉理解的模型，例如 VL / vision / ocr 类模型，再在设置里选择它。`);
  }
}

function assertModelActuallySawImage(text: string, imageModel: string): void {
  if (/没有(?:看到|收到|提供)图片|未(?:看到|收到|提供)图片|no image (?:attached|provided|visible)|cannot see (?:the )?image|can't see (?:the )?image/i.test(text)) {
    throw new Error(`模型 ${imageModel} 返回了文本，但没有实际读取到图片。请换成真正支持图片理解的模型。`);
  }
}

function buildReadableImagePreprocessError(rawMessage: string, imageModel: string): string {
  const message = rawMessage.trim();
  if (/\/v1\/chat\/completions endpoint not supported|\/v1\/messages endpoint not supported|Stream must be set to true|new_api_error|convert_request_failed/i.test(message)) {
    return `模型 ${imageModel} 当前路由不支持图片预处理所需的视觉对话接口。请不要选择 codex/gpt 文本路由做图片预处理，换成 VL / vision / ocr 类模型。`;
  }
  if (/请求参数有误|upstream_error|bad response status code 400/i.test(message)) {
    return `模型 ${imageModel} 的图片预处理请求被上游拒绝，通常表示它不是图片理解模型，或 new-api 的该模型通道没有开视觉输入。`;
  }
  return `图片预处理失败：${message}`;
}

function stripDataUrlPrefix(data: string): string {
  const [, base64Data = data] = data.split(",", 2);
  return base64Data.replace(/\s+/g, "");
}

function getImageMimeType(filePath: string): string | null {
  return IMAGE_MIME_TYPES[extname(filePath).toLowerCase()] ?? null;
}

function buildImagePreprocessInstruction(prompt: string, attachmentName?: string): string {
  const normalizedPrompt = prompt.trim() || "用户未提供额外说明。";
  return [
    `你在为编码 Agent 预处理图片附件《${attachmentName || "未命名图片"}》。`,
    "请输出适合继续交给 Agent 的中文摘要，严格控制在 500 字以内。",
    "优先提取：",
    "1. 界面结构、模块布局、按钮、输入框、表格等关键元素",
    "2. 截图中可读的标题、字段名、错误提示、路径、版本号、时间、数字",
    "3. 如果是设计稿或产品图，概括核心交互和视觉层级",
    "4. 与用户当前问题最相关的信息",
    "不要输出寒暄，不要编造看不清的内容，看不清就明确说明。",
    `用户当前问题：${normalizedPrompt}`,
  ].join("\n");
}
