# test/electron/tool-output-sanitizer.test.ts

> 模块：`test` · 语言：`typescript` · 行数：82

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `image@18`
- `sanitized@40`
- `toolResult@61`
- `output@72`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/tool-output-sanitizer.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOversizedTextToolOutputReplacement,
  createTextToolOutputBlocks,
  extractInlineBase64ImageFromToolResponse,
  stripInlineBase64ImagesFromMessage,
} from "../../src/electron/libs/tool-output-sanitizer.js";

test("createTextToolOutputBlocks returns raw content blocks for updatedToolOutput", () => {
  assert.deepEqual(createTextToolOutputBlocks("summary"), [
    { type: "text", text: "summary" },
  ]);
});

test("extractInlineBase64ImageFromToolResponse captures screenshot image blocks", () => {
  const image = extractInlineBase64ImageFromToolResponse({
    content: [
      { type: "text", text: "Took a screenshot of the current page's viewport." },
      {
        type: "image",
        source: {
          type: "base64",
          media_type: "image/png",
          data: " AAAA \n BBBB ",
        },
      },
    ],
  });

  assert.deepEqual(image, {
    mimeType: "image/png",
    base64Data: "AAAABBBB",
    textContext: "Took a screenshot of the current page's viewport.",
  });
});

test("stripInlineBase64ImagesFromMessage replaces tool-result images with text", () => {
  const sanitized = stripInlineBase64ImagesFromMessage({
    type: "user",
    message: {
      role: "user",
      content: [{
        tool_use_id: "call_123",
        type: "tool_result",
        content: [
          { type: "text", text: "Took a screenshot of the current page's viewport." },
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: "iVBORw0KGgoAAA",
            },
          },
        ],
      }],
    },
  } as unknown as Parameters<typeof stripInlineBase64ImagesFromMessage>[0]);

  const toolResult = (sanitized as unknown as {
    message: { content: Array<{ type: string; content: string }> };
  }).message.content[0];
  assert.equal(toolResult.type, "tool_result");
  assert.equal(typeof toolResult.content, "string");
  assert.match(toolResult.content, /replaced with text/i);
  assert.doesNotMatch(toolResult.content, /iVBORw0KGgoAAA/);
});

test("buildOversizedTextToolOutputReplacement truncates large text tool output", () => {
  const output = buildOversizedTextToolOutputReplacement("Read", {
    content: [{ type: "text", text: "A".repeat(30_000) }],
  });

  assert.ok(output);
  assert.equal(output.originalChars, 30_000);
  assert.match(output.replacementText, /returned 30000 characters/);
  assert.match(output.replacementText, /characters omitted/);
  assert.ok(output.replacementText.length < 18_000);
});

```
