import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createWorkflowRunStoreState } from "../../src/ui/store/workflowRunStore.js";

describe("workflow run UI store", () => {
  it("sets, upserts, selects, and clears workflow runs by session", () => {
    const store = createWorkflowRunStoreState();
    store.setRuns("session-1", [
      {
        id: "session-1:task-1",
        sessionId: "session-1",
        taskId: "task-1",
        source: "sdk-workflow-tool",
        status: "running",
        launchedAt: 1_000,
        updatedAt: 1_000,
      },
    ]);
    store.upsertRun({
      id: "session-1:task-2",
      sessionId: "session-1",
      taskId: "task-2",
      source: "unknown",
      status: "completed",
      launchedAt: 1_500,
      updatedAt: 2_000,
    });
    store.selectRun("session-1", "session-1:task-2");

    assert.deepEqual(store.getState().runsBySessionId["session-1"]?.map((run) => run.id), [
      "session-1:task-2",
      "session-1:task-1",
    ]);
    assert.equal(store.getState().selectedRunIdBySessionId["session-1"], "session-1:task-2");

    store.clearSession("session-1");
    assert.equal(store.getState().runsBySessionId["session-1"], undefined);
    assert.equal(store.getState().selectedRunIdBySessionId["session-1"], undefined);
  });
});
