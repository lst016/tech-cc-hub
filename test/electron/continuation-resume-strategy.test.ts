import assert from "node:assert/strict";
import test from "node:test";

import { resolveContinuationResumeStrategy } from "../../src/electron/continuation-resume-strategy.js";

test("resumes the provider session after an explicit pause even for stateless APIs", () => {
  const strategy = resolveContinuationResumeStrategy({
    apiSupportsRemoteResume: false,
    sessionStatus: "paused",
    claudeSessionId: "sdk-session-1",
  });

  assert.equal(strategy.resumeSessionId, "sdk-session-1");
  assert.equal(strategy.useStatelessContinuation, false);
});

test("resumes provider sessions for normal custom API turns", () => {
  const strategy = resolveContinuationResumeStrategy({
    apiSupportsRemoteResume: false,
    sessionStatus: "completed",
    claudeSessionId: "sdk-session-1",
  });

  assert.equal(strategy.resumeSessionId, "sdk-session-1");
  assert.equal(strategy.useStatelessContinuation, false);
});

test("resumes provider sessions when the API supports remote resume", () => {
  const strategy = resolveContinuationResumeStrategy({
    apiSupportsRemoteResume: true,
    sessionStatus: "completed",
    claudeSessionId: "sdk-session-1",
  });

  assert.equal(strategy.resumeSessionId, "sdk-session-1");
  assert.equal(strategy.useStatelessContinuation, false);
});

test("falls back to stateless continuation when there is no provider session id", () => {
  const strategy = resolveContinuationResumeStrategy({
    apiSupportsRemoteResume: false,
    sessionStatus: "paused",
  });

  assert.equal(strategy.resumeSessionId, undefined);
  assert.equal(strategy.useStatelessContinuation, true);
});
