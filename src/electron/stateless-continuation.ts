import type { PromptAttachment, StreamMessage } from "./types.js";

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

function extractTextFromMessage(message: StreamMessage): { role: "user" | "assistant"; text: string } | null {
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

export function buildStatelessContinuationPrompt(
  messages: StreamMessage[],
  latestPrompt: string,
  latestAttachments: PromptAttachment[] = [],
): string {
  const condensedHistory = messages
    .map((message) => extractTextFromMessage(message))
    .filter((entry): entry is { role: "user" | "assistant"; text: string } => Boolean(entry));

  const dedupedHistory: Array<{ role: "user" | "assistant"; text: string }> = [];
  for (const item of condensedHistory) {
    const previous = dedupedHistory[dedupedHistory.length - 1];
    if (previous && previous.role === item.role && previous.text === item.text) {
      continue;
    }
    dedupedHistory.push(item);
  }

  const recentHistory = dedupedHistory.slice(-12);
  const historyText = recentHistory
    .map((item) => `${item.role === "user" ? "User" : "Assistant"}: ${item.text}`)
    .join("\n\n");
  const latestAttachmentSummary = summarizeAttachments(latestAttachments);
  const latestMessageText = latestPrompt.trim() || "[attachments only]";

  const sections = [
    "Recent conversation history is provided below. Continue the same conversation based on it.",
  ];

  if (historyText) {
    sections.push("", historyText);
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

  return sections.join("\n");
}
