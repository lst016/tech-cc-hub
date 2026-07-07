import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("assistant markdown cards use the selectable text wrapper", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(
    source,
    /<CollapsibleText[\s\S]*text=\{visibleAssistantText\}[\s\S]*renderMarkdown[\s\S]*referenceSourceRole="assistant"[\s\S]*referenceSourceLabel=\{title\}/,
  );
  assert.doesNotMatch(
    source,
    /<MDContent text=\{visibleAssistantText\} \/>/,
  );
});