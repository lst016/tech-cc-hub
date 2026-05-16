# src/electron/libs/image-preprocessor.ts

> 模块：`electron` · 语言：`typescript` · 行数：558

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `preprocessImageAttachments@27`
- `summarizeLocalImageFile@60`
- `summarizeBase64Image@86`
- `summarizeImageBase64WithModel@109`
- `buildImageModelCandidates@192`
- `isLikelyImageUnderstandingModel@207`
- `summarizeImageBase64WithCodexResponses@212`
- `summarizeImageBase64WithAnthropicMessages@282`
- `summarizeImageBase64WithOpenAIChat@352`
- `buildMessagesEndpoint@426`
- `buildChatCompletionsEndpoint@433`
- `shouldUseOpenAIChatCompletions@440`
- `isCodexOAuthConfig@457`
- `readCodexCredential@468`
- `stringValue@492`
- `shouldRetryWithOpenAIChat@496`
- `shouldRetryWithAnthropicMessages@501`
- `shouldRetryWithAlternateImageModel@506`
- `assertImageUnderstandingModel@511`
- `assertModelActuallySawImage@517`
- `buildReadableImagePreprocessError@523`
- `stripDataUrlPrefix@534`
- `getImageMimeType@539`
- `buildImagePreprocessInstruction@543`
- `IMAGE_SUMMARY_MAX_TOKENS@17`
- `imageAttachments@34`
- `imageModel@39`
- `imageModel@67`
- `mimeType@71`
- `buffer@76`
- `imageModel@95`
- `candidateModels@119`
- `configuredModels@194`
- `credential@222`
- `endpoint@223`
- `model@224`
- `response@227`
- `payloadText@251`
- `message@263`
- `text@265`

## 依赖输入

- `path`
- `../types.js`
- `./config-store.js`
- `./attachment-store.js`
- `./codex-oauth.js`
- `./image-preprocessor-core.js`

## 对外暴露

- `preprocessImageAttachments`
- `summarizeLocalImageFile`
- `summarizeBase64Image`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
﻿import { readFile } from "fs/promises";
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
          attachmentName,
          mimeType,
          base64Data,
        });
      }

      try {
        if (shouldUseOpenAIChatCompletions(config.baseURL)) {
          try {
            return await summarizeImageBase64WithOpenAIChat({
              config,
              imageModel: candidateModel,
              prompt,
              attachmentName,
              mimeType,
              base64Data,
            });
          } catch (error) {
            if (!shouldRetryWithAnthropicMessages(err
... (truncated)
```
