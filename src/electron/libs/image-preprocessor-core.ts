import type { PromptAttachment } from "../types.js";

export type ImagePreprocessResult = {
  success: boolean;
  attachments: PromptAttachment[];
  usedImageModel?: string;
  error?: string;
};

export type StoredImageAttachmentReference = {
  storagePath: string;
  storageUri: string;
  size: number;
};

export type ImageAttachmentSummaryInput = {
  attachment: PromptAttachment;
};

const MAX_INLINE_IMAGE_ATTACHMENTS = 2;
const MAX_INLINE_IMAGE_BYTES = 3_000_000;

export async function preprocessImageAttachmentsCore(options: {
  imageModel?: string;
  selectedModel?: string;
  attachments: PromptAttachment[];
  failOnSummaryError?: boolean;
  persistImageAttachmentReference: (attachment: PromptAttachment) => Promise<StoredImageAttachmentReference | null>;
  summarizeImageAttachment: (input: ImageAttachmentSummaryInput) => Promise<string | null>;
}): Promise<ImagePreprocessResult> {
  const { imageModel, selectedModel, attachments, failOnSummaryError, persistImageAttachmentReference, summarizeImageAttachment } = options;
  const imageAttachments = attachments.filter((attachment) => attachment.kind === "image");

  if (imageAttachments.length === 0) {
    return { success: true, attachments };
  }

  const normalizedImageModel = imageModel?.trim();
  if (!normalizedImageModel) {
    return { success: true, attachments };
  }

  const shouldAllowInlineImages = Boolean(selectedModel?.trim() && selectedModel.trim() === normalizedImageModel);
  const nextAttachments: PromptAttachment[] = [];
  let inlineImageCount = 0;
  let inlineImageBytes = 0;

  for (const attachment of attachments) {
    if (attachment.kind !== "image") {
      nextAttachments.push(attachment);
      continue;
    }

    let storedReference: StoredImageAttachmentReference | null = null;
    let summaryText = attachment.summaryText;
    let preprocessError: unknown;

    try {
      storedReference = await persistImageAttachmentReference(attachment);
    } catch (error) {
      preprocessError = error;
    }

    try {
      const generatedSummary = await summarizeImageAttachment({ attachment });
      if (!generatedSummary && failOnSummaryError) {
        return {
          success: false,
          attachments,
          usedImageModel: normalizedImageModel,
          error: "图片模型没有返回可用摘要。",
        };
      }
      summaryText = generatedSummary ?? summaryText;
    } catch (error) {
      preprocessError = error;
      if (failOnSummaryError) {
        return {
          success: false,
          attachments,
          usedImageModel: normalizedImageModel,
          error: error instanceof Error ? error.message : `图片预处理失败：${String(error || "未知错误")}`,
        };
      }
      summaryText = summaryText ?? buildImageSummaryFallback(attachment, error);
    }

    const canKeepInlineImage =
      shouldAllowInlineImages &&
      inlineImageCount < MAX_INLINE_IMAGE_ATTACHMENTS &&
      inlineImageBytes + (attachment.size ?? 0) <= MAX_INLINE_IMAGE_BYTES;

    if (canKeepInlineImage) {
      inlineImageCount += 1;
      inlineImageBytes += attachment.size ?? 0;
    }

    nextAttachments.push({
      ...attachment,
      data: storedReference?.storageUri ?? attachment.preview ?? attachment.data,
      // preview 专门给聊天记录/UI 展示使用，必须保留浏览器能直接渲染的 data URL。
      // data/storageUri 可以指向持久化文件，runtimeData 再决定是否真正传给模型。
      preview: attachment.preview ?? attachment.data,
      runtimeData: canKeepInlineImage ? (attachment.runtimeData ?? attachment.data) : undefined,
      size: storedReference?.size ?? attachment.size,
      storagePath: storedReference?.storagePath ?? attachment.storagePath,
      storageUri: storedReference?.storageUri ?? attachment.storageUri,
      summaryText: summaryText ?? buildImageSummaryFallback(attachment, preprocessError),
    });
  }

  return {
    success: true,
    attachments: nextAttachments,
    usedImageModel: normalizedImageModel,
  };
}

function buildImageSummaryFallback(attachment: PromptAttachment, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "unknown image preprocessing error");
  return [
    `Image attachment (${attachment.name || "unnamed image"}):`,
    `The image preprocessing model did not return a usable summary. Continue with the user request using the attachment metadata and any available original image reference. Error: ${message}`,
  ].join("\n");
}
