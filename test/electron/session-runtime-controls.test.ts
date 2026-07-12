import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("session continue preserves execution mode and runtime controls before stateless continuation", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const continueSection = source.slice(
    source.indexOf('if (event.type === "session.continue")'),
    source.indexOf('if (event.type === "session.set_model")'),
  );

  assert.match(
    continueSection,
    /const nextExecutionMode = event\.payload\.runtime\?\.executionMode \?\? session\.executionMode \?\? "foreground";[\s\S]*const nextReasoningMode = event\.payload\.runtime\?\.reasoningMode \?\? session\.reasoningMode;[\s\S]*const nextPermissionMode = event\.payload\.runtime\?\.permissionMode \?\? session\.permissionMode;[\s\S]*const runnerRuntime = \{[\s\S]*executionMode: nextExecutionMode,[\s\S]*reasoningMode: nextReasoningMode,[\s\S]*permissionMode: nextPermissionMode,[\s\S]*model: selectedModel,/,
  );
  assert.ok(
    continueSection.indexOf("const nextExecutionMode") < continueSection.indexOf("const continuationPayload"),
    "runtime controls must be resolved before building the stateless continuation payload",
  );
});

test("prompt runtime defaults SDK workflow mode to auto and sends it with prompts", () => {
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
  const promptActionsSource = readFileSync("src/ui/components/prompt-input/usePromptActions.ts", "utf8");

  assert.match(storeSource, /workflowMode: RuntimeWorkflowMode;/);
  assert.match(storeSource, /setWorkflowMode: \(workflowMode: RuntimeWorkflowMode\) => void;/);
  assert.match(storeSource, /workflowMode: "auto"/);
  assert.match(storeSource, /setWorkflowMode: \(workflowMode\) => set\(\{ workflowMode \}\)/);

  assert.match(promptActionsSource, /const workflowMode = useAppStore\(\(state\) => state\.workflowMode\);/);
  assert.match(promptActionsSource, /workflowMode,/);
  assert.match(promptActionsSource, /permissionMode: permissionMode === "plan" \? "bypassPermissions" : permissionMode,[\s\S]*workflowMode,/);
});
