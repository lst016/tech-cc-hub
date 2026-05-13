import test from "node:test";
import assert from "node:assert/strict";

import {
  buildFeishuDocumentFetchPromptAppend,
  buildGlobalRuntimeSystemPromptExtAppend,
  buildToolCallOptimizationPromptAppend,
  extractFeishuDocumentUrls,
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
