const BASE64_IMAGE_DATA_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const DATA_URL_PREFIX_PATTERN = /^data:/i;
const URL_PREFIX_PATTERN = /^(blob:|https?:|file:)/i;

export type AttachmentLike = {
  kind: "image" | "text";
  data: string;
  mimeType: string;
  preview?: string;
  name?: string;
  size?: number;
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
      const base64Data = stripDataUrlPrefix(attachment.data).replace(/\s+/g, "");
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

    const normalizedText = attachment.data.trim();
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
