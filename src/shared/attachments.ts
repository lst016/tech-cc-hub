const BASE64_IMAGE_DATA_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const DATA_URL_PREFIX_PATTERN = /^data:/i;
const URL_PREFIX_PATTERN = /^(blob:|https?:|file:)/i;

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

export function resolveImageAttachmentSrc(attachment: Pick<AttachmentLike, "data" | "mimeType" | "preview">): string {
  const candidate = (attachment.preview ?? attachment.data ?? "").trim();
  if (!candidate) {
    return "";
  }

  if (DATA_URL_PREFIX_PATTERN.test(candidate) || URL_PREFIX_PATTERN.test(candidate)) {
    return candidate;
  }

  const normalizedBase64 = candidate.replace(/\s+/g, "");
  if (normalizedBase64 && BASE64_IMAGE_DATA_PATTERN.test(normalizedBase64)) {
    return `data:${attachment.mimeType || "image/png"};base64,${normalizedBase64}`;
  }

  return candidate;
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

  if (prompt.trim()) {
    contentBlocks.push({
      type: "text",
      text: prompt.trim(),
    });
  }

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      // 只有 runtimeData 才允许进入主 Agent 的图片块。
      // data/preview 常用于 UI 预览和本地资产引用，不能兜底成 base64，否则截图会打爆主上下文。
      const runtimeImageData = attachment.runtimeData;
      if (typeof runtimeImageData !== "string" || !isInlineImageAttachmentData(runtimeImageData)) {
        const normalizedSummary = attachment.summaryText?.trim();
        if (normalizedSummary) {
          contentBlocks.push({
            type: "text",
            text: normalizedSummary,
          });
        }
        continue;
      }

      const base64Data = stripDataUrlPrefix(runtimeImageData).replace(/\s+/g, "");
      if (!base64Data) {
        continue;
      }

      contentBlocks.push({
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.mimeType,
          data: base64Data,
        },
      });
      continue;
    }

    const normalizedText = (attachment.summaryText ?? attachment.data).trim();
    if (!normalizedText) {
      continue;
    }

    contentBlocks.push({
      type: "text",
      text: `附件文件：${attachment.name ?? "未命名附件"}\n\`\`\`\n${truncateTextAttachment(normalizedText)}\n\`\`\``,
    });
  }

  return contentBlocks;
}

export function sanitizePromptAttachmentsForStorage<TAttachment extends AttachmentLike>(attachments?: TAttachment[]): TAttachment[] | undefined {
  if (!attachments?.length) {
    return attachments;
  }

  return attachments.map((attachment) => {
    if (attachment.kind !== "image") {
      return attachment;
    }

    const storageUri = attachment.storageUri?.trim() || attachment.preview?.trim() || attachment.data.trim();
    const displayPreview = attachment.preview?.trim() || attachment.data.trim();
    return {
      ...attachment,
      data: storageUri,
      // preview 是 UI 预览字段，保留原始 data URL 可以避免 localhost/浏览器预览加载 file:// 碎图。
      preview: displayPreview,
      runtimeData: undefined,
    };
  }) as TAttachment[];
}

function stripDataUrlPrefix(data: string): string {
  const [, base64Data = data] = data.split(",", 2);
  return base64Data;
}

function truncateTextAttachment(text: string, maxChars = 20_000): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n\n[已截断，原始长度 ${text.length} 字符]`;
}
