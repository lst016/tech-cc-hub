# test/electron/system-prompt-presets.test.ts

> 模块：`test` · 语言：`typescript` · 行数：70

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `prompt@12`
- `prompt@39`
- `hint@48`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/system-prompt-presets.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
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

```
