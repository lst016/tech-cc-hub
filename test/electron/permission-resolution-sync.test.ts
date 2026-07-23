import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { useAppStore, type SessionView } from "../../src/ui/store/useAppStore.js";

function resetStore(): void {
  useAppStore.setState(useAppStore.getInitialState(), true);
}

function sessionWithPermissions(): SessionView {
  return {
    id: "lark-session",
    title: "Lark session",
    status: "running",
    messages: [],
    permissionRequests: [
      { toolUseId: "question-1", toolName: "AskUserQuestion", input: { questions: [] } },
      { toolUseId: "question-2", toolName: "AskUserQuestion", input: { questions: [] } },
    ],
    hydrated: true,
    hasMoreHistory: false,
  };
}

test("remote permission resolution closes the matching desktop decision panel", (context) => {
  context.after(resetStore);
  useAppStore.setState({
    sessions: { "lark-session": sessionWithPermissions() },
    archivedSessions: {},
  });

  useAppStore.getState().handleServerEvent({
    type: "permission.resolved",
    payload: { sessionId: "lark-session", toolUseId: "question-1" },
  });

  assert.deepEqual(
    useAppStore.getState().sessions["lark-session"]?.permissionRequests.map((request) => request.toolUseId),
    ["question-2"],
  );
});

test("permission responses broadcast their resolution to every renderer", () => {
  const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");

  assert.match(
    source,
    /event\.type === "permission\.response"[\s\S]*type: "permission\.resolved"[\s\S]*toolUseId: event\.payload\.toolUseId/,
  );
});
