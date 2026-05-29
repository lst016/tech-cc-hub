import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("session continue preserves execution mode and runtime controls before runner reuse", () => {
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
    continueSection.indexOf("const nextExecutionMode") < continueSection.indexOf("const warmReuseKey"),
    "runtime controls must be resolved before building the reuse key",
  );
});
