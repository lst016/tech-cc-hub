import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_RETAINED_HYDRATED_SESSIONS,
  selectSessionMessageEvictionIds,
  touchRecentSessionId,
} from "../../src/ui/utils/session-message-retention.js";

test("session message retention evicts old hydrated chats but preserves active and running sessions", () => {
  const sessions = Object.fromEntries(Array.from({ length: 9 }, (_, index) => [
    `session-${index + 1}`,
    {
      status: index === 0 ? "running" : "completed",
      hydrated: true,
      messages: [{ type: "result", result: `message-${index + 1}` }],
    },
  ]));
  const recent = Array.from({ length: 9 }, (_, index) => `session-${index + 1}`);

  assert.equal(MAX_RETAINED_HYDRATED_SESSIONS, 6);
  assert.deepEqual(
    selectSessionMessageEvictionIds(sessions, recent, "session-9"),
    ["session-2", "session-3"],
  );
});

test("touchRecentSessionId moves an activated session to the newest position", () => {
  assert.deepEqual(touchRecentSessionId(["a", "b", "c"], "b"), ["a", "c", "b"]);
  assert.deepEqual(touchRecentSessionId(["a"], null), ["a"]);
});
