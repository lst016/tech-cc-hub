import { buildAnthropicPromptContentBlocks, type AttachmentLike } from "./attachments.js";

export function buildRunnerPromptContentBlocks(prompt: string, attachments: AttachmentLike[]): Array<Record<string, unknown>> {
  return buildAnthropicPromptContentBlocks(prompt, attachments);
}
