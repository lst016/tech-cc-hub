import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createSessionCodeGraphAutoSyncScheduler,
  shouldAutoSyncCodeGraphAfterSessionTurn,
} from "../../src/electron/libs/codegraph/session-codegraph-autosync.js";

async function waitFor(predicate: () => boolean): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > 1_000) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

test("CodeGraph turn autosync only runs when a session leaves running state", () => {
  assert.equal(shouldAutoSyncCodeGraphAfterSessionTurn({
    sessionId: "session-1",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "completed",
  }), true);

  assert.equal(shouldAutoSyncCodeGraphAfterSessionTurn({
    sessionId: "session-1",
    cwd: "D:/workspace/project",
    previousStatus: "completed",
    nextStatus: "completed",
  }), false);

  assert.equal(shouldAutoSyncCodeGraphAfterSessionTurn({
    sessionId: "session-1",
    cwd: "",
    previousStatus: "running",
    nextStatus: "completed",
  }), false);

  assert.equal(shouldAutoSyncCodeGraphAfterSessionTurn({
    sessionId: "session-1",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "idle",
  }), false);
});

test("CodeGraph turn autosync serializes repeated requests for the same workspace", async () => {
  const calls: string[] = [];
  let releaseFirstSync: (() => void) | undefined;
  const firstSync = new Promise<void>((resolve) => {
    releaseFirstSync = resolve;
  });

  const scheduler = createSessionCodeGraphAutoSyncScheduler({
    minIntervalMs: 0,
    sync: async (workspaceRoot) => {
      calls.push(workspaceRoot);
      if (calls.length === 1) {
        await firstSync;
      }
    },
  });

  scheduler({
    sessionId: "session-1",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "completed",
  });
  scheduler({
    sessionId: "session-2",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "completed",
  });

  await waitFor(() => calls.length === 1);
  releaseFirstSync?.();
  await waitFor(() => calls.length === 2);

  assert.deepEqual(calls, ["D:/workspace/project", "D:/workspace/project"]);
});

test("CodeGraph turn autosync coalesces repeated requests inside the cooldown", async () => {
  const calls: string[] = [];
  const scheduler = createSessionCodeGraphAutoSyncScheduler({
    minIntervalMs: 80,
    sync: async (workspaceRoot) => {
      calls.push(workspaceRoot);
    },
  });

  scheduler({
    sessionId: "session-1",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "completed",
  });
  await waitFor(() => calls.length === 1);

  scheduler({
    sessionId: "session-2",
    cwd: "D:/workspace/project",
    previousStatus: "running",
    nextStatus: "completed",
  });

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(calls, ["D:/workspace/project"]);
  await waitFor(() => calls.length === 2);
  assert.deepEqual(calls, ["D:/workspace/project", "D:/workspace/project"]);
});

test("session turn autosync ensures missing workspace indexes instead of skip-only sync", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(source, /ensureManagedCodeGraphSynced/);
  assert.match(source, /sync:\s*ensureManagedCodeGraphSynced/);
  assert.doesNotMatch(source, /sync:\s*syncManagedCodeGraph/);
});
