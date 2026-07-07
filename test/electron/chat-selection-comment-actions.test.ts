import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chat selection popover supports comment actions alongside quote", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(source, /kind: "selection" \| "message" \| "comment" = "message"/);
  assert.match(source, /<span>添加到对话<\/span>/);
  assert.match(source, /评论/);
  assert.match(source, /加入评论/);
  assert.match(source, /直接发送/);
  assert.match(source, /appendMessageReferenceToComposer\([\s\S]*"comment"/);
});