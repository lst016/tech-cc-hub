import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { describe, it } from "node:test";

const panelPath = "src/ui/components/SideConversationPanel.tsx";

function readPanelSource(): string {
  assert.equal(existsSync(panelPath), true, "SideConversationPanel should exist");
  return readFileSync(panelPath, "utf8");
}

describe("side conversation panel source contract", () => {
  it("renders private BTW threads instead of mirroring the active session", () => {
    const source = readPanelSource();

    assert.match(source, /parentSessionId: string/);
    assert.match(source, /useBtwStore/);
    assert.match(source, /threadIdsByParent\[parentSessionId\]/);
    assert.match(source, /activeThreadIdByParent\[parentSessionId\]/);
    assert.match(source, /<ChatTranscript[\s\S]{0,220}messages=\{activeThread\.messages\}/);
    assert.match(source, /aria-label="新建侧聊线程"/);
    assert.match(source, /aria-label=\{`关闭 \$\{thread\.title\}`\}/);
    assert.match(source, /clearThread\(threadId\)/);
    assert.doesNotMatch(source, /useAppStore/);
    assert.doesNotMatch(source, /state\.sessions\[/);
  });

  it("reuses PromptInput with an isolated BTW controller instead of owning a textarea", () => {
    const panelSource = readPanelSource();
    const promptInputSource = readFileSync("src/ui/components/prompt-input/PromptInput.tsx", "utf8");
    const controllerSource = readFileSync("src/ui/components/prompt-input/useBtwPromptController.ts", "utf8");

    assert.match(panelSource, /import \{ PromptInput \}/);
    assert.match(panelSource, /useBtwPromptController/);
    assert.match(panelSource, /<PromptInput[\s\S]{0,320}controller=\{controller\}[\s\S]{0,120}embedded/);
    assert.doesNotMatch(panelSource, /<textarea/);
    assert.match(promptInputSource, /controller\?: PromptInputController/);
    assert.match(promptInputSource, /controller \?\?/);
    assert.match(promptInputSource, /embedded\?: boolean/);
    assert.match(controllerSource, /type: "btw\.thread\.send"/);
    assert.match(controllerSource, /type: "btw\.thread\.stop"/);
    assert.doesNotMatch(controllerSource, /type: "session\.(continue|stop|set_model)"/);
  });

  it("routes BTW events separately and keeps both composers mounted", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(source, /event\.type\.startsWith\("btw\."\)/);
    assert.match(source, /useBtwStore\.getState\(\)\.handleServerEvent\(event\)/);
    assert.match(source, /sideConversationProps=\{activeSessionId \? \{[\s\S]{0,160}parentSessionId: activeSessionId/);
    assert.doesNotMatch(source, /!\(showActivityRail && activityRailTab === "sidechat"\)/);
    assert.match(source, /<PromptInput[\s\S]{0,220}sendEvent=\{sendEvent\}/);
  });

  it("creates the first thread on open and clears all threads when the tab closes", () => {
    const source = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(source, /type: "btw\.thread\.create"/);
    assert.match(source, /type: "btw\.parent\.close_all"/);
    assert.match(source, /clearParent\(activeSessionId\)/);
  });

  it("opens from a selection without copying selected text into a new draft", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const eventCardSource = readFileSync("src/ui/components/EventCard.tsx", "utf8");

    assert.match(appSource, /window\.addEventListener\(OPEN_SIDE_CONVERSATION_EVENT/);
    assert.match(appSource, /openSidechatWorkspace\(\)/);
    assert.doesNotMatch(appSource, /buildSideConversationSelectionDraft/);
    assert.doesNotMatch(eventCardSource, /text: selectionText/);
  });

  it("keeps transcript DOM ids isolated by key prefix", () => {
    const source = readFileSync("src/ui/components/chat/ChatTranscript.tsx", "utf8");
    const processSource = readFileSync("src/ui/components/chat/ProcessGroupCard.tsx", "utf8");

    assert.ok(source.includes('id={`${keyPrefix}-message-${entry.originalIndex}`}'));
    assert.ok(source.includes('messageIdPrefix={keyPrefix}'));
    assert.ok(processSource.includes('id={`${messageIdPrefix}-message-${entry.originalIndex}`}'));
  });

  it("mounts SideConversationPanel only for the optional sidechat rail tab", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const source = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(source, /import[\s\S]{0,120}SideConversationPanel/);
    assert.match(appSource, /showSidechatTab=\{activeHasSidechatTab\}/);
    assert.match(source, /selectedTab === "sidechat"[\s\S]{0,180}<SideConversationPanel/);
    assert.match(appSource, /onCreateSidechatTab=\{openSidechatWorkspace\}/);
    assert.match(appSource, /onCloseSidechatTab=\{activeHasSidechatTab \? closeSidechatWorkspace : undefined\}/);
  });
});
