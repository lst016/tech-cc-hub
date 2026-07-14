import type { PromptAttachment, StreamMessage } from "./types.js";

type ConversationEntry = { role: "user" | "assistant"; text: string };

type ContentBlock = Record<string, unknown>;

export type StatelessContinuationOptions = {
  contextWindow?: number;
  compressionThresholdPercent?: number;
  recentTurnCount?: number;
  existingSummary?: string;
  existingSummaryMessageCount?: number;
  forceCompression?: boolean;
  historyMessageCount?: number;
};

export type StatelessContinuationPayload = {
  prompt: string;
  usedCompression: boolean;
  summaryText?: string;
  summaryMessageCount: number;
  estimatedTokens: number;
};

const DEFAULT_RECENT_TURN_COUNT = 5;
const SUMMARY_ENTRY_PREVIEW_LIMIT = 6;
const SUMMARY_TEXT_LIMIT = 160;
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEFAULT_COMPRESSION_THRESHOLD_PERCENT = 70;
const DEFAULT_IMAGE_ATTACHMENT_TOKEN_ESTIMATE = 6_000;
const ATTACHMENT_HISTORY_TEXT_LIMIT = 280;

function summarizeAttachments(attachments?: PromptAttachment[]): string {
  if (!attachments || attachments.length === 0) {
    return "";
  }

  const imageCount = attachments.filter((attachment) => attachment.kind === "image").length;
  const textCount = attachments.filter((attachment) => attachment.kind === "text").length;
  const summaryParts = [`${attachments.length} attachment${attachments.length === 1 ? "" : "s"}`];

  if (imageCount > 0) {
    summaryParts.push(`${imageCount} image${imageCount === 1 ? "" : "s"}`);
  }
  if (textCount > 0) {
    summaryParts.push(`${textCount} text attachment${textCount === 1 ? "" : "s"}`);
  }

  return `[Attachments: ${summaryParts.join(", ")}]`;
}

