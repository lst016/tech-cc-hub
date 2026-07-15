import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appStoreSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
const taskSettingsSource = readFileSync("src/electron/libs/task/settings.ts", "utf8");
const taskPanelSource = readFileSync("src/ui/components/TaskPanel.tsx", "utf8");
const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const composerModelMenuSource = readFileSync("src/ui/components/prompt-input/ComposerModelMenu.tsx", "utf8");
const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("chat composer defaults reasoning to xhigh", () => {
  assert.match(appStoreSource, /reasoningMode:\s*"xhigh"/);
  assert.match(promptInputSource, /const storeReasoningMode = useAppStore\(\(state\) => state\.reasoningMode\)/);
  assert.match(promptInputSource, /const appSetReasoningMode = useAppStore\(\(state\) => state\.setReasoningMode\)/);
  assert.match(promptInputSource, /const reasoningMode = controller\?\.reasoningMode \?\? storeReasoningMode/);
  assert.match(promptInputSource, /const setReasoningMode = controller\?\.setReasoningMode \?\? appSetReasoningMode/);
  assert.match(promptInputSource, /reasoningMode=\{reasoningMode\}/);
  assert.match(promptInputSource, /onReasoningModeChange=\{setReasoningMode\}/);
  assert.match(composerModelMenuSource, /REASONING_OPTIONS/);
  assert.match(composerModelMenuSource, /思维强度/);
});

test("chat composer model menu includes fuzzy model filtering", () => {
  assert.match(composerModelMenuSource, /placeholder="筛选模型"/);
  assert.match(composerModelMenuSource, /filterComposerModelOptions\(displayOptions, modelFilter\)/);
  assert.match(composerModelMenuSource, /haystack\.includes\(part\)/);
  assert.match(composerModelMenuSource, /closeMenu\(\);/);
});

test("task workflow defaults reasoning to xhigh", () => {
  assert.match(taskSettingsSource, /defaultReasoningMode:\s*"xhigh"/);
  assert.doesNotMatch(taskPanelSource, /defaultReasoningMode \?\? "high"/);
  assert.match(taskPanelSource, /defaultReasoningMode \?\? "xhigh"/);
});

test("runner forwards reasoning mode as SDK thinking and effort options", () => {
  assert.match(runnerSource, /const thinking = buildThinkingConfig\(runtime\?\.reasoningMode\);/);
  assert.match(runnerSource, /const effort = buildEffortLevel\(runtime\?\.reasoningMode,\s*mergedEnv\);/);
  assert.match(runnerSource, /thinking,\s*\n\s*effort,/);
  assert.match(runnerSource, /return reasoningMode;/);
});

test("runner maps xhigh effort to max for Bedrock transport", () => {
  assert.match(runnerSource, /reasoningMode === "xhigh" && isBedrockRuntimeEnv\(env\)/);
  assert.match(runnerSource, /return "max";/);
  assert.match(runnerSource, /env\.CLAUDE_CODE_USE_BEDROCK/);
  assert.ok(runnerSource.includes('/^(?:[a-z0-9-]+\\.)?anthropic\\.claude-/i.test(model);'));
});

test("runner enables Claude Code workflows without forcing ultracode for ordinary prompts", () => {
  assert.match(runnerSource, /buildClaudeDynamicWorkflowSettings\(currentDisplayPrompt, runtime\?\.reasoningMode, runtime\?\.workflowMode\)/);
  assert.match(runnerSource, /enableWorkflows:\s*true/);
  assert.match(runnerSource, /wantsDynamicWorkflow && reasoningMode === "xhigh"/);
});
