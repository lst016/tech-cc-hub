import test from "node:test";
import assert from "node:assert/strict";

import {
  buildRasterImageReadBlockedMessage,
  buildRasterImageReadSummaryContext,
  shouldBlockRawRasterImageRead,
} from "../../src/electron/libs/raster-image-read-policy.js";

test("shouldBlockRawRasterImageRead blocks direct raster image reads even when an image model exists", () => {
  assert.equal(shouldBlockRawRasterImageRead("D:\\workspace\\docs\\screen.png"), true);
  assert.equal(shouldBlockRawRasterImageRead("D:\\workspace\\docs\\screen.jpg"), true);
  assert.equal(shouldBlockRawRasterImageRead("D:\\workspace\\src\\App.vue"), false);
});

test("buildRasterImageReadSummaryContext carries the image summary and denies raw Read", () => {
  const context = buildRasterImageReadSummaryContext({
    filePath: "D:\\workspace\\docs\\screen.png",
    imageModel: "vision-model",
    summary: "这是图片摘要。",
  });

  assert.match(context, /已阻止直接 Read 图片原文/);
  assert.match(context, /vision-model/);
  assert.match(context, /这是图片摘要。/);
});

test("buildRasterImageReadBlockedMessage explains why raw image reads are blocked", () => {
  const message = buildRasterImageReadBlockedMessage({
    filePath: "D:\\workspace\\docs\\screen.png",
    imageModel: "vision-model",
  });

  assert.match(message, /图片文件不能通过 Read 直接读取/);
  assert.match(message, /screen\.png/);
});
