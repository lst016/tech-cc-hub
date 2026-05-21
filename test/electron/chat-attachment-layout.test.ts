import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

test("chat image attachments render as compact single-line rows", () => {
  const imageBranchStart = source.indexOf('if (attachment.kind === "image")');
  const textBranchStart = source.indexOf('className="rounded-2xl border border-black/6 bg-[#eef2f8] p-3"', imageBranchStart);
  assert.match(source, /chat-attachment-list mt-2 grid w-full max-w-\[78%\] gap-2/);
  assert.ok(imageBranchStart >= 0);
  assert.ok(textBranchStart > imageBranchStart);

  const imageBranch = source.slice(imageBranchStart, textBranchStart);
  assert.match(imageBranch, /chat-attachment-image-row flex w-full min-w-0 items-center gap-3 text-left/);
  assert.match(imageBranch, /chat-attachment-meta flex min-w-0 flex-1 items-center gap-2/);
  assert.match(imageBranch, /h-14 w-20/);
  assert.doesNotMatch(imageBranch, /max-h-64 w-full/);
});
