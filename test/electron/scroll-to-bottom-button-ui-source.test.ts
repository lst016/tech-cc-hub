import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("the floating scroll-to-bottom control matches the compact circular reference", () => {
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const buttonSource = readFileSync("src/ui/components/chat/ScrollToBottomButton.tsx", "utf8");

  assert.match(appSource, /<ScrollToBottomButton onClick=\{scrollToBottom\} \/>/);
  assert.match(buttonSource, /h-12 w-12/);
  assert.match(buttonSource, /rounded-full border border-\[#ededed\] bg-white/);
  assert.match(buttonSource, /text-\[#1a1c1f\]/);
  assert.match(buttonSource, /className="h-7 w-7"/);
  assert.match(buttonSource, /strokeWidth=\{1\.5\}/);
  assert.match(buttonSource, /<path d="M19\.5 13\.5 12 21m0 0-7\.5-7\.5M12 21V3" \/>/);
  assert.match(buttonSource, /aria-label="有新消息，回到底部"/);
  assert.doesNotMatch(appSource, /animate-bounce-subtle/);
  assert.doesNotMatch(appSource, /<span>有新消息<\/span>/);
});
