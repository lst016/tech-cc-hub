import type { PromptAttachment, StreamMessage } from "./types.js";

type ConversationEntry = { role: "user" | "assistant"; text: string };

export type StatelessContinuationOptions = {
  contextWindow?: number;
  compressionThresholdPercent?: number;
  recentTurnCount?: number;
  existingSummary?: string;
  existingSummaryMessageCount?: number;
};

export type StatelessContinuationPayload = {
  prompt: string;
  usedCompression: boolean;
  summaryText?: string;
  summaryMessageCount: number;
  estimatedTokens: number;
};

const DEFAULT_RECENT_TURN_COUNT = 5;
const DEFAULT_RECENT_ENTRY_LIMIT = 12;
const SUMMARY_ENTRY_PREVIEW_LIMIT = 6;
const SUMMARY_TEXT_LIMIT = 160;
const DEFAULT_CONTEXT_WINDOW = 200_000;
const DEFAULT_COMPRESSION_THRESHOLD_PERCENT = 70;
const DEFAULT_IMAGE_ATTACHMENT_TOKEN_ESTIMATE = 6_000;
const ATTACHMENT_HISTORY_TEXT_LIMIT = 280;
const STORED_HISTORY_PRESSURE_MESSAGE_CHAR_LIMIT = 1_000_000;
const STORED_HISTORY_PRESSURE_TOTAL_CHAR_LIMIT = 1_600_000;

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

function estimateStoredHistoryPressureTokens(messages: StreamMessage[]): number {
  let totalTokens = 0;
  let totalChars = 0;

  for (const message of messages) {
    if (totalChars >= STORED_HISTORY_PRESSURE_TOTAL_CHAR_LIMIT) {
      break;
    }

    let serialized = "";
    try {
      serialized = JSON.stringify(message);
    } catch {
      serialized = String(message);
    }

    const remainingChars = STORED_HISTORY_PRESSURE_TOTAL_CHAR_LIMIT - totalChars;
    const pressureText = serialized.slice(
      0,
      Math.min(STORED_HISTORY_PRESSURE_MESSAGE_CHAR_LIMIT, remainingChars),
    );
    totalChars += pressureText.length;
    totalTokens += estimateTextTokens(pressureText);
  }

  return totalTokens;
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

function appendSummaryNote(summaryText: string, note: string): string {
  const trimmedSummary = summaryText.trim();
  const trimmedNote = note.trim();
  if (!trimmedNote) {
    return trimmedSummary;
  }
  return [trimmedNote, trimmedSummary].filter(Boolean).join("\n");
}

function buildStoredPressureSummary(estimatedTokens: number): string {
  return [
    "- Large stored tool/runtime history was compressed before this turn.",
    `- Stored history pressure estimate before compression: ${Math.round(estimatedTokens)} tokens.`,
  ].join("\n");
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
  const rawRecentHistory = dedupedHistory.slice(-Math.max(DEFAULT_RECENT_ENTRY_LIMIT, recentEntryCount));
  const rawHistoryText = formatHistory(rawRecentHistory);
  const rawEstimatedTokens =
    estimatePromptTokens([rawHistoryText, latestMessageText, latestAttachmentSummary]) + latestAttachmentTokens;
  const storedHistoryPressureTokens = estimateStoredHistoryPressureTokens(messages);
  const shouldCompressForRawHistory = shouldCompressHistory(rawEstimatedTokens, options);
  const shouldCompressForStoredPressure = shouldCompressHistory(storedHistoryPressureTokens, options);
  const storedPressureSummary = shouldCompressForStoredPressure
    ? buildStoredPressureSummary(storedHistoryPressureTokens)
    : "";

  if (!shouldCompressForRawHistory && !shouldCompressForStoredPressure) {
    return {
      prompt: buildContinuationPrompt({
        recentHistoryText: rawHistoryText,
        latestMessageText,
        latestAttachmentSummary,
      }),
      usedCompression: false,
      summaryMessageCount: 0,
      estimatedTokens: rawEstimatedTokens,
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
      !shouldCompressForStoredPressure &&
      rawEntryCount === maxRawEntries &&
      options.existingSummary?.trim() &&
      options.existingSummaryMessageCount === messages.length;
    const baseSummaryText = canReuseExistingSummary
      ? options.existingSummary!.trim()
      : buildSummary(summaryEntries, options.existingSummary);
    const summaryText = appendSummaryNote(baseSummaryText, storedPressureSummary);
    const recentHistoryText = formatHistory(recentHistory);
    const estimatedTokens = estimatePromptTokens([
      summaryText,
      recentHistoryText,
      latestMessageText,
      latestAttachmentSummary,
    ]) + latestAttachmentTokens;

    if (rawEntryCount > 0 && shouldCompressForRawHistory && shouldCompressHistory(estimatedTokens, options)) {
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
      summaryMessageCount: messages.length,
      estimatedTokens,
    };
  }

  const fallbackSummary = appendSummaryNote(
    buildSummary(dedupedHistory, options.existingSummary),
    storedPressureSummary,
  );
  const fallbackPrompt = buildContinuationPrompt({
    summaryText: fallbackSummary,
    latestMessageText,
    latestAttachmentSummary,
  });

  return {
    prompt: fallbackPrompt,
    usedCompression: true,
    summaryText: fallbackSummary,
    summaryMessageCount: messages.length,
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
