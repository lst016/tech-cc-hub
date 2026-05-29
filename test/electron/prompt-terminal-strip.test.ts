import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const stripSource = readFileSync("src/ui/components/prompt-input/PromptComposerTerminalStrip.tsx", "utf8");
const inputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");

test("prompt composer shows running terminal processes near the input controls", () => {
  assert.match(stripSource, /window\.electron\.invoke<TerminalProcessListResult>\("terminal:list"\)/);
  assert.match(stripSource, /window\.electron\.invoke<TerminalProcessStopResult>\("terminal:stop", \{ id: processId \}\)/);
  assert.match(stripSource, /Managed terminal/);
  assert.match(stripSource, /Background commands like npm run dev stay pinned here until you stop them\./);
  assert.match(stripSource, /Stop terminal process/);
  assert.match(stripSource, /workspaceCwd/);
  assert.match(inputSource, /<PromptComposerTerminalStrip workspaceCwd=\{selectedWorkspaceCwd\} \/>/);
  assert.match(inputSource, /<PromptComposerTerminalStrip workspaceCwd=\{selectedWorkspaceCwd\} \/>\s*<div\s+ref=\{promptRef\}/);
});
