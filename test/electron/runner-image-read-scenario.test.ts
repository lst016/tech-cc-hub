import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "fs";

import { buildRasterImageReadPreToolUseDecision } from "../../src/electron/libs/raster-image-read-policy.js";

const SCENARIO_IMAGE_PATHS = [
  "D:\\workspace\\kefu\\boke-kefu-vue\\docs\\10-设计稿对照\\wa-channel-1.png",
  "D:\\workspace\\kefu\\boke-kefu-vue\\docs\\10-设计稿对照\\wa-channel-2.png",
  "D:\\workspace\\kefu\\boke-kefu-vue\\docs\\10-设计稿对照\\wa-channel-3.png",
];

test("boke-kefu-vue wa-channel scenario denies all raw image Read calls and injects summaries", async () => {
  const missing = SCENARIO_IMAGE_PATHS.filter((filePath) => !existsSync(filePath));
  assert.deepEqual(missing, []);

  const summarizedPaths: string[] = [];

  for (const filePath of SCENARIO_IMAGE_PATHS) {
    const result = await buildRasterImageReadPreToolUseDecision({
      filePath,
      imageModel: "vision-model",
      shouldSummarize: true,
      summarizeLocalImageFile: async () => {
        summarizedPaths.push(filePath);
        return `summary for ${filePath}`;
      },
    });

    assert.equal(result.continue, true);
    assert.equal(result.hookSpecificOutput?.permissionDecision, "deny");
    assert.match(String(result.hookSpecificOutput?.permissionDecisionReason), /不能通过 Read 直接读取/);
    assert.match(String(result.hookSpecificOutput?.additionalContext), /已阻止直接 Read 图片原文/);
    assert.match(String(result.hookSpecificOutput?.additionalContext), new RegExp(filePath.replace(/[\\.*+?^${}()|[\]]/g, "\\$&")));
  }

  assert.deepEqual(summarizedPaths, SCENARIO_IMAGE_PATHS);
});
