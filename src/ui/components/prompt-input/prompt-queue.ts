import type { PromptAttachment } from "../../types.js";
import {
  getImageGenerationDisplayPrompt,
  restoreImageGenerationPluginFromPrompt,
} from "./image-generation-plugin.js";

const PROMPT_QUEUE_STORAGE_KEY = "tech-cc-hub:prompt-queue";

export type QueuedMessageDraft = {
  id: string;
  /** User-visible text without structured runtime instructions. */
  prompt: string;
  /** Optional enriched prompt sent only to the runner. */
  agentPrompt?: string;
  attachments: PromptAttachment[];
  createdAt: number;
};

export function readQueuedMessagesFromStorage(): Record<string, QueuedMessageDraft[]> {
  try {
    const stored = localStorage.getItem(PROMPT_QUEUE_STORAGE_KEY);
    if (!stored) return {};
    const parsed = JSON.parse(stored) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, QueuedMessageDraft[]>).map(([sessionId, queue]) => [
        sessionId,
        Array.isArray(queue) ? queue.map((item) => {
          if (item.agentPrompt) return item;
          const restored = restoreImageGenerationPluginFromPrompt(item.prompt);
          if (!restored) return item;
          return {
            ...item,
            prompt: getImageGenerationDisplayPrompt(restored.prompt),
            agentPrompt: item.prompt,
          };
        }) : [],
      ]),
    );
  } catch {
    return {};
  }
}

export function writeQueuedMessagesToStorage(queueBySession: Record<string, QueuedMessageDraft[]>) {
  try {
    const allEmpty = Object.keys(queueBySession).every(
      (sessionId) => (queueBySession[sessionId] ?? []).length === 0,
    );
    if (allEmpty) {
      localStorage.removeItem(PROMPT_QUEUE_STORAGE_KEY);
      return;
    }
    localStorage.setItem(PROMPT_QUEUE_STORAGE_KEY, JSON.stringify(queueBySession));
  } catch (error) {
    console.warn("Failed to persist prompt queue:", error);
  }
}

export function buildQueuedPrompt(queue: QueuedMessageDraft[]) {
  if (queue.length === 1) return queue[0].agentPrompt ?? queue[0].prompt;
  return queue
    .map((item, index) => {
      const content = (item.agentPrompt ?? item.prompt).trim() || "(no text, attachments only)";
      return `Queued message ${index + 1}:\n${content}`;
    })
    .join("\n\n---\n\n");
}

export function buildQueuedDisplayPrompt(queue: QueuedMessageDraft[]) {
  if (queue.length === 1) return queue[0].prompt;
  return queue
    .map((item, index) => {
      const content = item.prompt.trim() || "(no text, attachments only)";
      return `Queued message ${index + 1}:\n${content}`;
    })
    .join("\n\n---\n\n");
}

export function countStructuredContextBlocks(prompt: string) {
  const matches = prompt.match(/<(?:browser_annotations|code_references|message_references|file_references)>/g);
  return matches?.length ?? 0;
}

export function getQueuedPromptPreview(prompt: string, contextCount: number) {
  const visiblePrompt = prompt
    .replace(/<(browser_annotations|code_references|message_references|file_references)>[\s\S]*?<\/\1>/g, "")
    .trim();
  if (visiblePrompt) return visiblePrompt;
  if (contextCount > 0) return `${contextCount} 个结构化上下文`;
  return prompt.trim();
}

export function mergeQueuedAttachments(queue: QueuedMessageDraft[]) {
  return queue.flatMap((item) => item.attachments);
}

export function buildDraftTitle(prompt: string, attachments: PromptAttachment[]): string {
  const trimmed = prompt.trim();
  if (trimmed) return trimmed;
  if (attachments.length === 1) return `附件：${attachments[0].name}`;
  return `${attachments.length} 个附件`;
}
