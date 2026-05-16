# test/electron/stateless-continuation-image-summary.test.ts

> 模块：`test` · 语言：`typescript` · 行数：34

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `prompt@7`

## 依赖输入

- `node:test`
- `node:assert/strict`
- `../../src/electron/stateless-continuation.js`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import test from "node:test";
import assert from "node:assert/strict";

import { buildStatelessContinuationPrompt } from "../../src/electron/stateless-continuation.js";

test("buildStatelessContinuationPrompt keeps stored image summaries in history text", () => {
  const prompt = buildStatelessContinuationPrompt(
    [
      {
        type: "user_prompt",
        prompt: "请继续参考刚才那张截图",
        attachments: [
          {
            id: "image-1",
            kind: "image",
            name: "screenshot.png",
            mimeType: "image/png",
            data: "file:///tmp/screenshot.png",
            storagePath: "/tmp/screenshot.png",
            storageUri: "file:///tmp/screenshot.png",
            summaryText: "图片里是登录页，顶部标题为“本次登入需要二次验证”，底部有“下一步”按钮。",
          },
        ],
      },
      { type: "result", subtype: "success", result: "我已经记住这张图的关键结构。" } as never,
    ],
    "继续排查这个登录问题",
  );

  assert.match(prompt, /Image attachment \(screenshot\.png\):/);
  assert.match(prompt, /本次登入需要二次验证/);
  assert.match(prompt, /下一步/);
});

```
