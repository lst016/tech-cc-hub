import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("prompt editor preserves explicit trailing newlines", () => {
  const source = readFileSync("src/ui/components/PromptInput.tsx", "utf8");
  const getterMatch = source.match(
    /function getPromptTextFromEditor\(editor: HTMLElement\) \{[\s\S]*?\r?\n}\r?\n\r?\nfunction getNodePromptLength/,
  );

  assert.ok(getterMatch, "getPromptTextFromEditor should be present");
  assert.doesNotMatch(getterMatch[0], /replace\(\s*\/\\n\+\$\/,\s*""\s*\)/);
  assert.match(source, /node\.dataset\.promptEditorSentinel/);
  assert.match(source, /if \(rawPromptText\.endsWith\("\\n"\) \|\| rawPromptText\.length === 0\) \{\s*appendPromptEditorSentinel\(fragment\);/s);
});
