import assert from "node:assert/strict";
import test from "node:test";

import {
  getUnexpectedRunnerEndMessage,
  normalizeBackgroundRunnerStatus,
  RunnerBackgroundTaskLifecycle,
} from "../../src/shared/runner-background-lifecycle.js";

test("background-requested turn completion keeps the runner live", () => {
  assert.equal(normalizeBackgroundRunnerStatus("completed", true), "running");
  assert.equal(normalizeBackgroundRunnerStatus("completed", false), "completed");
  assert.equal(normalizeBackgroundRunnerStatus("error", true), "error");
});

test("background stream end before membership drain is a hard failure", () => {
  assert.match(getUnexpectedRunnerEndMessage(true), /membership became empty/);
  assert.match(getUnexpectedRunnerEndMessage(false), /without a result message/);
});

test("background completion requires membership drain followed by a new idle", async () => {
  async function* messages() {
    yield { type: "system", subtype: "background_tasks_changed", tasks: [{ task_id: "task-1" }] };
    yield { type: "system", subtype: "session_state_changed", state: "idle" };
    yield { type: "system", subtype: "background_tasks_changed", tasks: [] };
    yield { type: "system", subtype: "task_notification", task_id: "task-1" };
    yield { type: "system", subtype: "session_state_changed", state: "idle" };
  }

  const lifecycle = new RunnerBackgroundTaskLifecycle();
  lifecycle.beginTurn();
  const transitions = [];
  for await (const message of messages()) {
    transitions.push(lifecycle.observeMessage(message));
    if (transitions.length === 1) {
      assert.deepEqual(lifecycle.requestBackground(), { active: true, completedBeforeResult: false });
    }
  }

  assert.equal(transitions[1].completed, false, "idle before drain must not finish the run");
  assert.equal(transitions[2].completed, false, "tasks=[] must not close before trailing notifications");
  assert.equal(transitions[3].completed, false);
  assert.equal(transitions[4].completed, true, "a fresh idle after drain completes the run");
  assert.equal(lifecycle.isActive(), false);
});

test("a complete current-turn level before background_requested waits for a later bookend", () => {
  const lifecycle = new RunnerBackgroundTaskLifecycle();
  lifecycle.beginTurn();
  lifecycle.observeMessage({
    type: "system",
    subtype: "background_tasks_changed",
    tasks: [{ task_id: "task-current" }],
  });
  lifecycle.observeMessage({ type: "system", subtype: "background_tasks_changed", tasks: [] });

  assert.deepEqual(lifecycle.requestBackground(), { active: true, completedBeforeResult: false });
  assert.equal(lifecycle.isActive(), true);
  assert.equal(lifecycle.observeMessage({
    type: "system",
    subtype: "session_state_changed",
    state: "idle",
  }).completed, true);
});

test("draining inherited tasks does not complete a new background request", () => {
  const lifecycle = new RunnerBackgroundTaskLifecycle();
  lifecycle.observeMessage({
    type: "system",
    subtype: "background_tasks_changed",
    tasks: [{ task_id: "task-from-prior-turn" }],
  });
  lifecycle.beginTurn();
  lifecycle.observeMessage({ type: "system", subtype: "background_tasks_changed", tasks: [] });

  assert.deepEqual(lifecycle.requestBackground(), { active: true, completedBeforeResult: false });
  assert.equal(lifecycle.isActive(), true);
  assert.equal(lifecycle.observeMessage({
    type: "system",
    subtype: "session_state_changed",
    state: "idle",
  }).completed, false, "the pre-result empty level cannot complete the new cycle");
  lifecycle.observeMessage({ type: "system", subtype: "background_tasks_changed", tasks: [] });
  assert.equal(lifecycle.observeMessage({
    type: "system",
    subtype: "session_state_changed",
    state: "idle",
  }).completed, true);
});

test("a fully bookended fast background task can complete at background_requested result", () => {
  const lifecycle = new RunnerBackgroundTaskLifecycle();
  lifecycle.beginTurn();
  lifecycle.observeMessage({
    type: "system",
    subtype: "background_tasks_changed",
    tasks: [{ task_id: "task-fast" }],
  });
  lifecycle.observeMessage({ type: "system", subtype: "background_tasks_changed", tasks: [] });
  lifecycle.observeMessage({ type: "system", subtype: "task_notification", task_id: "task-fast" });
  lifecycle.observeMessage({ type: "system", subtype: "session_state_changed", state: "idle" });

  assert.deepEqual(lifecycle.requestBackground(), { active: false, completedBeforeResult: true });
  assert.equal(lifecycle.isActive(), false);
});
