import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const CLIENT_EVENT_TYPES = [
  "btw.thread.create",
  "btw.thread.send",
  "btw.thread.stop",
  "btw.thread.permission.response",
  "btw.thread.close",
  "btw.parent.close_all",
] as const;

const SERVER_EVENT_TYPES = [
  "btw.thread.created",
  "btw.thread.status",
  "btw.stream.message",
  "btw.stream.user_prompt",
  "btw.permission.request",
  "btw.runner.error",
  "btw.thread.closed",
  "btw.parent.closed",
] as const;

describe("ephemeral BTW protocol contract", () => {
  it("declares the dedicated client and server events in both processes", () => {
    for (const path of ["src/electron/types.ts", "src/ui/types.ts"]) {
      const source = readFileSync(path, "utf8");
      for (const eventType of [...CLIENT_EVENT_TYPES, ...SERVER_EVENT_TYPES]) {
        assert.ok(source.includes(`type: "${eventType}"`), `${path} should declare ${eventType}`);
      }
    }
  });

  it("keeps BTW out of the removed background-session API", () => {
    for (const path of ["src/electron/types.ts", "src/ui/types.ts"]) {
      const source = readFileSync(path, "utf8");
      assert.doesNotMatch(source, /SessionActivation/);
      assert.doesNotMatch(source, /activation\?:\s*"foreground"\s*\|\s*"background"/);
      assert.doesNotMatch(source, /clientRequestId\?: string/);
    }
  });

  it("routes BTW before ordinary session creation without persistence calls", () => {
    const source = readFileSync("src/electron/ipc-handlers.ts", "utf8");
    const start = source.indexOf('if (event.type === "btw.thread.create")');
    const end = source.indexOf('if (event.type === "session.create")');

    assert.ok(start >= 0, "BTW create handler should exist");
    assert.ok(end > start, "BTW handlers should precede ordinary session creation");

    const btwBranches = source.slice(start, end);
    assert.match(btwBranches, /btwRuntimeManager\.createThread/);
    assert.match(btwBranches, /btwRuntimeManager\.send/);
    assert.match(btwBranches, /btwRuntimeManager\.closeThread/);
    assert.match(btwBranches, /btwRuntimeManager\.closeParent/);
    assert.doesNotMatch(btwBranches, /store\.(createSession|updateSession|addMessage|deleteSession)/);
  });
});
