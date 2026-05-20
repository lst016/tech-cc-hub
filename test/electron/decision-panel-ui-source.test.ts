import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("decision panel ask-user UI", () => {
  const source = readFileSync("src/ui/components/DecisionPanel.tsx", "utf8");

  it("bounds active question panels and scrolls long content internally", () => {
    assert.match(source, /max-h-\[min\(46vh,420px\)\]/);
    assert.match(source, /max-h-\[min\(64vh,620px\)\]/);
    assert.match(source, /overflow-hidden/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /flex shrink-0 flex-wrap gap-3/);
  });

  it("lets users collapse and reopen the question panel", () => {
    assert.match(source, /const expanded = expandedByRequest\[requestKey\] \?\? true/);
    assert.match(source, /setExpandedByRequest/);
    assert.match(source, /aria-expanded=\{expanded\}/);
    assert.match(source, /!expanded/);
    assert.doesNotMatch(source, /useEffect/);
  });
});
