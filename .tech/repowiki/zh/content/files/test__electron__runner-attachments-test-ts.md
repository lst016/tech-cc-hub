# test/electron/runner-attachments.test.ts

> 模块：`electron-runtime` · 语言：`typescript` · 行数：87

## 文件职责

测试runner提示词和附件处理逻辑

## 关键符号

- `attachmentPriorityContext@0 - 测试用的附件优先级上下文文本`
- `promptAfterAttachments@0 - 测试辅助函数，用于生成带附件的提示词文本`
- `contentBlocks@0 - 测试验证构建的内容块格式正确性`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/runner-prompt.js`
- `../../src/shared/attachments.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { buildRunnerPromptContentBlocks } from "../../src/shared/runner-prompt.js";
import { buildAnthropicPromptContentBlocks } from "../../src/shared/attachments.js";

const attachmentPriorityContext = [
  "Current user turn includes attachments. Treat these attachments as the highest-priority source for this turn.",
  "Read and use the current-turn attachments before reading workspace files, Downloads, or same-name local files.",
  "If an attachment is Postman/OpenAPI/JSON/API documentation, extract endpoints, methods, parameters, and response fields from the attachment before editing code.",
  "If an attachment is an image, analyze the image payload or image summary before deciding what the user means; do not claim the attachment is missing.",
  "",
  "Attachment list:",
  "1. image.png (image, image/png)",
].join("\n");

const promptAfterAttachments = (prompt: string) => `User request after reading the attachments first:\n${prompt}`;

test("buildAnthropicPromptContentBlocks only emits image blocks from explicit runtimeData", () => {
  const contentBlocks = buildAnthropicPromptContentBlocks("describe this image", [
    {
      kind: "image",
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
      runtimeData: "data:image/png;base64,BBBB",
    },
  ]);

  assert.deepEqual(contentBlocks, [
    {
      type: "text",
      text: attachmentPriorityContext,
    },
    {
      type: "image",
      source: {
        type: "base64",
        media_type: "image/png",
        data: "BBBB",
      },
    },
    {
      type: "text",
      text: promptAfterAttachments("describe this image"),
    },
  ]);
});

test("buildAnthropicPromptContentBlocks does not leak preview base64 into the main agent", () => {
  const contentBlocks = buildAnthropicPromptContentBlocks("use this screenshot", [
    {
      kind: "image",
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
      summaryText: "图片资产：/tmp/image.png",
    },
  ]);

  assert.deepEqual(contentBlocks, [
    {
      type: "text",
      text: attachmentPriorityContext,
    },
    {
      type: "text",
      text: "Image attachment summary (image.png):\n图片资产：/tmp/image.png",
    },
    {
      type: "text",
      text: promptAfterAttachments("use this screenshot"),
    },
  ]);
});

test("buildRunnerPromptContentBlocks always returns array content blocks", () => {
  assert.deepEqual(buildRunnerPromptContentBlocks("plain prompt", []), [
    {
      type: "text",
      text: promptAfterAttachments("plain prompt"),
    },
  ]);
});

```