function buildAttachmentHistoryLines(attachments?: PromptAttachment[]): string[] {
  if (!attachments?.length) {
    return [];
  }

  const detailLines = attachments.map((attachment) => {
    const attachmentName = attachment.name?.trim() || "unnamed";
    if (attachment.kind === "image") {
      const summary = attachment.summaryText?.trim();
      if (summary) {
        return `Image attachment (${attachmentName}): ${compressText(summary, ATTACHMENT_HISTORY_TEXT_LIMIT)}`;
      }

      return `Image attachment (${attachmentName}) was provided.`;
    }

    const textBody = (attachment.summaryText ?? attachment.data).trim();
    if (!textBody) {
      return `Text attachment (${attachmentName}) was provided.`;
    }

    return `Text attachment (${attachmentName}): ${compressText(textBody, ATTACHMENT_HISTORY_TEXT_LIMIT)}`;
  });

  return [summarizeAttachments(attachments), ...detailLines].filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeContentBlocks(content: unknown): Array<string | ContentBlock> {
  if (Array.isArray(content)) {
    return content.filter((item): item is string | ContentBlock => typeof item === "string" || isRecord(item));
  }
  if (typeof content === "string" || isRecord(content)) {
    return [content];
  }
  return [];
}

function stringifyStructuredContent(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractSdkMessageText(message: StreamMessage): ConversationEntry | null {
  if (message.type !== "user" && message.type !== "assistant") {
    return null;
  }

  const sdkMessage = "message" in message && isRecord(message.message) ? message.message : null;
  if (!sdkMessage) {
    return null;
  }

  const textParts = normalizeContentBlocks(sdkMessage.content).map((item) => {
    if (typeof item === "string") {
      return item.trim();
    }

    switch (item.type) {
      case "text":
        return typeof item.text === "string" ? item.text.trim() : "";
      case "tool_result":
        return stringifyStructuredContent(item.content);
      case "tool_use": {
        const toolName = typeof item.name === "string" ? item.name.trim() : "tool";
        const toolInput = "input" in item ? stringifyStructuredContent(item.input) : "";
        return toolInput ? `${toolName}: ${toolInput}` : toolName;
      }
      default:
        return "";
    }
  }).filter(Boolean);

  const text = textParts.join("\n");
  return text ? { role: message.type, text } : null;
}

function extractTextFromMessage(message: StreamMessage): ConversationEntry | null {
  if (message.type === "user_prompt") {
    const text = [message.prompt.trim(), ...buildAttachmentHistoryLines(message.attachments)]
      .filter(Boolean)
      .join("\n");
    return text ? { role: "user", text } : null;
  }

  if (message.type === "result" && message.subtype === "success") {
    const text = message.result.trim();
    return text ? { role: "assistant", text } : null;
  }

  const sdkMessageText = extractSdkMessageText(message);
  if (sdkMessageText) {
    return sdkMessageText;
  }

  return null;
}

function dedupeHistory(messages: StreamMessage[]): ConversationEntry[] {
  const condensedHistory = messages
    .map((message) => extractTextFromMessage(message))
    .filter((entry): entry is ConversationEntry => Boolean(entry));

  const dedupedHistory: ConversationEntry[] = [];
  for (const item of condensedHistory) {
    const previous = dedupedHistory[dedupedHistory.length - 1];
    if (previous && previous.role === item.role && previous.text === item.text) {
      continue;
    }
    dedupedHistory.push(item);
  }

  return dedupedHistory;
}

function formatHistory(entries: ConversationEntry[]): string {
  return entries
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`)
    .join("\n\n");
}

function compressText(text: string, maxLength: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) {
    return singleLine;
  }
  return `${singleLine.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function buildSummary(entries: ConversationEntry[], fallbackSummary?: string): string {
  if (entries.length === 0) {
    return fallbackSummary?.trim() ?? "";
  }

  const previewEntries =
    entries.length <= SUMMARY_ENTRY_PREVIEW_LIMIT
      ? entries
      : [
          ...entries.slice(0, 2),
          ...entries.slice(-(SUMMARY_ENTRY_PREVIEW_LIMIT - 2)),
        ];

  const summaryLines = previewEntries.map((entry) => {
    const prefix = entry.role === "user" ? "User asked" : "Assistant replied";
    return `- ${prefix}: ${compressText(entry.text, SUMMARY_TEXT_LIMIT)}`;
  });

  const hiddenCount = entries.length - previewEntries.length;
  if (hiddenCount > 0) {
    summaryLines.splice(
      2,
      0,
      `- ${hiddenCount} earlier message${hiddenCount === 1 ? "" : "s"} were compressed into this summary.`,
    );
  }

  if (fallbackSummary?.trim()) {
    summaryLines.unshift("- Existing summary snapshot reused as the base context.");
  }

  return summaryLines.join("\n");
}

function estimateTextTokens(text: string): number {
  if (!text) {
    return 0;
  }

  let cjkCount = 0;
  let whitespaceCount = 0;
  for (const char of text) {
    if (/\s/.test(char)) {
      whitespaceCount += 1;
      continue;
    }

    if (/[\u3400-\u9FFF\u3040-\u30FF\uAC00-\uD7AF]/.test(char)) {
      cjkCount += 1;
    }
  }

  const otherCount = Math.max(0, text.length - cjkCount - whitespaceCount);
  return Math.ceil((cjkCount * 1.2) + (otherCount / 3) + (whitespaceCount * 0.15));
}

function estimatePromptTokens(parts: Array<string | undefined>): number {
  return parts.reduce((total, part) => total + estimateTextTokens(part ?? ""), 0);
}

function estimateAttachmentTokens(attachments: PromptAttachment[] = []): number {
  return attachments.reduce((total, attachment) => {
    if (attachment.kind === "image") {
      return total + Math.max(
        DEFAULT_IMAGE_ATTACHMENT_TOKEN_ESTIMATE,
        Math.ceil((attachment.size ?? attachment.data.length) / 64),
      );
    }

    const normalizedText = attachment.data.trim();
    if (!normalizedText) {
      return total;
    }

    return total + estimateTextTokens(
      `Attachment file: ${attachment.name || "unnamed"}\n\`\`\`\n${normalizedText}\n\`\`\``,
    );
  }, 0);
}

function resolveCompressionBudget(options: StatelessContinuationOptions): {
  contextWindow: number;
  compressionThresholdPercent: number;
} {
  return {
    contextWindow: options.contextWindow ?? DEFAULT_CONTEXT_WINDOW,
    compressionThresholdPercent:
      options.compressionThresholdPercent ?? DEFAULT_COMPRESSION_THRESHOLD_PERCENT,
  };
}

function buildContinuationPrompt(options: {
  summaryText?: string;
  recentHistoryText?: string;
  latestMessageText: string;
  latestAttachmentSummary: string;
}): string {
  const sections = [
    "Recent conversation history is provided below. Continue the same conversation based on it.",
  ];

  if (options.summaryText?.trim()) {
    sections.push("", "Earlier conversation summary:", options.summaryText.trim());
  }

  if (options.recentHistoryText?.trim()) {
    sections.push("", "Recent conversation history:", options.recentHistoryText.trim());
  }

  if (options.latestAttachmentSummary) {
    sections.push(
      "",
      `The latest message includes attachments: ${options.latestAttachmentSummary.replace(/^\[Attachments:\s*|\]$/g, "")}.`,
      "If image attachments are present in the current turn, analyze them directly and do not repeat earlier claims that an image was missing.",
    );
  }

  sections.push(
    "",
    `Latest user message: ${options.latestMessageText}`,
    "",
    "Respond naturally as if the conversation had continued normally. Do not mention that history was stitched together.",
  );

  return sections.join("\n");
}

function shouldCompressHistory(
  estimatedTokens: number,
  options: StatelessContinuationOptions,
): boolean {
  const { contextWindow, compressionThresholdPercent } = resolveCompressionBudget(options);
  const thresholdTokens = Math.floor(contextWindow * (compressionThresholdPercent / 100));
  return thresholdTokens > 0 && estimatedTokens >= thresholdTokens;
}

export function shouldCompressStatelessContinuation(
  messages: StreamMessage[],
  latestPrompt: string,
  latestAttachments: PromptAttachment[] = [],
  options: StatelessContinuationOptions = {},
): boolean {
  const dedupedHistory = dedupeHistory(messages);
  const fullHistoryText = formatHistory(dedupedHistory);
  const latestAttachmentSummary = summarizeAttachments(latestAttachments);
  const latestAttachmentTokens = estimateAttachmentTokens(latestAttachments);
  const latestMessageText = latestPrompt.trim() || "[attachments only]";
  const fullEstimatedTokens =
    estimatePromptTokens([fullHistoryText, latestMessageText, latestAttachmentSummary]) + latestAttachmentTokens;

  return Boolean(options.forceCompression) || shouldCompressHistory(fullEstimatedTokens, options);
}

export function buildStatelessContinuationPayload(
  messages: StreamMessage[],
  latestPrompt: string,
  latestAttachments: PromptAttachment[] = [],
  options: StatelessContinuationOptions = {},
): StatelessContinuationPayload {
  const dedupedHistory = dedupeHistory(messages);
  const recentTurnCount = options.recentTurnCount ?? DEFAULT_RECENT_TURN_COUNT;
  const recentEntryCount = Math.max(2, recentTurnCount * 2);
  const latestAttachmentSummary = summarizeAttachments(latestAttachments);
  const latestAttachmentTokens = estimateAttachmentTokens(latestAttachments);
  const latestMessageText = latestPrompt.trim() || "[attachments only]";
  const fullHistoryText = formatHistory(dedupedHistory);
  const fullEstimatedTokens =
    estimatePromptTokens([fullHistoryText, latestMessageText, latestAttachmentSummary]) + latestAttachmentTokens;
  const historyMessageCount = Math.max(messages.length, options.historyMessageCount ?? messages.length);

  if (!options.forceCompression && !shouldCompressHistory(fullEstimatedTokens, options)) {
    return {
      prompt: buildContinuationPrompt({
        recentHistoryText: fullHistoryText,
        latestMessageText,
        latestAttachmentSummary,
      }),
      usedCompression: false,
      summaryMessageCount: 0,
      estimatedTokens: fullEstimatedTokens,
    };
  }

  const maxRawEntries = Math.min(recentEntryCount, dedupedHistory.length);
  for (let rawEntryCount = maxRawEntries; rawEntryCount >= 0; rawEntryCount -= 2) {
    const summaryEntries = rawEntryCount > 0
      ? dedupedHistory.slice(0, -rawEntryCount)
      : dedupedHistory;
    const recentHistory = rawEntryCount > 0
      ? dedupedHistory.slice(-rawEntryCount)
      : [];
    const canReuseExistingSummary =
      rawEntryCount === maxRawEntries &&
      options.existingSummary?.trim() &&
      options.existingSummaryMessageCount === historyMessageCount;
    const summaryText = canReuseExistingSummary
      ? options.existingSummary!.trim()
      : buildSummary(summaryEntries, options.existingSummary);
    const recentHistoryText = formatHistory(recentHistory);
    const estimatedTokens = estimatePromptTokens([
      summaryText,
      recentHistoryText,
      latestMessageText,
      latestAttachmentSummary,
    ]) + latestAttachmentTokens;

    if (rawEntryCount > 0 && shouldCompressHistory(estimatedTokens, options)) {
      continue;
    }

    return {
      prompt: buildContinuationPrompt({
        summaryText,
        recentHistoryText,
        latestMessageText,
        latestAttachmentSummary,
      }),
      usedCompression: true,
      summaryText,
      summaryMessageCount: historyMessageCount,
      estimatedTokens,
    };
  }

  const fallbackSummary = buildSummary(dedupedHistory, options.existingSummary);
  const fallbackPrompt = buildContinuationPrompt({
    summaryText: fallbackSummary,
    latestMessageText,
    latestAttachmentSummary,
  });

  return {
    prompt: fallbackPrompt,
    usedCompression: true,
    summaryText: fallbackSummary,
    summaryMessageCount: historyMessageCount,
    estimatedTokens:
      estimatePromptTokens([fallbackSummary, latestMessageText, latestAttachmentSummary]) + latestAttachmentTokens,
  };
}

export function buildStatelessContinuationPrompt(
  messages: StreamMessage[],
  latestPrompt: string,
  latestAttachments: PromptAttachment[] = [],
  options: StatelessContinuationOptions = {},
): string {
  return buildStatelessContinuationPayload(messages, latestPrompt, latestAttachments, options).prompt;
}
