import type { StreamMessage } from "../types.js";

export type InlineBase64ToolImage = {
  mimeType: string;
  base64Data: string;
  textContext: string;
};

export function extractInlineBase64ImageFromToolResponse(toolResponse: unknown): InlineBase64ToolImage | null {
  const contentBlocks = getContentBlocks(toolResponse);
  if (contentBlocks.length === 0) {
    return null;
  }

  const textParts: string[] = [];
  for (const block of contentBlocks) {
    if (!isRecord(block)) {
      continue;
    }

    if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
      textParts.push(block.text.trim());
      continue;
    }

    if (block.type !== "image" || !isRecord(block.source)) {
      continue;
    }

    if (block.source.type !== "base64" || typeof block.source.data !== "string") {
      continue;
    }

    const base64Data = block.source.data.replace(/\s+/g, "");
    if (!base64Data) {
      continue;
    }

    return {
      mimeType: typeof block.source.media_type === "string" && block.source.media_type.trim()
        ? block.source.media_type.trim()
        : "image/png",
      base64Data,
      textContext: textParts.join("\n"),
    };
  }

  return null;
}

export function buildToolImageReplacementText(options: {
  toolName: string;
  textContext?: string;
  summary?: string;
  error?: string;
}): string {
  const lines = [
    `Tool ${options.toolName} returned an image. The raw image was replaced with text to avoid context overflow.`,
  ];

  const normalizedTextContext = options.textContext?.trim();
  if (normalizedTextContext) {
    lines.push(`Tool note: ${normalizedTextContext}`);
  }

  const normalizedSummary = options.summary?.trim();
  if (normalizedSummary) {
    lines.push(normalizedSummary);
  }

  const normalizedError = options.error?.trim();
  if (normalizedError) {
    lines.push(`Image summary failed: ${normalizedError}`);
  }

  return lines.join("\n\n");
}

export function stripInlineBase64ImagesFromMessage(message: StreamMessage): StreamMessage {
  if (message.type !== "user" || !("message" in message) || !isRecord(message.message) || !Array.isArray(message.message.content)) {
    return message;
  }

  let didSanitize = false;
  const nextContent = message.message.content.map((block) => {
    if (!isRecord(block) || block.type !== "tool_result") {
      return block;
    }

    const imagePayload = extractInlineBase64ImageFromToolResponse({ content: block.content });
    if (!imagePayload) {
      return block;
    }

    didSanitize = true;
    return {
      ...block,
      content: buildToolImageReplacementText({
        toolName: "tool_result",
        textContext: imagePayload.textContext,
      }),
    };
  });

  if (!didSanitize) {
    return message;
  }

  return {
    ...message,
    message: {
      ...message.message,
      content: nextContent as typeof message.message.content,
    },
  };
}

function getContentBlocks(toolResponse: unknown): unknown[] {
  if (Array.isArray(toolResponse)) {
    return toolResponse;
  }

  if (isRecord(toolResponse) && Array.isArray(toolResponse.content)) {
    return toolResponse.content;
  }

  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
