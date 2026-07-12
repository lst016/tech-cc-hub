import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SessionView } from "../../src/ui/store/useAppStore.js";
import {
  buildSideConversationTargets,
  canSendSideConversationDraft,
  createSideConversationRequestId,
} from "../../src/ui/utils/side-conversation.js";

function session(id: string, updatedAt: number, status: SessionView["status"] = "completed"): SessionView {
  return {
    id,
    title: id,
    status,
    messages: [],
    permissionRequests: [],
    hydrated: true,
    hasMoreHistory: false,
    updatedAt,
  };
}

describe("side conversation model", () => {
  it("excludes the primary conversation and sorts remaining targets by recency", () => {
    const sessions = {
      main: session("main", 30),
      older: session("older", 10),
      newer: session("newer", 20),
    };

    assert.deepEqual(
      buildSideConversationTargets(sessions, "main").map((item) => item.id),
      ["newer", "older"],
    );
  });

  it("allows only a non-empty connected idle draft with a model", () => {
    assert.equal(canSendSideConversationDraft({ draft: " hello ", connected: true, status: "completed", model: "gpt" }), true);
    assert.equal(canSendSideConversationDraft({ draft: "", connected: true, status: "completed", model: "gpt" }), false);
    assert.equal(canSendSideConversationDraft({ draft: "hello", connected: false, status: "completed", model: "gpt" }), false);
    assert.equal(canSendSideConversationDraft({ draft: "hello", connected: true, status: "running", model: "gpt" }), false);
    assert.equal(canSendSideConversationDraft({ draft: "hello", connected: true, status: "completed", model: "" }), false);
  });

  it("creates recognizable unique request ids scoped to the primary session", () => {
    const first = createSideConversationRequestId("main");
    const second = createSideConversationRequestId("main");

    assert.match(first, /^sidechat:main:/);
    assert.match(second, /^sidechat:main:/);
    assert.notEqual(first, second);
  });
});
