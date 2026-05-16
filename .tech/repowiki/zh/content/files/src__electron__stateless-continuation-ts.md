# src/electron/stateless-continuation.ts

> 模块：`electron` · 语言：`typescript` · 行数：355

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `summarizeAttachments@29`
- `buildAttachmentHistoryLines@48`
- `extractTextFromMessage@75`
- `dedupeHistory@91`
- `formatHistory@108`
- `compressText@114`
- `buildSummary@122`
- `estimateTextTokens@156`
- `estimatePromptTokens@178`
- `estimateAttachmentTokens@182`
- `resolveCompressionBudget@202`
- `buildContinuationPrompt@213`
- `shouldCompressHistory@249`
- `buildStatelessContinuationPayload@258`
- `buildStatelessContinuationPrompt@346`
- `DEFAULT_RECENT_TURN_COUNT@20`
- `DEFAULT_RECENT_ENTRY_LIMIT@22`
- `SUMMARY_ENTRY_PREVIEW_LIMIT@23`
- `SUMMARY_TEXT_LIMIT@24`
- `DEFAULT_CONTEXT_WINDOW@25`
- `DEFAULT_COMPRESSION_THRESHOLD_PERCENT@26`
- `DEFAULT_IMAGE_ATTACHMENT_TOKEN_ESTIMATE@27`
- `ATTACHMENT_HISTORY_TEXT_LIMIT@28`
- `imageCount@34`
- `textCount@36`
- `summaryParts@37`
- `detailLines@53`
- `attachmentName@55`
- `summary@57`
- `textBody@64`
- `text@78`
- `text@85`
- `condensedHistory@93`
- `previous@99`
- `singleLine@116`
- `previewEntries@127`
- `summaryLines@135`
- `prefix@137`
- `hiddenCount@140`
- `cjkCount@161`

## 依赖输入

- `./types.js`

## 对外暴露

- `StatelessContinuationOptions`
- `StatelessContinuationPayload`
- `buildStatelessContinuationPayload`
- `buildStatelessContinuationPrompt`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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
    entries.len
... (truncated)
```
