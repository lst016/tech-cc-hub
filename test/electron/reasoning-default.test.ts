import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appStoreSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
const taskSettingsSource = readFileSync("src/electron/libs/task/settings.ts", "utf8");
const taskPanelSource = readFileSync("src/ui/components/TaskPanel.tsx", "utf8");
const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("chat composer defaults reasoning to xhigh", () => {
  assert.match(appStoreSource, /reasoningMode:\s*"xhigh"/);
  assert.match(promptInputSource, /\{ value: "xhigh", label: "超高" \}/);
});

test("task workflow defaults reasoning to xhigh", () => {
  assert.match(taskSettingsSource, /defaultReasoningMode:\s*"xhigh"/);
  assert.doesNotMatch(taskPanelSource, /defaultReasoningMode \?\? "high"/);
  assert.match(taskPanelSource, /defaultReasoningMode \?\? "xhigh"/);
});

test("runner forwards reasoning mode as SDK thinking and effort options", () => {
  assert.match(runnerSource, /const thinking = buildThinkingConfig\(runtime\?\.reasoningMode\);/);
  assert.match(runnerSource, /const effort = buildEffortLevel\(runtime\?\.reasoningMode\);/);
  assert.match(runnerSource, /thinking,\s*\n\s*effort,/);
  assert.match(runnerSource, /return reasoningMode;/);
});

test("runner enables Claude Code workflows without forcing ultracode for ordinary prompts", () => {
  assert.match(runnerSource, /buildClaudeDynamicWorkflowSettings\(currentDisplayPrompt, runtime\?\.reasoningMode\)/);
  assert.match(runnerSource, /enableWorkflows:\s*true/);
  assert.match(runnerSource, /wantsDynamicWorkflow && reasoningMode === "xhigh"/);
});
