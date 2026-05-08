import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resetBrowserWorkbenchAnnotationState } from "../../src/ui/utils/browser-annotation-reset.js";

describe("browser annotation reset", () => {
  it("clears page annotations and disables annotation mode for the session", async () => {
    const calls: unknown[][] = [];

    await resetBrowserWorkbenchAnnotationState({
      clearBrowserWorkbenchAnnotations: async (sessionId) => {
        calls.push(["clear", sessionId]);
      },
      setBrowserWorkbenchAnnotationMode: async (enabled, sessionId) => {
        calls.push(["mode", enabled, sessionId]);
      },
    }, "session-1");

    assert.deepEqual(calls, [
      ["clear", "session-1"],
      ["mode", false, "session-1"],
    ]);
  });

  it("still disables annotation mode if annotation cleanup fails", async () => {
    const calls: unknown[][] = [];

    await assert.rejects(
      resetBrowserWorkbenchAnnotationState({
        clearBrowserWorkbenchAnnotations: async (sessionId) => {
          calls.push(["clear", sessionId]);
          throw new Error("cleanup failed");
        },
        setBrowserWorkbenchAnnotationMode: async (enabled, sessionId) => {
          calls.push(["mode", enabled, sessionId]);
        },
      }, "session-2"),
      /cleanup failed/,
    );

    assert.deepEqual(calls, [
      ["clear", "session-2"],
      ["mode", false, "session-2"],
    ]);
  });
});
