import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("user message cards hide structured file and message references behind chips", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");

  assert.match(source, /extractFileReferencesPrompt/);
  assert.match(source, /extractMessageReferencesPrompt/);
  assert.match(source, /const FileReferenceChip/);
  assert.match(source, /const MessageReferenceChip/);
  assert.match(source, /fileReferences\.map/);
  assert.match(source, /messageReferences\.map/);
  assert.match(source, /browser_annotations\|code_references\|message_references\|file_references/);
});
