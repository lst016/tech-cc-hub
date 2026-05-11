import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGlobalRuntimeSystemPromptExtAppend,
  buildToolCallOptimizationPromptAppend,
} from "../../src/electron/libs/system-prompt-presets.js";

test("tool optimization prompt keeps tool calls sparse, batched, and bounded", () => {
  const prompt = buildToolCallOptimizationPromptAppend();

  assert.match(prompt, /use tools only when/i);
  assert.match(prompt, /2\+ read-only searches/);
  assert.match(prompt, /parallel\/batched/);
  assert.match(prompt, /one bounded rg\/find\/Grep\/Glob search/);
  assert.match(prompt, /under 200 lines/);
  assert.match(prompt, /Stop exploring once the collected evidence is sufficient/);
});

test("global runtime systemPromptExt is appended when configured", () => {
  assert.equal(
    buildGlobalRuntimeSystemPromptExtAppend({
      systemPromptExt: ["  First rule  ", "", 42, "Second rule"],
    }),
    "全局 System Prompt 扩展：\nFirst rule\nSecond rule",
  );

  assert.equal(
    buildGlobalRuntimeSystemPromptExtAppend({ systemPromptExt: "  Single rule  " }),
    "全局 System Prompt 扩展：\nSingle rule",
  );

  assert.equal(buildGlobalRuntimeSystemPromptExtAppend({}), undefined);
});
