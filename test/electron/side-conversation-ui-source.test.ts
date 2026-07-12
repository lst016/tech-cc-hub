import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const panelPath = "src/ui/components/SideConversationPanel.tsx";

function readPanelSource(): string {
  assert.equal(existsSync(panelPath), true, "SideConversationPanel should exist");
  return readFileSync(panelPath, "utf8");
}

describe("side conversation panel source contract", () => {
  it("targets every action at sideSessionId", () => {
    const source = readPanelSource();

    assert.match(source, /type: "session\.continue"[\s\S]{0,220}sessionId: sideSessionId/);
    assert.match(source, /type: "session\.stop", payload: \{ sessionId: sideSessionId \}/);
    assert.match(source, /type: "permission\.response"[\s\S]{0,180}sessionId: sideSessionId/);
    assert.doesNotMatch(source, /activeSessionId/);
  });

  it("supports accessible selection, transcript, permissions, and keyboard send", () => {
    const source = readPanelSource();

    assert.match(source, /aria-label="选择侧聊会话"/);
    assert.match(source, /aria-label="输入侧聊消息"/);
    assert.match(source, /role="region"[\s\S]{0,100}aria-label="侧聊消息"/);
    assert.match(source, /event\.key === "Enter" && !event\.shiftKey/);
    assert.match(source, /<ChatTranscript/);
    assert.match(source, /<DecisionPanel/);
  });

  it("recovers from missing targets and renders stream and scoped errors", () => {
    const source = readPanelSource();

    assert.match(source, /onSelectSession\(null\)/);
    assert.match(source, /sideSession\.error/);
    assert.match(source, /partialMessage/);
    assert.match(source, /当前没有其他会话/);
    assert.match(source, /请选择一个侧聊会话/);
  });

  it("keeps transcript DOM ids isolated by key prefix", () => {
    const source = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");
    const processSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

    assert.ok(source.includes('id={`${keyPrefix}-message-${entry.originalIndex}`}'));
    assert.ok(source.includes('messageIdPrefix={keyPrefix}'));
    assert.ok(processSource.includes('id={`${messageIdPrefix}-message-${entry.originalIndex}`}'));
  });

  it("correlates background creation without changing the primary session", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(source, /pendingSideConversationRequestsRef/);
    assert.match(source, /event\.payload\.activation === "background"/);
    assert.match(source, /pendingSideConversationRequestsRef\.current\.get\(event\.payload\.clientRequestId\)/);
    assert.match(source, /setSideSessionIdByPrimarySessionId/);
    assert.doesNotMatch(source, /setActiveSessionId\(event\.payload\.sessionId\)/);
  });

  it("opens and closes sidechat as optional per-primary-session state", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(source, /sidechatTabBySessionId/);
    assert.match(source, /sideSessionIdByPrimarySessionId/);
    assert.match(source, /setActiveSessionActivityRailTab\("sidechat"\)/);
    assert.match(source, /activityRailTab === "sidechat"/);
    assert.match(source, /data-active-session-title/);
  });

  it("mounts SideConversationPanel only for the sidechat rail tab", () => {
    const source = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(source, /import[\s\S]{0,120}SideConversationPanel/);
    assert.match(source, /showSidechatTab=\{hasSidechatTab\}/);
    assert.match(source, /selectedTab === "sidechat"[\s\S]{0,180}<SideConversationPanel/);
    assert.match(source, /onCreateSidechatTab/);
    assert.match(source, /onCloseSidechatTab/);
  });
});
