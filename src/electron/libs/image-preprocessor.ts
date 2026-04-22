import { readFile } from "fs/promises";
import { basename, extname } from "path";

import type { PromptAttachment } from "../types.js";
import type { ApiConfig } from "./config-store.js";

export type ImagePreprocessResult = {
  success: boolean;
  attachments: PromptAttachment[];
  usedImageModel?: string;
  error?: string;
};

const IMAGE_SUMMARY_MAX_TOKENS = 900;
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
  attachments: PromptAttachment[];
}): Promise<ImagePreprocessResult> {
  const { config, prompt, attachments } = options;
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");

  if (imageAttachments.length === 0) {
    return { success: true, attachments };
  }

  const imageModel = config?.imageModel?.trim();
  if (!config || !imageModel) {
    return { success: true, attachments };
  }

  const nextAttachments: PromptAttachment[] = [];
  for (const attachment of attachments) {
    if (attachment.kind !== "image") {
      nextAttachments.push(attachment);
      continue;
    }

    try {
      const summary = await summarizeBase64Image({
        config,
        prompt,
        attachmentName: attachment.name,
        mimeType: attachment.mimeType,
        base64Data: stripDataUrlPrefix(attachment.data),
      });
      if (!summary) {
        nextAttachments.push(attachment);
        continue;
      }
      nextAttachments.push({
        id: `${attachment.id}-summary`,
        kind: "text",
        name: `${attachment.name || "image"}-summary.txt`,
        mimeType: "text/plain",
        data: summary,
        preview: summary,
        size: summary.length,
      });
    } catch (error) {
      return {
        success: false,
        attachments,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    success: true,
    attachments: nextAttachments,
    usedImageModel: imageModel,
  };
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
    throw new Error(`图片预处理失败：${message || response.statusText}`);
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
