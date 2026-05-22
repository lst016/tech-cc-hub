import test from "node:test";
import assert from "node:assert/strict";

import {
  buildBrowserWorkbenchPromptAppend,
  buildClaudeCode2139FeaturePromptAppend,
  buildDesignParityPromptAppend,
  buildFeishuDocumentFetchPromptAppend,
  buildGlobalRuntimeSystemPromptExtAppend,
  buildToolCallOptimizationPromptAppend,
  extractFeishuDocumentUrls,
} from "../../src/electron/libs/system-prompt-presets.js";

test("browser prompt encourages fetch log capture for API evidence", () => {
  const prompt = buildBrowserWorkbenchPromptAppend();

  assert.match(prompt, /fetch\/XHR capture/);
  assert.match(prompt, /browser_get_state/);
  assert.match(prompt, /Current BrowserView first/);
  assert.match(prompt, /Do not run npm run dev or open a new local page/);
  assert.match(prompt, /browser_fetch_logs/);
  assert.match(prompt, /API request\/response evidence/);
});

test("tool optimization prompt keeps tool calls sparse, batched, and bounded", () => {
  const prompt = buildToolCallOptimizationPromptAppend();

  assert.match(prompt, /use tools only when/i);
  assert.match(prompt, /2\+ read-only searches/);
  assert.match(prompt, /parallel\/batched/);
  assert.match(prompt, /one bounded rg\/find\/Grep\/Glob search/);
  assert.match(prompt, /under 200 lines/);
  assert.match(prompt, /Stop exploring once the collected evidence is sufficient/);
  assert.match(prompt, /taskkill \/\/PID 1234 \/\/F/);
});

test("Claude Code compatibility prompt includes Agent Teams guidance", () => {
  const prompt = buildClaudeCode2139FeaturePromptAppend();

  assert.match(prompt, /CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1/);
  assert.match(prompt, /TeamCreate/);
  assert.match(prompt, /SendMessage/);
  assert.match(prompt, /TeamDelete/);
});

test("design parity prompt requires a 90 percent visual acceptance loop", () => {
  const prompt = buildDesignParityPromptAppend();

  assert.match(prompt, /Figma 90% acceptance rule/);
  assert.match(prompt, /maxDifferenceRatio <= 0\.10/);
  assert.match(prompt, /design_compare_element_to_reference/);
});

test("design parity prompt requires a locked Figma reference before file edits", () => {
  const prompt = buildDesignParityPromptAppend();

  assert.match(prompt, /Figma reference-lock rule/);
  assert.match(prompt, /qualityGate\.confidence >= 0\.75/);
  assert.match(prompt, /Figma wrong-reference recovery rule/);
  assert.match(prompt, /figma_match_ui_nodes/);
});

test("design parity prompt decomposes large Figma files into child component loops", () => {
  const prompt = buildDesignParityPromptAppend();

  assert.match(prompt, /Figma component workflow rule/);
  assert.match(prompt, /Figma genericity rule/);
  assert.match(prompt, /never implement the whole screen in one patch/);
  assert.match(prompt, /Keep exactly one component in_progress/);
  assert.match(prompt, /reference tuple/);
  assert.match(prompt, /visual constraints/);
  assert.match(prompt, /browser_inspect_styles/);
  assert.doesNotMatch(prompt, /design_lint_visual_parity/);
  assert.match(prompt, /visual\/function split rule/);
  assert.match(prompt, /maxDifferenceRatio <= 0\.10/);
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

test("feishu document prompt hint routes directly to lark-cli docs fetch", () => {
  const prompt = [
    "读下这个文档：https://boke.feishu.cn/wiki/V1IgwHb6ki1sETkjO4bcOqP3nFb",
    "还有 https://boke.feishu.cn/docx/DocToken123。",
  ].join("\n");

  assert.deepEqual(extractFeishuDocumentUrls(prompt), [
    "https://boke.feishu.cn/wiki/V1IgwHb6ki1sETkjO4bcOqP3nFb",
    "https://boke.feishu.cn/docx/DocToken123",
  ]);

  const hint = buildFeishuDocumentFetchPromptAppend(prompt, {
    LARK_CLI_COMMAND: "lark-cli",
    LARK_CLI_PROFILE: "default",
  });

  assert.ok(hint);
  assert.match(hint, /docs \+fetch --doc "https:\/\/boke\.feishu\.cn\/wiki\/V1IgwHb6ki1sETkjO4bcOqP3nFb" --format pretty/);
  assert.match(hint, /docs \+fetch --doc "https:\/\/boke\.feishu\.cn\/docx\/DocToken123" --format pretty/);
  assert.match(hint, /不要先试 `wiki get`/);
});

test("feishu document prompt hint requires injected lark cli env", () => {
  assert.equal(
    buildFeishuDocumentFetchPromptAppend("https://boke.feishu.cn/wiki/V1IgwHb6ki1sETkjO4bcOqP3nFb", {}),
    undefined,
  );
  assert.deepEqual(
    extractFeishuDocumentUrls("普通链接 https://example.com/docs/abc"),
    [],
  );
});
