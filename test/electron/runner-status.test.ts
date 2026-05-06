import test from "node:test";
import assert from "node:assert/strict";

import {
  isSuccessfulRunnerResult,
  shouldSuppressRunnerErrorAfterSuccessfulResult,
} from "../../src/shared/runner-status.js";

test("successful runner result is the only terminal state that suppresses late runner errors", () => {
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success" }), true);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "error_max_turns" }), false);
  assert.equal(isSuccessfulRunnerResult({ type: "assistant" }), false);

  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(true), true);
  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(false), false);
});
