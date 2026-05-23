import type { Options } from "@anthropic-ai/claude-agent-sdk";

export type ClaudeCodeSystemPromptOption = NonNullable<Options["systemPrompt"]>;

export function buildClaudeCodeSystemPromptOption(
  systemPromptAppend?: string,
): ClaudeCodeSystemPromptOption {
  const append = systemPromptAppend?.trim();
  return append
    ? {
        type: "preset",
        preset: "claude_code",
        append,
        excludeDynamicSections: true,
      }
    : {
        type: "preset",
        preset: "claude_code",
        excludeDynamicSections: true,
      };
}
