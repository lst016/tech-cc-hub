import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getCollapsibleTextPreview } from "../../src/ui/utils/collapsible-text-preview.js";

test("main assistant markdown is expanded by default and remains collapsible", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const assistantCardStart = source.indexOf("const AssistantTextCard");
  const assistantCardEnd = source.indexOf("const ToolUseCard", assistantCardStart);
  const assistantCardSource = source.slice(assistantCardStart, assistantCardEnd);
  const userCardStart = source.indexOf("const UserMessageCard");
  const userCardEnd = source.indexOf("const AssistantTextCard", userCardStart);
  const userCardSource = source.slice(userCardStart, userCardEnd);

  assert.match(source, /defaultExpanded = false/);
  assert.match(source, /const \[expanded, setExpanded\] = useState\(defaultExpanded\)/);
  assert.match(assistantCardSource, /<CollapsibleText[\s\S]*defaultExpanded/);
  assert.doesNotMatch(userCardSource, /defaultExpanded/);
  assert.match(userCardSource, /maxLines=\{24\}/);
  assert.doesNotMatch(userCardSource, /maxChars=\{180\}/);
  assert.ok(assistantCardSource.includes("rounded-[14px] rounded-tl-[5px] border border-[#dce1e7] bg-white px-4 py-3.5"));
  assert.ok(!assistantCardSource.includes("rounded-[26px] rounded-tl-[8px]"));
  assert.match(source, /onClick=\{\(\) => setExpanded\(\(value\) => !value\)\}/);
  assert.match(source, /<span>\{expandLabel\}<\/span>/);

  const text = Array.from({ length: 30 }, (_, index) => `第 ${index + 1} 行`).join("\n");
  const collapsed = getCollapsibleTextPreview(text, {
    expanded: false,
    maxLines: 24,
    maxChars: 1400,
  });
  const expanded = getCollapsibleTextPreview(text, {
    expanded: true,
    maxLines: 24,
    maxChars: 1400,
  });

  assert.equal(collapsed.expandLabel, "展开剩余 6 行");
  assert.equal(expanded.expandLabel, "收起");
  assert.equal(expanded.visibleText, text);
});
