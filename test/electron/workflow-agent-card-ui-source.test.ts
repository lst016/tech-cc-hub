import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const cardSource = readFileSync("src/ui/components/workflow/WorkflowAgentCard.tsx", "utf8");
const panelSource = readFileSync("src/ui/components/workflow/WorkflowAgentTranscriptPanel.tsx", "utf8");
const transcriptSource = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");
const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");

test("workflow agents render as lightweight inline conversation updates", () => {
  assert.match(cardSource, /data-workflow-agent-card/);
  assert.match(cardSource, /data-workflow-agent-status=\{agent\.status\}/);
  assert.match(cardSource, /aria-current=\{selected \? "true" : undefined\}/);
  assert.match(cardSource, /Sparkles/);
  assert.match(cardSource, /ChevronRight/);
  assert.match(cardSource, /line-clamp-2/);
  assert.doesNotMatch(cardSource, /rounded-\[22px\]/);
  assert.doesNotMatch(cardSource, /shadow-\[0_12px_30px/);
});

test("workflow agent status reads accurately instead of as a badge", () => {
  assert.match(cardSource, /if \(status === "completed"\) return "已完成"/);
  assert.match(cardSource, /if \(status === "failed"\) return "失败"/);
  assert.match(cardSource, /if \(status === "stopped"\) return "已停止"/);
  assert.match(cardSource, /return "运行中"/);
  assert.doesNotMatch(cardSource, /rounded-full border px-2 py-0\.5 text-\[11px\]/);
});

test("workflow agent transcript removes the duplicate summary card", () => {
  assert.match(panelSource, /data-workflow-agent-transcript/);
  assert.match(panelSource, /Sparkles/);
  assert.doesNotMatch(panelSource, /rounded-\[18px\][\s\S]{0,120}agent\.title/);
  assert.doesNotMatch(panelSource, />Agent transcript</);
});

test("workflow agent transcript presents telemetry as one compact progress update", () => {
  assert.match(panelSource, /buildWorkflowAgentTranscriptView/);
  assert.match(panelSource, /data-workflow-agent-progress/);
  assert.match(panelSource, /messages=\{transcriptView\.messages\}/);
  assert.match(panelSource, /presentation="agent"/);
  assert.doesNotMatch(panelSource, /messages=\{agent\.transcript\}/);
});

test("agent presentation keeps assistant replies visually plain without changing main chat", () => {
  assert.match(transcriptSource, /presentation\?: "default" \| "agent"/);
  assert.match(transcriptSource, /presentation=\{presentation\}/);
  assert.match(eventCardSource, /presentation === "agent"/);
  assert.match(eventCardSource, /presentation = "default"/);
});
