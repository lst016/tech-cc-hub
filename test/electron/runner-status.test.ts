import test from "node:test";
import assert from "node:assert/strict";

import {
  isEmptySuccessfulRunnerResult,
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

test("empty success without assistant text is not treated as real work", () => {
  assert.equal(
    isEmptySuccessfulRunnerResult({ type: "result", subtype: "success", result: "" }, false),
    true,
  );
  assert.equal(
    isEmptySuccessfulRunnerResult({ type: "result", subtype: "success", result: "" }, true),
    false,
  );
  assert.equal(
    isEmptySuccessfulRunnerResult({ type: "result", subtype: "success", result: "done" }, false),
    false,
  );
  assert.equal(
    isEmptySuccessfulRunnerResult({ type: "result", subtype: "error", result: "" }, false),
    false,
  );
});
