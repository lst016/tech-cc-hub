import test from "node:test";
import assert from "node:assert/strict";

import {
  getRunnerTerminalReasonLabel,
  isRunnerResultForPromptOrigin,
  isEmptySuccessfulRunnerResult,
  isSuccessfulRunnerResult,
  shouldAutoContinueUnfinishedPlan,
  shouldBypassProviderResumeAfterEmptySuccess,
  shouldSuppressRunnerErrorAfterSuccessfulResult,
} from "../../src/shared/runner-status.js";

test("only results belonging to the active prompt origin can finalize its turn", () => {
  assert.equal(
    isRunnerResultForPromptOrigin(
      { origin: { kind: "task-notification" } },
      { kind: "human" },
    ),
    false,
  );
  assert.equal(
    isRunnerResultForPromptOrigin(
      { origin: { kind: "human" } },
      { kind: "human" },
    ),
    true,
  );
  assert.equal(
    isRunnerResultForPromptOrigin({}, { kind: "human" }),
    true,
  );
  assert.equal(
    isRunnerResultForPromptOrigin(
      { origin: { kind: "task-notification" } },
      { kind: "task-notification", subkind: "scheduled-trigger" },
    ),
    true,
  );
  assert.equal(
    isRunnerResultForPromptOrigin(
      { origin: { kind: "channel", server: "secondary" } },
      { kind: "channel", server: "primary" },
    ),
    false,
  );
});

test("successful runner result is the only terminal state that suppresses late runner errors", () => {
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success" }), true);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "error_max_turns" }), false);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success", terminal_reason: "completed" }), true);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success", terminal_reason: "background_requested" }), true);
  assert.equal(isSuccessfulRunnerResult({ type: "result", subtype: "success", terminal_reason: "budget_exhausted" }), false);
  assert.equal(isSuccessfulRunnerResult({ type: "assistant" }), false);

  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(true), true);
  assert.equal(shouldSuppressRunnerErrorAfterSuccessfulResult(false), false);
});

test("terminal reason labels expose SDK 0.3.214 failure semantics", () => {
  assert.equal(getRunnerTerminalReasonLabel("budget_exhausted"), "预算已用尽");
  assert.equal(getRunnerTerminalReasonLabel("background_requested"), "已转入后台");
  assert.equal(getRunnerTerminalReasonLabel("future_reason"), "future_reason");
  assert.equal(getRunnerTerminalReasonLabel("completed"), undefined);
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

test("an empty success never enters unfinished-plan auto continuation", () => {
  const common = {
    backgroundActive: false,
    hasAssistantTextActivity: false,
    hasUnfinishedPlan: true,
    retryCount: 0,
    maxRetries: 3,
  };

  assert.equal(
    shouldAutoContinueUnfinishedPlan(
      { type: "result", subtype: "success", terminal_reason: "completed", result: "" },
      common,
    ),
    false,
  );
  assert.equal(
    shouldAutoContinueUnfinishedPlan(
      { type: "result", subtype: "success", terminal_reason: "completed", result: "done" },
      common,
    ),
    true,
  );
  assert.equal(
    shouldAutoContinueUnfinishedPlan(
      { type: "result", subtype: "success", terminal_reason: "completed", result: "done" },
      { ...common, backgroundActive: true },
    ),
    false,
  );
});

test("the latest empty success breaks provider resume until a later terminal result", () => {
  const emptySuccess = {
    type: "result",
    subtype: "success",
    is_error: false,
    result: "",
  };

  assert.equal(
    shouldBypassProviderResumeAfterEmptySuccess([
      emptySuccess,
      { type: "assistant" },
    ]),
    true,
  );
  assert.equal(
    shouldBypassProviderResumeAfterEmptySuccess([
      emptySuccess,
      { type: "result", subtype: "success", is_error: false, result: "done" },
    ]),
    false,
  );
  assert.equal(
    shouldBypassProviderResumeAfterEmptySuccess([
      { type: "result", subtype: "success", is_error: true, result: "" },
    ]),
    false,
  );
  assert.equal(shouldBypassProviderResumeAfterEmptySuccess([{ type: "assistant" }]), false);
});
