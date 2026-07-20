import test from "node:test";
import assert from "node:assert/strict";

import {
  getClaudeConversationResetId,
  getClaudeRetractionIds,
  isClaudeConversationReset,
  removeRetractedClaudeMessages,
} from "../../src/shared/claude-agent-sdk-messages.js";

test("model refusal fallback retracts normalized messages idempotently", () => {
  const fallback = {
    type: "system",
    subtype: "model_refusal_fallback",
    retracted_message_uuids: ["assistant-refused", "tool-result-refused", "assistant-refused", 42],
  };
  const retractedIds = getClaudeRetractionIds(fallback);
  const remaining = removeRetractedClaudeMessages([
    { type: "assistant", uuid: "assistant-refused" },
    { type: "user", historyId: "tool-result-refused", uuid: "other-id" },
    { type: "assistant", uuid: "assistant-kept" },
  ], retractedIds);

  assert.deepEqual(retractedIds, ["assistant-refused", "tool-result-refused"]);
  assert.deepEqual(remaining, [{ type: "assistant", uuid: "assistant-kept" }]);
});

test("non-fallback messages never retract transcript entries", () => {
  assert.deepEqual(getClaudeRetractionIds({
    type: "system",
    subtype: "model_refusal_no_fallback",
    retracted_message_uuids: ["message-1"],
  }), []);
  assert.equal(isClaudeConversationReset({ type: "conversation_reset" }), true);
  assert.equal(isClaudeConversationReset({ type: "system", subtype: "init" }), false);
  assert.equal(getClaudeConversationResetId({
    type: "conversation_reset",
    new_conversation_id: "fresh-conversation",
  }), "fresh-conversation");
});

test("assistant supersedes evicts refusal frames before the audit notice arrives", () => {
  const replacement = {
    type: "assistant",
    uuid: "assistant-replacement",
    supersedes: ["assistant-refused", "tool-result-refused", "assistant-refused"],
  };
  const afterReplacement = removeRetractedClaudeMessages([
    { type: "assistant", uuid: "assistant-refused" },
    { type: "user", uuid: "tool-result-refused" },
    { type: "assistant", uuid: "assistant-kept" },
  ], getClaudeRetractionIds(replacement));

  assert.deepEqual(afterReplacement, [{ type: "assistant", uuid: "assistant-kept" }]);
  assert.deepEqual(getClaudeRetractionIds(replacement), ["assistant-refused", "tool-result-refused"]);

  const auditNotice = {
    type: "system",
    subtype: "model_refusal_fallback",
    retracted_message_uuids: ["assistant-refused", "tool-result-refused"],
  };
  assert.deepEqual(
    removeRetractedClaudeMessages(afterReplacement, getClaudeRetractionIds(auditNotice)),
    afterReplacement,
  );
});
