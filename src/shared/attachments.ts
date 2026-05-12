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
      // silently fall back to base64, otherwise screenshots can explode context.
      const runtimeImageData = attachment.runtimeData;
      if (typeof runtimeImageData !== "string" || !isInlineImageAttachmentData(runtimeImageData)) {
        const normalizedSummary = attachment.summaryText?.trim();
        contentBlocks.push({
          type: "text",
          text: normalizedSummary
            ? `Image attachment summary (${formatAttachmentName(attachment)}):\n${normalizedSummary}`
            : `Image attachment (${formatAttachmentName(attachment)}) is present in this user turn, but no model-readable image payload or summary is available.`,
        });
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
      text: [
        `Attachment file (${formatAttachmentName(attachment)})`,
        `Type: ${attachment.mimeType || "text/plain"}`,
        "",
        "Use this attachment as the primary source for the current user request.",
        "```",
        truncateTextAttachment(normalizedText),
        "```",
      ].join("\n"),
    });
  }

  if (prompt.trim()) {
    contentBlocks.push({
      type: "text",
      text: `User request after reading the attachments first:\n${prompt.trim()}`,
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
      // preview is a UI field; keep the original data URL so local preview does
      // not break when data is replaced by a file/storage URI.
      preview: displayPreview,
      runtimeData: undefined,
    };
  }) as TAttachment[];
}

function stripDataUrlPrefix(data: string): string {
  const [, base64Data = data] = data.split(",", 2);
  return base64Data;
}

function buildAttachmentPriorityContext(attachments: AttachmentLike[]): string {
  const attachmentLines = attachments.map((attachment, index) => (
    `${index + 1}. ${formatAttachmentName(attachment)} (${attachment.kind}, ${attachment.mimeType || "unknown"}${typeof attachment.size === "number" ? `, ${attachment.size} bytes` : ""})`
  ));

  return [
    "Current user turn includes attachments. Treat these attachments as the highest-priority source for this turn.",
    "Read and use the current-turn attachments before reading workspace files, Downloads, or same-name local files.",
    "If an attachment is Postman/OpenAPI/JSON/API documentation, extract endpoints, methods, parameters, and response fields from the attachment before editing code.",
    "If an attachment is an image, analyze the image payload or image summary before deciding what the user means; do not claim the attachment is missing.",
    "",
    "Attachment list:",
    ...attachmentLines,
  ].join("\n");
}

function formatAttachmentName(attachment: Pick<AttachmentLike, "name">): string {
  const name = attachment.name?.trim();
  return name || "unnamed attachment";
}

function truncateTextAttachment(text: string, maxChars = TEXT_ATTACHMENT_PROMPT_CHAR_LIMIT): string {
  if (text.length <= maxChars) {
    return text;
  }

  return `${text.slice(0, maxChars)}\n\n[Attachment truncated; original length ${text.length} characters.]`;
}
