import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

test("chat image attachments keep a single image compact without shrinking galleries", () => {
  const imageBranchStart = source.indexOf('if (attachment.kind === "image")');
  const textBranchStart = source.indexOf('className="col-span-full rounded-2xl border border-black/6 bg-[#eef2f8] p-3"', imageBranchStart);
  assert.match(source, /const isSingleImageAttachment = message\.attachments\?\.length === 1 && message\.attachments\[0\]\?\.kind === "image";/);
  assert.match(source, /isSingleImageAttachment\s*\?\s*"chat-attachment-list mt-2 grid w-full max-w-\[22rem\] grid-cols-1 gap-2"\s*:\s*"chat-attachment-list mt-2 grid w-full max-w-\[78%\] grid-cols-\[repeat\(auto-fit,minmax\(12rem,1fr\)\)\] gap-2"/);
  assert.ok(imageBranchStart >= 0);
  assert.ok(textBranchStart > imageBranchStart);

  const imageBranch = source.slice(imageBranchStart, textBranchStart);
  assert.match(imageBranch, /aria-label=\{`预览图片 \$\{attachment\.name\}`\}/);
  assert.match(imageBranch, /chat-attachment-image-tile group\/image relative aspect-\[16\/10\]/);
  assert.match(imageBranch, /chat-attachment-image-thumb h-full w-full object-cover/);
  assert.match(imageBranch, /bg-gradient-to-t from-black\/70 via-black\/20 to-transparent/);
  assert.match(imageBranch, /truncate text-xs font-medium text-white/);
  assert.doesNotMatch(imageBranch, /chat-attachment-meta/);
  assert.doesNotMatch(imageBranch, />图片<\/span>/);
});
