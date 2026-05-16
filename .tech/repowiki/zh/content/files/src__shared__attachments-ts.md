# src/shared/attachments.ts

> 模块：`shared` · 语言：`typescript` · 行数：249

## 文件职责

处理图片和文本附件的存储、预览和 prompt 字符估算，支持 data URL 和文件路径解析

## 关键符号

- `AttachmentLike@0 - 附件数据结构，支持 kind、data、mimeType、preview、size 等字段`
- `estimateAttachmentPromptChars@0 - 估算附件在 prompt 中的字符占用，包含图像 runtimeData 编码估算和文本摘要估算`
- `resolveImageAttachmentSrc@0 - 从 preview/runtimeData/data/storageUri 候选中解析图片实际来源`
- `buildAnthropicPromptContentBlocks@0 - 构建 Anthropic API 格式的内容块数组`
- `stripDataUrlPrefix@0 - 剥离 data URL 前缀获取纯 base64 数据`

## 对外暴露

- `TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT`
- `AttachmentLike`
- `StoredUserPromptMessage`
- `createStoredUserPromptMessage`
- `estimateAttachmentPromptChars`
- `resolveImageAttachmentSrc`
- `isInlineImageAttachmentData`
- `buildAnthropicPromptContentBlocks`
- `sanitizePromptAttachmentsForStorage`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
const BASE64_IMAGE_DATA_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const DATA_URL_PREFIX_PATTERN = /^data:/i;
const URL_PREFIX_PATTERN = /^(blob:|https?:|file:)/i;
export const TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT = 120_000;

export type AttachmentLike = {
  kind: "image" | "text";
  data: string;
  runtimeData?: string;
  mimeType: string;
  preview?: string;
  name?: string;
  size?: number;
  storagePath?: string;
  storageUri?: string;
  summaryText?: string;
};

export type StoredUserPromptMessage<TAttachment> = {
  type: "user_prompt";
  prompt: string;
  attachments?: TAttachment[];
};

export function createStoredUserPromptMessage<TAttachment>(
  prompt: string,
  attachments?: TAttachment[],
): StoredUserPromptMessage<TAttachment> {
  if (!attachments || attachments.length === 0) {
    return {
      type: "user_prompt",
      prompt,
    };
  }

  return {
    type: "user_prompt",
    prompt,
    attachments,
  };
}

export function estimateAttachmentPromptChars(attachment: AttachmentLike): number {
  const priorityLine = `${formatAttachmentName(attachment)} (${attachment.kind}, ${attachment.mimeType || "unknown"}${typeof attachment.size === "number" ? `, ${attachment.size} bytes` : ""})`;

  if (attachment.kind === "image") {
    const runtimeImageData = attachment.runtimeData?.trim();
    if (runtimeImageData && isInlineImageAttachmentData(runtimeImageData)) {
      return priorityLine.length + stripDataUrlPrefix(runtimeImageData).replace(/\s+/g, "").length;
    }

    const normalizedSummary = attachment.summaryText?.trim();
    if (normalizedSummary) {
      return priorityLine.length + `Image attachment summary (${formatAttachmentName(attachment)}):\n${normalizedSummary}`.length;
    }

    return priorityLine.length + `Image attachment (${formatAttachmentName(attachment)}) is present in this user turn, but no model-readable image payload or summary is available.`.length;
  }

  const normalizedText = (attachment.summaryText ?? attachment.data).trim();
  if (!normalizedText) {
    return priorityLine.length;
  }

  return priorityLine.length + [
    `Attachment file (${formatAttachmentName(attachment)})`,
    `Type: ${attachment.mimeType || "text/plain"}`,
    "",
    "Use this attachment as the primary source for the current user request.",
    "```",
    truncateTextAttachment(normalizedText),
    "```",
  ].join("\n").length;
}

export function resolveImageAttachmentSrc(
  attachment: Pick<AttachmentLike, "data" | "mimeType" | "preview" | "runtimeData" | "storageUri">,
): string {
  const candidates = [
    attachment.preview,
    attachment.runtimeData,
    attachment.data,
    attachment.storageUri,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (DATA_URL_PREFIX_PATTERN.test(candidate) || URL_PREFIX_PATTERN.test(candidate)) {
      return candidate;
    }

    const normalizedBase64 = candidate.replace(/\s+/g, "");
    if (normalizedBase64 && BASE64_IMAGE_DATA_PATTERN.test(normalizedBase64)) {
      return `data:${attachment.mimeType || "image/png"};base64,${normalizedBase64}`;
    }
  }

  return candidates[0] ?? "";
}

export function isInlineImageAttachmentData(data?: string): boolean {
  if (!data) {
    return false;
  }

  const candidate = data.trim();
  if (!candidate) {
    return false;
  }

  if (DATA_URL_PREFIX_PATTERN.test(candidate)) {
    return true;
  }

  const normalizedBase64 = candidate.replace(/\s+/g, "");
  return Boolean(normalizedBase64 && BASE64_IMAGE_DATA_PATTERN.test(normalizedBase64));
}

export function buildAnthropicPromptContentBlocks(
  prompt: string,
  attachments: AttachmentLike[],
): Array<Record<string, unknown>> {
  const contentBlocks: Array<Record<string, unknown>> = [];

  if (attachments.length > 0) {
    contentBlocks.push({
      type: "text",
      text: buildAttachmentPriorityContext(attachments),
    });
  }

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      // Only runtimeData is allowed into the main Agent image block.
      // data/preview are often UI preview or local asset references and should not
      // silently fall back to base64, other
... (truncated)
```
