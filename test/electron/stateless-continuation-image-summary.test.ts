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
