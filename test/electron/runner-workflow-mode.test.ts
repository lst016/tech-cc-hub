import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("runner maps runtime workflow mode into Claude Code SDK workflow settings", () => {
  assert.match(
    runnerSource,
    /buildClaudeDynamicWorkflowSettings\(currentDisplayPrompt, runtime\?\.reasoningMode, runtime\?\.workflowMode\)/,
  );
  assert.match(
    runnerSource,
    /workflowMode: RuntimeOverrides\["workflowMode"\] = "auto"/,
  );
  assert.match(
    runnerSource,
    /if \(workflowMode === "off"\) \{\s*return \{ disableWorkflows: true \};\s*\}/,
  );
  assert.match(
    runnerSource,
    /const wantsDynamicWorkflow = workflowMode === "force"/,
  );
  assert.doesNotMatch(
    runnerSource,
    /\/\\\/workflows\?\\b/,
  );
  assert.match(runnerSource, /ultracode/);
  assert.match(runnerSource, /enableWorkflows: true/);
});
