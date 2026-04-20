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
  estimatedCharacters: number;
};

const DEFAULT_RECENT_TURN_COUNT = 5;
const DEFAULT_RECENT_ENTRY_LIMIT = 12;
const SUMMARY_ENTRY_PREVIEW_LIMIT = 6;
const SUMMARY_TEXT_LIMIT = 160;

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

function extractTextFromMessage(message: StreamMessage): ConversationEntry | null {
  if (message.type === "user_prompt") {
    const text = [message.prompt.trim(), summarizeAttachments(message.attachments)]
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

function estimateCharacters(
  historyText: string,
  latestPrompt: string,
  latestAttachmentSummary: string,
  summaryText?: string,
): number {
  return historyText.length + latestPrompt.length + latestAttachmentSummary.length + (summaryText?.length ?? 0);
}

function shouldCompressHistory(
  estimatedCharacters: number,
  options: StatelessContinuationOptions,
): boolean {
  if (!options.contextWindow || !options.compressionThresholdPercent) {
    return false;
  }

  const thresholdChars = Math.floor(options.contextWindow * (options.compressionThresholdPercent / 100));
  return thresholdChars > 0 && estimatedCharacters >= thresholdChars;
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
  const rawRecentHistory = dedupedHistory.slice(-DEFAULT_RECENT_ENTRY_LIMIT);
  const rawHistoryText = formatHistory(rawRecentHistory);
  const latestAttachmentSummary = summarizeAttachments(latestAttachments);
  const latestMessageText = latestPrompt.trim() || "[attachments only]";
  const rawEstimatedCharacters = estimateCharacters(rawHistoryText, latestMessageText, latestAttachmentSummary);

  const sections = [
    "Recent conversation history is provided below. Continue the same conversation based on it.",
  ];

  if (
    shouldCompressHistory(rawEstimatedCharacters, options) &&
    dedupedHistory.length > recentEntryCount
  ) {
    const summaryEntries = dedupedHistory.slice(0, -recentEntryCount);
    const recentHistory = dedupedHistory.slice(-recentEntryCount);
    const canReuseExistingSummary =
      options.existingSummary?.trim() &&
      options.existingSummaryMessageCount === messages.length;
    const summaryText = canReuseExistingSummary
      ? options.existingSummary!.trim()
      : buildSummary(summaryEntries, options.existingSummary);
    const recentHistoryText = formatHistory(recentHistory);

    sections.push("", "Earlier conversation summary:", summaryText);
    if (recentHistoryText) {
      sections.push("", "Recent conversation history:", recentHistoryText);
    }

    if (latestAttachmentSummary) {
      sections.push(
        "",
        `The latest message includes attachments: ${latestAttachmentSummary.replace(/^\[Attachments:\s*|\]$/g, "")}.`,
        "If image attachments are present in the current turn, analyze them directly and do not repeat earlier claims that an image was missing.",
      );
    }

    sections.push(
      "",
      `Latest user message: ${latestMessageText}`,
      "",
      "Respond naturally as if the conversation had continued normally. Do not mention that history was stitched together.",
    );

    return {
      prompt: sections.join("\n"),
      usedCompression: true,
      summaryText,
      summaryMessageCount: messages.length,
      estimatedCharacters: estimateCharacters(recentHistoryText, latestMessageText, latestAttachmentSummary, summaryText),
    };
  }

  if (rawHistoryText) {
    sections.push("", rawHistoryText);
  }

  if (latestAttachmentSummary) {
    sections.push(
      "",
      `The latest message includes attachments: ${latestAttachmentSummary.replace(/^\[Attachments:\s*|\]$/g, "")}.`,
      "If image attachments are present in the current turn, analyze them directly and do not repeat earlier claims that an image was missing.",
    );
  }

  sections.push(
    "",
    `Latest user message: ${latestMessageText}`,
    "",
    "Respond naturally as if the conversation had continued normally. Do not mention that history was stitched together.",
  );

  return {
    prompt: sections.join("\n"),
    usedCompression: false,
    summaryMessageCount: 0,
    estimatedCharacters: rawEstimatedCharacters,
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
