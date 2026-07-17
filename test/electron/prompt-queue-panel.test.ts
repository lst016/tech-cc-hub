import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("src/ui/components/prompt-input/PromptComposerContextChips.tsx", "utf8");

test("queued message panel exposes a collapse toggle", () => {
  assert.match(source, /const \[collapsed,\s*setCollapsed\] = useState\(false\)/);
  assert.match(source, /setCollapsed\(\(value\) => !value\)/);
  assert.match(source, /aria-expanded=\{!collapsed\}/);
  assert.match(source, /\{collapsed \? "展开" : "收起"\}/);
  assert.match(source, /\{!collapsed && \(/);
});

test("collapsed queued message panel keeps the next item discoverable", () => {
  assert.match(source, /下一条：\{nextLabel\}/);
  assert.match(source, /onClick=\{\(\) => onEdit\(nextQueuedMessage\)\}/);
  assert.match(source, /max-h-\[216px\]/);
});

test("queued message rows expose status and actions without relying on icon shape", () => {
  assert.match(source, /role="region"/);
  assert.match(source, /aria-label="待发送队列"/);
  assert.match(source, /data-queue-next=\{index === 0 \? "true" : undefined\}/);
  assert.match(source, /aria-current=\{index === 0 \? "true" : undefined\}/);
  assert.match(source, /aria-label=\{`编辑排队消息 \$\{index \+ 1\}`\}/);
  assert.match(source, /aria-label=\{`移除排队消息 \$\{index \+ 1\}`\}/);
  assert.match(source, /queued-messages-scroll/);
});
