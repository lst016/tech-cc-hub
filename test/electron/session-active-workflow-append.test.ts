import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const ipcHandlersSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");

test("session continue rebuilds a stateless prompt before launching the next run", () => {
  const continueBranch = ipcHandlersSource.slice(
    ipcHandlersSource.indexOf('if (event.type === "session.continue")'),
    ipcHandlersSource.indexOf('if (event.type === "session.set_model")'),
  );
  assert.ok(
    continueBranch.indexOf("const continuationPayload = buildStatelessContinuationPayload(") < continueBranch.indexOf("runClaude({"),
    "session.continue should rebuild the stateless prompt before dispatching the next run",
  );
  assert.match(continueBranch, /const resumeSessionId = undefined;/);
});
