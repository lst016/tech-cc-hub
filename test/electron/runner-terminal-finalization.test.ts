import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

test("terminal result does not wait for optional context usage before completing the turn", () => {
  const resultStart = runnerSource.indexOf('if (message.type === "result")');
  const resultEnd = runnerSource.indexOf("extractPlanUpdateFromMessage(message)", resultStart);
  const resultSource = runnerSource.slice(resultStart, resultEnd);

  assert.ok(resultStart >= 0 && resultEnd > resultStart, "expected to find the runner result branch");
  assert.doesNotMatch(resultSource, /await activeQuery\.getContextUsage\(\)/);

  const captureIndex = resultSource.indexOf("captureContextUsage()");
  const resultMessageIndex = resultSource.indexOf("sendMessage(message)", captureIndex);
  const terminalStatusIndex = resultSource.indexOf('type: "session.status"', resultMessageIndex);

  assert.ok(
    captureIndex >= 0 && captureIndex < resultMessageIndex && resultMessageIndex < terminalStatusIndex,
    "context usage should be best-effort while the result and terminal status stay on the immediate path",
  );
});
