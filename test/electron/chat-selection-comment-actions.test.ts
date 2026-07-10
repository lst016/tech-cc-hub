import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("chat selection popover supports compact comment actions alongside quote", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const popoverSource = source.match(
    /selectionDraft && typeof document[\s\S]*?document\.body/,
  )?.[0] ?? "";

  assert.match(source, /kind: "selection" \| "message" \| "comment" = "message"/);
  assert.match(popoverSource, /<span>添加到对话<\/span>/);
  assert.match(popoverSource, /评论/);
  assert.match(popoverSource, /加入评论/);
  assert.match(popoverSource, /直接发送/);
  assert.match(source, /appendMessageReferenceToComposer\([\s\S]*"comment"/);

  assert.match(popoverSource, /role="group"/);
  assert.match(popoverSource, /aria-label="选区操作"/);
  assert.match(popoverSource, /aria-expanded=\{selectionDraft\.commentOpen\}/);
  assert.match(popoverSource, /divide-x divide-black\/10/);
  assert.match(popoverSource, /w-\[318px\] max-w-full/);
});
