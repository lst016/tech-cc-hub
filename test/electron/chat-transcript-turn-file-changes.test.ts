import assert from "node:assert/strict";
import test from "node:test";

import { appendTurnFileChangeEntries } from "../../src/ui/utils/turn-file-changes.js";
import type { StreamMessage } from "../../src/ui/types.js";

function userPrompt(prompt: string): StreamMessage {
  return { type: "user_prompt", prompt } as StreamMessage;
}

function assistantText(text: string): StreamMessage {
  return {
    type: "assistant",
    message: { content: [{ type: "text", text }] },
  } as StreamMessage;
}

function writeToolUse(id: string, path: string): StreamMessage {
  return {
    type: "assistant",
    message: {
      content: [{
        type: "tool_use",
        id,
        name: "Edit",
        input: { file_path: path, old_string: "old", new_string: "new" },
      }],
    },
  } as StreamMessage;
}

function toolResult(id: string, isError = false): StreamMessage {
  return {
    type: "user",
    message: {
      content: [{ type: "tool_result", tool_use_id: id, is_error: isError, content: isError ? "failed" : "ok" }],
    },
  } as StreamMessage;
}

function messageEntry(originalIndex: number, message: StreamMessage) {
  return { type: "message" as const, key: `message-${originalIndex}`, originalIndex, message };
}

function processGroup(originalIndex: number, messages: StreamMessage[]) {
  return {
    type: "process_group" as const,
    key: `process-${originalIndex}`,
    originalIndex,
    messages: messages.map((message, offset) => ({ originalIndex: originalIndex + offset, message })),
  };
}

test("places one aggregated file-change entry after all content in a turn", () => {
  const entries = appendTurnFileChangeEntries([
    messageEntry(0, userPrompt("update two files")),
    processGroup(1, [writeToolUse("edit-1", "src/first.ts"), toolResult("edit-1")]),
    messageEntry(3, assistantText("first edit completed")),
    processGroup(4, [writeToolUse("edit-2", "src/second.ts"), toolResult("edit-2")]),
    messageEntry(6, assistantText("all edits completed")),
  ], "test");

  assert.deepEqual(entries.map((entry) => entry.type), [
    "message",
    "process_group",
    "message",
    "process_group",
    "message",
    "turn_file_changes",
  ]);
  const turnFileChanges = entries.at(-1) as { type: string; messages: Array<{ originalIndex: number }> };
  assert.equal(turnFileChanges.type, "turn_file_changes");
  assert.deepEqual(turnFileChanges.messages.map((message) => message.originalIndex), [1, 2, 4, 5]);
});

test("keeps a completed turn file-change entry before the next round separator", () => {
  const entries = appendTurnFileChangeEntries([
    { type: "separator" as const, key: "round-1", roundNumber: 1 },
    messageEntry(0, userPrompt("first turn")),
    processGroup(1, [writeToolUse("edit-1", "src/first.ts"), toolResult("edit-1")]),
    messageEntry(3, assistantText("first turn complete")),
    { type: "separator" as const, key: "round-2", roundNumber: 2 },
    messageEntry(4, userPrompt("second turn")),
    processGroup(5, [writeToolUse("edit-2", "src/second.ts"), toolResult("edit-2")]),
    messageEntry(7, assistantText("second turn complete")),
  ], "test");

  assert.deepEqual(entries.map((entry) => entry.type), [
    "separator",
    "message",
    "process_group",
    "message",
    "turn_file_changes",
    "separator",
    "message",
    "process_group",
    "message",
    "turn_file_changes",
  ]);
});

test("does not add a turn file-change entry for failed writes", () => {
  const entries = appendTurnFileChangeEntries([
    messageEntry(0, userPrompt("try an edit")),
    processGroup(1, [writeToolUse("edit-1", "src/first.ts"), toolResult("edit-1", true)]),
    messageEntry(3, assistantText("the edit failed")),
  ], "test");

  assert.equal(entries.some((entry) => (entry as { type: string }).type === "turn_file_changes"), false);
});
