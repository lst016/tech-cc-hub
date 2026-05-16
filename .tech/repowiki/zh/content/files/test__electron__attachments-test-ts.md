# test/electron/attachments.test.ts

> 模块：`test` · 语言：`typescript` · 行数：63

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `attachments@11`
- `src@30`
- `src@40`
- `chars@50`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/shared/attachments.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import {
  createStoredUserPromptMessage,
  estimateAttachmentPromptChars,
  resolveImageAttachmentSrc,
} from "../../src/shared/attachments.js";

test("createStoredUserPromptMessage preserves attachments for history replay", () => {
  const attachments = [
    {
      id: "image-1",
      kind: "image" as const,
      name: "image.png",
      mimeType: "image/png",
      data: "data:image/png;base64,AAAA",
      preview: "data:image/png;base64,AAAA",
    },
  ];

  assert.deepEqual(createStoredUserPromptMessage("look at this", attachments), {
    type: "user_prompt",
    prompt: "look at this",
    attachments,
  });
});

test("resolveImageAttachmentSrc keeps an existing data URL intact", () => {
  const src = resolveImageAttachmentSrc({
    data: "data:image/png;base64,AAAA",
    preview: "data:image/png;base64,BBBB",
    mimeType: "image/png",
  });

  assert.equal(src, "data:image/png;base64,BBBB");
});

test("resolveImageAttachmentSrc converts raw base64 into a displayable data URL", () => {
  const src = resolveImageAttachmentSrc({
    data: "iVBORw0KGgoAAAANSUhEUgAAAAUA",
    mimeType: "image/png",
    preview: undefined,
  });

  assert.equal(src, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA");
});

test("estimateAttachmentPromptChars counts stored image summary instead of raw image bytes", () => {
  const chars = estimateAttachmentPromptChars({
    kind: "image",
    name: "large-reference.png",
    mimeType: "image/png",
    data: "tech-cc-hub://prompt-attachments/session-id/image.png",
    storageUri: "tech-cc-hub://prompt-attachments/session-id/image.png",
    storagePath: "D:\\tmp\\image.png",
    size: 4_800_000,
    summaryText: "Local image asset; use design_inspect_image with the saved path.",
  });

  assert.ok(chars < 1_000);
});

```
