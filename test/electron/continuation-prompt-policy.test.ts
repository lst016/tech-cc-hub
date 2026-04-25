import assert from "node:assert/strict";
import test from "node:test";

import { resolveContinuationPromptPolicy } from "../../src/electron/continuation-prompt-policy.js";

test("uses thin prompt injection when continuing a paused provider session", () => {
  const policy = resolveContinuationPromptPolicy({
    resumeSessionId: "sdk-session-1",
    useStatelessContinuation: false,
  });

  assert.equal(policy.mode, "thin-provider-resume");
  assert.equal(policy.injectProjectRuntime, false);
  assert.equal(policy.injectDevLoopPrompt, false);
  assert.equal(policy.includeHistoryInPromptLedger, false);
});

test("keeps contextual prompt injection for stateless continuation", () => {
  const policy = resolveContinuationPromptPolicy({
    useStatelessContinuation: true,
  });

  assert.equal(policy.mode, "contextual-continuation");
  assert.equal(policy.injectProjectRuntime, true);
  assert.equal(policy.injectDevLoopPrompt, true);
  assert.equal(policy.includeHistoryInPromptLedger, true);
});

test("keeps contextual prompt injection when no provider session can be resumed", () => {
  const policy = resolveContinuationPromptPolicy({
    useStatelessContinuation: false,
  });

  assert.equal(policy.mode, "contextual-continuation");
  assert.equal(policy.injectProjectRuntime, true);
  assert.equal(policy.injectDevLoopPrompt, true);
  assert.equal(policy.includeHistoryInPromptLedger, true);
});
