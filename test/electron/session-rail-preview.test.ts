import test from "node:test";
import assert from "node:assert/strict";

import {
  COLLAPSED_SESSION_RAIL_LIMIT,
  SESSION_PREVIEW_FALLBACK,
  clampSessionPreviewPosition,
  extractLatestAssistantSummary,
  selectCollapsedRailSessions,
} from "../../src/ui/utils/session-rail-preview.js";

test("extractLatestAssistantSummary prefers and normalizes a live partial", () => {
  const messages = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Stored assistant reply" }],
      },
    },
  ];

  assert.equal(
    extractLatestAssistantSummary(messages, "  Live\n\n partial   reply  "),
    "Live partial reply",
  );
});

test("extractLatestAssistantSummary uses the newest assistant text blocks and normalizes whitespace", () => {
  const messages = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "text", text: "Older reply" }],
      },
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Read", input: {} }],
      },
    },
    {
      type: "system",
      message: {
        role: "system",
        content: [{ type: "text", text: "System text must be ignored" }],
      },
    },
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [
          { type: "text", text: "  Newest\nassistant  " },
          { type: "tool_use", name: "Edit", input: {} },
          { type: "text", text: " reply " },
        ],
      },
    },
  ];

  assert.equal(extractLatestAssistantSummary(messages), "Newest assistant reply");
});

test("extractLatestAssistantSummary ignores tool-only and system messages", () => {
  const messages = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [{ type: "tool_use", name: "Read", input: {} }],
      },
    },
    {
      type: "system",
      message: {
        role: "system",
        content: [{ type: "text", text: "Not an assistant reply" }],
      },
    },
  ];

  assert.equal(SESSION_PREVIEW_FALLBACK, "暂无回复摘要");
  assert.equal(extractLatestAssistantSummary(messages), SESSION_PREVIEW_FALLBACK);
});

test("extractLatestAssistantSummary rejects array-shaped text blocks", () => {
  const malformedTextBlock = Object.assign([], {
    type: "text",
    text: "Malformed array content",
  });
  const messages = [
    {
      type: "assistant",
      message: {
        role: "assistant",
        content: [malformedTextBlock],
      },
    },
  ];

  assert.equal(extractLatestAssistantSummary(messages), SESSION_PREVIEW_FALLBACK);
});

test("selectCollapsedRailSessions returns the newest non-archived sessions without mutating input", () => {
  const sessions = {
    old: Object.freeze({ id: "old", title: "Old", updatedAt: 10 }),
    archived: Object.freeze({ id: "archived", title: "Archived", updatedAt: 40, archivedAt: 41 }),
    newest: Object.freeze({ id: "newest", title: "Newest", updatedAt: 30 }),
    middle: Object.freeze({ id: "middle", title: "Middle", updatedAt: 20 }),
  };
  const originalOrder = Object.values(sessions).map((session) => session.id);

  assert.equal(COLLAPSED_SESSION_RAIL_LIMIT, 10);
  assert.deepEqual(
    selectCollapsedRailSessions(sessions, 2).map((session) => session.id),
    ["newest", "middle"],
  );
  assert.deepEqual(Object.values(sessions).map((session) => session.id), originalOrder);
  assert.deepEqual(selectCollapsedRailSessions(sessions, -1), []);
});

test("clampSessionPreviewPosition keeps a 480px card inside the viewport", () => {
  assert.deepEqual(
    clampSessionPreviewPosition(
      { right: 64, top: 900 },
      { width: 600, height: 950 },
      480,
      170,
    ),
    { left: 80, top: 768 },
  );
});

test("clampSessionPreviewPosition offsets an unclamped card above the anchor", () => {
  assert.deepEqual(
    clampSessionPreviewPosition(
      { right: 64, top: 100 },
      { width: 1200, height: 900 },
      480,
      170,
    ),
    { left: 80, top: 90 },
  );
});
