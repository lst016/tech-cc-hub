import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQueuedDisplayPrompt,
  buildQueuedPrompt,
  findLatestQueuedForkPoint,
  type QueuedMessageDraft,
} from "../../src/ui/components/prompt-input/prompt-queue.js";
import { getCollapsibleTextPreview } from "../../src/ui/utils/collapsible-text-preview.js";

const browserAnnotation = `<browser_annotations>
This internal browser context should remain available to the runner.
{"type":"browser_annotations","count":1,"items":[{"comment":"tighten the preview"}]}
</browser_annotations>`;

function queuedMessage(id: string, prompt: string): QueuedMessageDraft {
  return {
    id,
    prompt,
    agentPrompt: prompt,
    attachments: [],
    createdAt: 1,
  };
}

test("queued display prompt omits structured context while runner prompt keeps it", () => {
  const queue = [queuedMessage("one", `国际化\n\n${browserAnnotation}`)];

  assert.equal(buildQueuedDisplayPrompt(queue), "国际化");
  assert.match(buildQueuedPrompt(queue), /<browser_annotations>/);
});

test("combined queued display stays compact when every item carries structured context", () => {
  const queue = [
    queuedMessage("one", `国际化\n\n${browserAnnotation}`),
    queuedMessage("two", `缩短预览\n\n${browserAnnotation}`),
  ];

  const displayPrompt = buildQueuedDisplayPrompt(queue);
  assert.equal(displayPrompt, "Queued message 1:\n国际化\n\n---\n\nQueued message 2:\n缩短预览");
  assert.doesNotMatch(displayPrompt, /browser_annotations|internal browser context/);
});

test("queued fork starts from the last completed top-level assistant turn", () => {
  const messages = [
    { type: "user_prompt", prompt: "first" },
    { type: "assistant", uuid: "assistant-first", parent_tool_use_id: null },
    { type: "assistant", uuid: "assistant-subagent", parent_tool_use_id: "tool-1" },
    { type: "user_prompt", prompt: "currently running" },
    { type: "assistant", uuid: "assistant-streaming", parent_tool_use_id: null },
  ];

  assert.equal(findLatestQueuedForkPoint(messages), "assistant-first");
});

test("queued fork is unavailable before the first completed assistant turn", () => {
  assert.equal(findLatestQueuedForkPoint([
    { type: "user_prompt", prompt: "currently running" },
    { type: "assistant", uuid: "assistant-streaming", parent_tool_use_id: null },
  ]), null);
});

test("user message cards use a compact collapsed preview", () => {
  const source = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const userMessageCard = source.slice(
    source.indexOf("const UserMessageCard"),
    source.indexOf("const AssistantTextCard"),
  );

  assert.match(userMessageCard, /<CollapsibleText[\s\S]*?maxLines=\{4\}/);
  assert.match(userMessageCard, /<CollapsibleText[\s\S]*?maxChars=\{180\}/);
  assert.doesNotMatch(userMessageCard, /<CollapsibleText[\s\S]*?maxLines=\{24\}/);
});

test("collapsed text preview caps a long wrapped line by characters", () => {
  const text = "这是一段没有手动换行但会在窄气泡中自动换行的长消息。".repeat(20);
  const preview = getCollapsibleTextPreview(text, {
    expanded: false,
    maxLines: 4,
    maxChars: 180,
  });

  assert.equal(preview.hasMore, true);
  assert.equal(preview.visibleText.length, 180);
  assert.equal(preview.remainingLines, 0);
  assert.equal(preview.expandLabel, "展开全文");
});
