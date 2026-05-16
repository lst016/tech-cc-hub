# test/electron/image-preprocessor-core.test.ts

> 模块：`test` · 语言：`typescript` · 行数：41

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `result@18`
- `persistImageAttachmentReference@23`
- `summarizeImageAttachment@28`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/libs/image-preprocessor-core.js`
- `../../src/electron/types.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { preprocessImageAttachmentsCore } from "../../src/electron/libs/image-preprocessor-core.js";
import type { PromptAttachment } from "../../src/electron/types.js";

test("preprocessImageAttachmentsCore keeps dispatchable image attachment when image summary is empty", async () => {
  const attachment: PromptAttachment = {
    id: "image-1",
    kind: "image",
    name: "image.png",
    mimeType: "image/png",
    data: "data:image/png;base64,AAAA",
    runtimeData: "data:image/png;base64,AAAA",
    preview: "data:image/png;base64,AAAA",
    size: 4,
  };

  const result = await preprocessImageAttachmentsCore({
    imageModel: "image-model",
    selectedModel: "text-model",
    attachments: [attachment],
    persistImageAttachmentReference: async () => ({
      storagePath: "D:\\tmp\\image.png",
      storageUri: "file:///D:/tmp/image.png",
      size: 4,
    }),
    summarizeImageAttachment: async () => {
      throw new Error("image model did not return a usable summary");
    },
  });

  assert.equal(result.success, true);
  assert.equal(result.attachments.length, 1);
  assert.equal(result.attachments[0].data, "file:///D:/tmp/image.png");
  assert.equal(result.attachments[0].preview, "data:image/png;base64,AAAA");
  assert.equal(result.attachments[0].runtimeData, undefined);
  assert.match(result.attachments[0].summaryText ?? "", /image\.png/);
  assert.match(result.attachments[0].summaryText ?? "", /not return a usable summary/i);
});

```
