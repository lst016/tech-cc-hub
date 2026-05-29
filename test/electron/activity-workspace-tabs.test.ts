import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildActivityWorkspaceCreateOptions,
  buildActivityWorkspaceTabs,
  shouldShowCreateBrowserTab,
  shouldShowCreateTerminalTab,
} from "../../src/ui/utils/activity-workspace-tabs.js";

describe("activity workspace tabs", () => {
  it("keeps non-browser tabs visible when no browser tab exists", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "trace",
      showBrowserTab: false,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
    assert.equal(shouldShowCreateBrowserTab(false), true);
    assert.equal(shouldShowCreateTerminalTab(false), true);
  });

  it("keeps preview first when the browser tab is visible", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "browser",
      showBrowserTab: true,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git", "browser"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "browser")?.active, true);
    assert.equal(visibleTabs.find((tab) => tab.id === "preview")?.title, "文件预览");
    assert.equal(shouldShowCreateBrowserTab(true), false);
  });

  it("keeps the terminal tab optional until the user opens it", () => {
    const defaultTabs = buildActivityWorkspaceTabs({
      activeTab: "preview",
      showBrowserTab: false,
    }).filter((tab) => tab.visible);
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "terminal",
      showBrowserTab: false,
      showTerminalTab: true,
    }).filter((tab) => tab.visible);

    assert.deepEqual(defaultTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git", "terminal"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "terminal")?.active, true);
    assert.equal(shouldShowCreateTerminalTab(true), false);
  });

  it("shows the workflow agent tab only when agent transcripts exist", () => {
    const defaultTabs = buildActivityWorkspaceTabs({
      activeTab: "usage",
      showBrowserTab: false,
    }).filter((tab) => tab.visible);
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "workflow-agent:agent-1",
      showBrowserTab: false,
      workflowAgentTabs: [{ id: "workflow-agent:agent-1", label: "Agent one", title: "Agent one" }],
    }).filter((tab) => tab.visible);

    assert.deepEqual(defaultTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git", "workflow-agent:agent-1"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "workflow-agent:agent-1")?.active, true);
  });

  it("builds a generic plus menu for hidden optional workspace tabs", () => {
    assert.deepEqual(
      buildActivityWorkspaceCreateOptions({
        canCreateBrowserTab: shouldShowCreateBrowserTab(false),
        canCreateTerminalTab: shouldShowCreateTerminalTab(false),
      }).map((option) => option.id),
      ["terminal", "browser"],
    );
    assert.deepEqual(
      buildActivityWorkspaceCreateOptions({
        canCreateBrowserTab: shouldShowCreateBrowserTab(false),
        canCreateTerminalTab: shouldShowCreateTerminalTab(true),
      }).map((option) => option.id),
      ["browser"],
    );
  });

  it("defaults the activity rail to usage in app state", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const tabsSource = readFileSync("src/ui/utils/activity-workspace-tabs.ts", "utf8");

    assert.match(tabsSource, /DEFAULT_ACTIVITY_RAIL_TAB: ActivityRailTab = "usage"/);
    assert.match(appSource, /activityRailTabBySessionId\[activeSessionId\] \?\? DEFAULT_ACTIVITY_RAIL_TAB/);
    assert.match(railSource, /useState<ActivityRailTab>\(DEFAULT_ACTIVITY_RAIL_TAB\)/);
  });

  it("keeps startup on the lightweight preview shell until preview is explicitly opened", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(appSource, /Object\.prototype\.hasOwnProperty\.call\(activityRailTabBySessionId, activeSessionId\)/);
    assert.match(appSource, /deferPreviewMount=\{!activityRailTabExplicitlySet && !pendingPreviewOpenRequest\}/);
    assert.match(railSource, /const shouldMountPreviewPane = selectedTab === "preview" && \(!deferPreviewMount \|\| Boolean\(pendingPreviewOpenRequest\)\);/);
    assert.match(railSource, /shouldMountPreviewPane \? \(/);
    assert.match(railSource, /预览已就绪/);
  });

  it("preserves preview and browser runtime state while switching workspace tabs", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");

    assert.doesNotMatch(appSource, /showActivityRail && workspaceView !== "browser" && \(\s*<ActivityRail/);
    assert.match(appSource, /className=\{workspaceView === "browser" \? "hidden" : "contents"\}/);
    assert.doesNotMatch(appSource, /workspaceView[\s\S]{0,180}closeBrowserWorkbench/);
  });

  it("opens the terminal through optional per-session tab state", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const tabsSource = readFileSync("src/ui/components/ActivityWorkspaceTabs.tsx", "utf8");

    assert.match(appSource, /terminalTabBySessionId/);
    assert.match(appSource, /terminalTabBySessionId\[activeSessionId\] === true/);
    assert.match(appSource, /setActiveSessionActivityRailTab\("terminal"\)/);
    assert.match(railSource, /showTerminalTab=\{hasTerminalTab\}/);
    assert.match(railSource, /selectedTab === "terminal"/);
    assert.match(tabsSource, /buildActivityWorkspaceCreateOptions/);
  });

  it("keeps the terminal inside the normal right rail instead of expanding fullscreen", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");

    assert.match(appSource, /const expandedActivityWorkspaceActive = gitWorkspaceActive;/);
    assert.doesNotMatch(appSource, /expandedActivityWorkspaceActive = gitWorkspaceActive \|\| terminalWorkspaceActive/);
    assert.doesNotMatch(appSource, /const terminalWorkspaceActive =/);
  });

  it("keeps the terminal workspace as a white inline PowerShell surface", () => {
    const terminalSource = readFileSync("src/ui/components/TerminalWorkspacePanel.tsx", "utf8");
    const mainSource = readFileSync("src/electron/main.ts", "utf8");

    assert.match(terminalSource, /bg-\[#fbfbfc\]/);
    assert.match(terminalSource, /return `PS \$\{path\}>`;/);
    assert.match(terminalSource, /aria-label="Terminal command"/);
    assert.doesNotMatch(terminalSource, /placeholder=/);
    assert.match(mainSource, /const shellCommand = "powershell\.exe"/);
    assert.match(mainSource, /channel === "terminal:run"[\s\S]*runTerminalCommandForRenderer\(args\[0\]\)/);
  });

  it("registers dev and watch commands as stoppable background processes", () => {
    const terminalSource = readFileSync("src/ui/components/TerminalWorkspacePanel.tsx", "utf8");
    const mainSource = readFileSync("src/electron/main.ts", "utf8");

    assert.match(terminalSource, /isLikelyLongRunningTerminalCommand/);
    assert.match(terminalSource, /"terminal:start"/);
    assert.match(terminalSource, /"terminal:list"/);
    assert.match(terminalSource, /"terminal:stop"/);
    assert.match(terminalSource, /Background processes/);
    assert.match(terminalSource, /Stop background process/);
    assert.match(mainSource, /ipcMain\.handle\("terminal:start"/);
    assert.match(mainSource, /ipcMain\.handle\("terminal:list"/);
    assert.match(mainSource, /ipcMain\.handle\("terminal:stop"/);
    assert.match(mainSource, /taskkill\.exe", \["\/PID", String\(pid\), "\/T", "\/F"\]/);
  });
});
