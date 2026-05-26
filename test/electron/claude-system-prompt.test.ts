import test from "node:test";
import assert from "node:assert/strict";

import { buildClaudeCodeSystemPromptOption } from "../../src/electron/libs/claude/claude-system-prompt.js";

test("Claude Code system prompt excludes dynamic preset sections for cacheability", () => {
  assert.deepEqual(buildClaudeCodeSystemPromptOption("  Extra rule  "), {
    type: "preset",
    preset: "claude_code",
    append: "Extra rule",
    excludeDynamicSections: true,
  });
});

test("Claude Code system prompt still opts into cacheable preset without append", () => {
  assert.deepEqual(buildClaudeCodeSystemPromptOption(), {
    type: "preset",
    preset: "claude_code",
    excludeDynamicSections: true,
  });
});
