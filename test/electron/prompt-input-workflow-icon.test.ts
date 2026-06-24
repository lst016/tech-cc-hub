import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
const appSource = readFileSync("src/ui/App.tsx", "utf8");

test("prompt composer exposes workflow as a one-shot send mode beside goal mode", () => {
  assert.match(promptInputSource, /Workflow/);
  assert.match(promptInputSource, /function formatWorkflowModePrompt\(promptValue: string\): string/);
  assert.match(promptInputSource, /\^ultracode\\b\\s\*\:\?\\s\*/);
  assert.match(promptInputSource, /return `ultracode: \$\{trimmed\}`;/);
  assert.match(promptInputSource, /const \[workflowForceEnabled, setWorkflowForceEnabled\] = useState\(false\);/);
  assert.match(promptInputSource, /onClick=\{\(\) => setWorkflowForceEnabled\(\(value\) => !value\)\}/);
  assert.match(promptInputSource, /aria-label=\{workflowForceEnabled \? "取消本次使用 Workflow" : "本次使用 Workflow"\}/);
  assert.match(promptInputSource, /title="本次使用 Workflow"/);
  assert.doesNotMatch(promptInputSource, /workflowMode === "auto" \? "off" : "auto"/);
  assert.doesNotMatch(promptInputSource, /title="SDK 自动 Workflow"/);

  const workflowButtonIndex = promptInputSource.indexOf("本次使用 Workflow");
  const goalButtonIndex = promptInputSource.indexOf("开启追求目标模式");
  assert.ok(workflowButtonIndex > 0, "workflow icon button should be rendered in the composer toolbar");
  assert.ok(goalButtonIndex > 0, "goal icon button should remain in the composer toolbar");
  assert.ok(Math.abs(workflowButtonIndex - goalButtonIndex) < 2500, "workflow and goal controls should stay adjacent");
});

test("prompt composer keeps /goal and ultracode prompt commands explicit", () => {
  assert.match(promptInputSource, /function formatGoalModePrompt\(promptValue: string\): string/);
  assert.match(promptInputSource, /return `\/goal \$\{trimmed\}`;/);
  assert.match(promptInputSource, /function formatComposerModePrompt/);
  assert.match(promptInputSource, /goalModeEnabled \? formatGoalModePrompt\(promptValue\) : promptValue/);
  assert.match(promptInputSource, /workflowForceEnabled \? formatWorkflowModePrompt\(goalPrompt\) : goalPrompt/);
  assert.doesNotMatch(promptInputSource, /return `\/workflow /);
});

test("app no longer wires the composer workflow icon to software workflow optimization prompts", () => {
  assert.doesNotMatch(appSource, /onWorkflowOptimization=\{handleHeaderWorkflowOptimization\}/);
  assert.doesNotMatch(appSource, /workflowOptimizationDisabled=\{headerWorkflowOptimizationDisabled\}/);
});
