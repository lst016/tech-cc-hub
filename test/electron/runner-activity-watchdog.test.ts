import assert from "node:assert/strict";
import test from "node:test";

import {
  createRunnerActivityWatchdog,
  type RunnerActivityWatchdogTimerHandle,
} from "../../src/electron/libs/runner/runner-activity-watchdog.js";

type ScheduledTimer = RunnerActivityWatchdogTimerHandle & {
  id: number;
  dueAt: number;
  callback: () => void;
  cancelled: boolean;
};

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const timers = new Map<number, ScheduledTimer>();

  const setTimer = (callback: () => void, delayMs: number): RunnerActivityWatchdogTimerHandle => {
    const timer: ScheduledTimer = {
      id: nextId++,
      dueAt: now + delayMs,
      callback,
      cancelled: false,
      unref: () => undefined,
    };
    timers.set(timer.id, timer);
    return timer;
  };

  const clearTimer = (handle: RunnerActivityWatchdogTimerHandle): void => {
    const timer = handle as ScheduledTimer;
    timer.cancelled = true;
    timers.delete(timer.id);
  };

  const advance = (milliseconds: number): void => {
    const target = now + milliseconds;
    while (true) {
      const next = [...timers.values()]
        .filter((timer) => !timer.cancelled && timer.dueAt <= target)
        .sort((left, right) => left.dueAt - right.dueAt || left.id - right.id)[0];
      if (!next) break;
      timers.delete(next.id);
      now = next.dueAt;
      next.callback();
    }
    now = target;
  };

  return {
    setTimer,
    clearTimer,
    advance,
    pendingCount: () => timers.size,
  };
}

function createHarness() {
  const timers = createFakeTimers();
  const timeouts: string[] = [];
  const watchdog = createRunnerActivityWatchdog((message) => timeouts.push(message), {
    firstEventTimeoutMs: 120_000,
    idleTimeoutMs: 300_000,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  return { timers, timeouts, watchdog };
}

test("does not treat time spent waiting for a user decision as runner inactivity", () => {
  const { timers, timeouts, watchdog } = createHarness();

  watchdog.touch();
  watchdog.pause();
  timers.advance(600_000);

  assert.deepEqual(timeouts, []);
  assert.equal(timers.pendingCount(), 0);

  watchdog.resume();
  timers.advance(299_999);
  assert.deepEqual(timeouts, []);
  timers.advance(1);
  assert.deepEqual(timeouts, ["Runner stopped receiving events for 5 minutes."]);
});

test("keeps the watchdog paused until every concurrent user decision settles", () => {
  const { timers, timeouts, watchdog } = createHarness();

  watchdog.touch();
  watchdog.pause();
  watchdog.pause();
  watchdog.resume();
  timers.advance(600_000);

  assert.deepEqual(timeouts, []);
  assert.equal(timers.pendingCount(), 0);

  watchdog.resume();
  assert.equal(timers.pendingCount(), 1);
  timers.advance(300_000);
  assert.equal(timeouts.length, 1);
});

test("preserves the first-event timeout when no runner activity arrives", () => {
  const { timers, timeouts } = createHarness();

  timers.advance(119_999);
  assert.deepEqual(timeouts, []);
  timers.advance(1);
  assert.deepEqual(timeouts, ["Runner did not receive any events for 2 minutes."]);
});
