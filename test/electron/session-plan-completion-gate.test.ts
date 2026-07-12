import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import * as planProgress from "../../src/shared/plan-progress.js";
import { SessionStore } from "../../src/electron/libs/session-store.js";
import type { StreamMessage } from "../../src/electron/types.js";

type PlanSnapshot = {
  sessionId: string;
  updatedAt: number;
  source: "update_plan";
  plan: Array<{ step: string; status: "pending" | "in_progress" | "completed" }>;
};

type SessionWithPlan = {
  planSnapshot?: PlanSnapshot;
  status?: string;
};

type PlanProgressWithCompletionGate = typeof planProgress & {
  hasIncompletePlan?: (plan: PlanSnapshot["plan"] | undefined) => boolean;
};

test("an unfinished plan is not eligible for task completion", () => {
  const hasIncompletePlan = (planProgress as PlanProgressWithCompletionGate).hasIncompletePlan;

  assert.equal(typeof hasIncompletePlan, "function");
  if (!hasIncompletePlan) return;

  assert.equal(hasIncompletePlan(undefined), false);
  assert.equal(hasIncompletePlan([{ step: "implement", status: "completed" }]), false);
  assert.equal(hasIncompletePlan([{ step: "test", status: "in_progress" }]), true);
  assert.equal(hasIncompletePlan([{ step: "review", status: "pending" }]), true);
});

test("the latest plan survives a session-store reload", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-session-plan-"));
  const dbPath = join(dir, "sessions.db");
  const planSnapshot: PlanSnapshot = {
    sessionId: "",
    updatedAt: 123,
    source: "update_plan",
    plan: [
      { step: "implement", status: "completed" },
      { step: "test", status: "in_progress" },
    ],
  };
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Plan gate" });
    planSnapshot.sessionId = session.id;
    (store.updateSession as unknown as (id: string, updates: SessionWithPlan) => void)(session.id, { planSnapshot });
    store.updateSession(session.id, { status: "completed" });
    store.close();

    const reloaded = new SessionStore(dbPath);
    try {
      const sessionAfterReload = reloaded.getSession(session.id) as (SessionWithPlan | undefined);
      assert.deepEqual(sessionAfterReload?.planSnapshot, planSnapshot);
      assert.equal(sessionAfterReload?.status, "idle");
    } finally {
      reloaded.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a legacy completed session restores its latest unfinished update_plan", () => {
  const dir = mkdtempSync(join(tmpdir(), "tech-cc-hub-legacy-plan-"));
  const dbPath = join(dir, "sessions.db");
  const store = new SessionStore(dbPath);

  try {
    const session = store.createSession({ title: "Legacy plan" });
    store.recordMessage(session.id, {
      type: "assistant",
      uuid: "legacy-plan-message",
      session_id: "sdk-session",
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [{
          type: "tool_use",
          id: "legacy-plan-tool",
          name: "mcp__tech-cc-hub-plan__update_plan",
          input: {
            plan: [
              { step: "implement", status: "completed" },
              { step: "verify", status: "pending" },
            ],
          },
        }],
      },
      capturedAt: 456,
      historyId: "legacy-plan-message",
    } as unknown as StreamMessage);
    store.updateSession(session.id, { status: "completed" });
    store.close();

    const reloaded = new SessionStore(dbPath);
    try {
      const restored = reloaded.getSession(session.id) as (SessionWithPlan | undefined);
      assert.equal(restored?.status, "idle");
      assert.deepEqual(restored?.planSnapshot?.plan, [
        { step: "implement", status: "completed" },
        { step: "verify", status: "pending" },
      ]);
    } finally {
      reloaded.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
