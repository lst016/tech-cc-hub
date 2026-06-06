import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("decision panel ask-user UI", () => {
  const source = readFileSync("src/ui/components/DecisionPanel.tsx", "utf8");

  it("renders questions as a lightweight vertical step flow without nested scrolling", () => {
    assert.doesNotMatch(source, /max-h-\[min\(/);
    assert.doesNotMatch(source, /overflow-y-auto/);
    assert.match(source, /grid-cols-\[30px_minmax\(0,1fr\)\]/);
    assert.match(source, /min-h-10 w-px bg-\[linear-gradient\(180deg,rgba\(210,106,61,0\.28\),rgba\(210,106,61,0\.08\)\)\]/);
    assert.match(source, /flex shrink-0 flex-wrap gap-3/);
  });

  it("renders answer options as one option per row", () => {
    assert.match(source, /grid grid-cols-1 gap-2/);
    assert.doesNotMatch(source, /sm:grid-cols-2/);
  });

  it("uses the app accent color for status and selected option styling", () => {
    assert.match(source, /bg-accent text-white/);
    assert.match(source, /bg-accent\/\[0\.07\]/);
    assert.match(source, /rgba\(210,106,61,0\.12\)/);
    assert.match(source, /步骤确认/);
  });

  it("lets users collapse and reopen the question panel", () => {
    assert.match(source, /const expanded = expandedByRequest\[requestKey\] \?\? true/);
    assert.match(source, /setExpandedByRequest/);
    assert.match(source, /aria-expanded=\{expanded\}/);
    assert.match(source, /!expanded/);
    assert.doesNotMatch(source, /useEffect/);
  });
});
