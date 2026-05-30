import test from "node:test";
import assert from "node:assert/strict";

import {
  mergeSessionListSession,
  type SessionListMergeTarget,
} from "../../src/ui/utils/session-list-merge.js";
import type { SessionInfo } from "../../src/ui/types.js";

function createExistingSession(): SessionListMergeTarget {
  return {
    id: "session-1",
    title: "Existing",
    status: "running",
    workflowMarkdown: "# Existing workflow",
    workflowSourceLayer: "project",
    workflowSourcePath: "/tmp/workflow.md",
    workflowState: {
      workflowId: "existing",
      sourceLayer: "project",
      status: "running",
      currentStepId: "STEP-1",
      steps: [{ stepId: "STEP-1", status: "running" }],
    },
    workflowError: "existing warning",
  };
}

test("lightweight session list merge preserves existing workflow detail", () => {
  const existing = createExistingSession();
  const summary: SessionInfo = {
    id: existing.id,
    title: "Updated title",
    status: "idle",
    createdAt: 100,
    updatedAt: 200,
  };

  const merged = mergeSessionListSession(existing, summary);

  assert.equal(merged.title, "Updated title");
  assert.equal(merged.status, "idle");
  assert.equal(merged.workflowMarkdown, existing.workflowMarkdown);
  assert.equal(merged.workflowState, existing.workflowState);
  assert.equal(merged.workflowSourceLayer, existing.workflowSourceLayer);
  assert.equal(merged.workflowSourcePath, existing.workflowSourcePath);
  assert.equal(merged.workflowError, existing.workflowError);
});

test("lightweight session list merge preserves workflow detail when undefined fields are serialized", () => {
  const existing = createExistingSession();
  const summary = {
    id: existing.id,
    title: "Updated title",
    status: "idle",
    workflowMarkdown: undefined,
    workflowState: undefined,
    workflowSourceLayer: undefined,
    workflowSourcePath: undefined,
    workflowError: undefined,
    createdAt: 100,
    updatedAt: 200,
  } satisfies SessionInfo;

  const merged = mergeSessionListSession(existing, summary);

  assert.equal(merged.title, "Updated title");
  assert.equal(merged.status, "idle");
  assert.equal(merged.workflowMarkdown, existing.workflowMarkdown);
  assert.equal(merged.workflowState, existing.workflowState);
  assert.equal(merged.workflowSourceLayer, existing.workflowSourceLayer);
  assert.equal(merged.workflowSourcePath, existing.workflowSourcePath);
  assert.equal(merged.workflowError, existing.workflowError);
});

test("full session list merge refreshes workflow detail when present", () => {
  const existing = createExistingSession();
  const full: SessionInfo = {
    id: existing.id,
    title: "Updated title",
    status: "completed",
    workflowMarkdown: "# New workflow",
    workflowSourceLayer: "user",
    workflowSourcePath: "/tmp/new.md",
    workflowState: {
      workflowId: "new",
      sourceLayer: "user",
      status: "completed",
      steps: [],
    },
    workflowError: undefined,
    createdAt: 100,
    updatedAt: 200,
  };

  const merged = mergeSessionListSession(existing, full);

  assert.equal(merged.workflowMarkdown, "# New workflow");
  assert.equal(merged.workflowState?.workflowId, "new");
  assert.equal(merged.workflowSourceLayer, "user");
  assert.equal(merged.workflowSourcePath, "/tmp/new.md");
});
