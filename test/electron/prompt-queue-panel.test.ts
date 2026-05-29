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
  assert.match(source, /max-h-\[240px\]/);
});
