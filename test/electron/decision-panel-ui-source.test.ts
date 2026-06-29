import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

describe("decision panel ask-user UI", () => {
  const source = readFileSync("src/ui/components/DecisionPanel.tsx", "utf8");

  it("renders questions in a scrollable card with question progress controls", () => {
    assert.match(source, /请回答以下问题/);
    assert.match(source, /max-h-\[min\(42vh,330px\)\]/);
    assert.match(source, /overflow-y-auto/);
    assert.match(source, /scrollToQuestion\(currentQuestionIndex - 1\)/);
    assert.match(source, /scrollToQuestion\(currentQuestionIndex \+ 1\)/);
    assert.match(source, /\{currentQuestionIndex \+ 1\} \/ \{questions\.length\}/);
  });

  it("auto-scrolls to the next question after a single-choice option is selected", () => {
    assert.match(source, /handleOptionClick/);
    assert.match(source, /if \(!multiSelect\)/);
    assert.match(source, /window\.setTimeout\(\(\) => scrollToQuestion\(qIndex \+ 1\), 80\)/);
    assert.match(source, /scrollIntoView\(\{\s*behavior: "smooth",\s*block: "start",\s*\}\)/);
  });

  it("renders answer options as one row with familiar letter badges", () => {
    assert.match(source, /OPTION_LABELS/);
    assert.match(source, /items-start gap-3 rounded-md border px-3 py-2/);
    assert.match(source, /\{OPTION_LABELS\[optIndex\] \?\? optIndex \+ 1\}/);
    assert.doesNotMatch(source, /sm:grid-cols-2/);
  });

  it("keeps custom answers and final submit on the same ask-user contract", () => {
    assert.match(source, /或输入自定义答案/);
    assert.match(source, /answers: buildAnswers\(questions, selectedOptions, otherInputs, allowFreeformAnswer\)/);
    assert.match(source, /behavior: "allow"/);
    assert.match(source, /继续/);
  });
});
