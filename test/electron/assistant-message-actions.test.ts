import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("assistant messages expose supported copy, Lark send, and fork actions without a result metrics card", () => {
  const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");
  const appSource = readFileSync("src/ui/App.tsx", "utf8");
  const eventsSource = readFileSync("src/ui/events.ts", "utf8");
  const sideConversationSource = readFileSync("src/ui/components/SideConversationPanel.tsx", "utf8");
  const handlerSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const forkSource = readFileSync("src/electron/libs/session-fork/index.ts", "utf8");
  const assistantCardStart = eventCardSource.indexOf("const AssistantTextCard");
  const assistantCardEnd = eventCardSource.indexOf("const ToolUseCard", assistantCardStart);
  const assistantCardSource = eventCardSource.slice(assistantCardStart, assistantCardEnd);
  const forkHandlerStart = appSource.indexOf("const handleForkAssistantMessage");
  const forkHandlerEnd = appSource.indexOf("window.addEventListener(FORK_ASSISTANT_MESSAGE_EVENT", forkHandlerStart);
  const forkHandlerSource = appSource.slice(forkHandlerStart, forkHandlerEnd);

  assert.doesNotMatch(eventCardSource, /本轮结果|MetricPill|SessionResult/);
  assert.match(assistantCardSource, /label="复制"/);
  assert.match(assistantCardSource, /label="发送到飞书"/);
  assert.match(assistantCardSource, /label="Fork"/);
  assert.match(assistantCardSource, /toast\.success\("已复制"\)/);
  assert.match(assistantCardSource, /toast\.error\("复制失败"/);
  assert.doesNotMatch(assistantCardSource, /label="点赞"|label="倒赞"/);
  assert.doesNotMatch(eventCardSource, /ThumbsUp|ThumbsDown/);
  assert.match(eventCardSource, /GitFork/);
  assert.match(eventsSource, /FORK_ASSISTANT_MESSAGE_EVENT/);
  assert.match(appSource, /FORK_ASSISTANT_MESSAGE_EVENT/);
  assert.match(appSource, /type: "session\.fork"/);
  assert.doesNotMatch(appSource, /pendingAssistantForkRequestsRef|assistantForkResult/);
  assert.doesNotMatch(forkHandlerSource, /setPrompt\(""\)/);
  assert.doesNotMatch(sideConversationSource, /sessionId=\{activeThread\.id\}/);
  assert.match(handlerSource, /event\.type === "session\.fork"/);
  assert.match(handlerSource, /configProfileId: result\.session\.configProfileId/);
  assert.match(forkSource, /forkSession/);
  assert.match(forkSource, /upToMessageId/);
  assert.match(forkSource, /configProfileId: sourceSession\.configProfileId/);
});
