import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

test("session continue appends to the live runner while a workflow run is still active", () => {
  assert.match(
    ipcHandlersSource,
    /function hasActiveWorkflowRun\(sessionId: string\): boolean \{[\s\S]*run\.status === "launching" \|\| run\.status === "running" \|\| run\.status === "backgrounded"/,
  );
  assert.match(
    ipcHandlersSource,
    /const shouldAppendToActiveWorkflowRunner =[\s\S]*hasActiveWorkflowRun\(session\.id\);[\s\S]*await liveHandle\.appendPrompt\(agentPrompt, currentAgentAttachments, \{/,
  );
  assert.ok(
    ipcHandlersSource.indexOf("const shouldAppendToActiveWorkflowRunner") < ipcHandlersSource.indexOf("if (runnerHandles.has(session.id))"),
    "active workflow follow-up prompts must append before session.continue closes the live runner",
  );
});