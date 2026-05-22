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

  it("keeps the terminal tab hidden until the optional tab is opened", () => {
    const hiddenTabs = buildActivityWorkspaceTabs({
      activeTab: "preview",
      showBrowserTab: false,
      showTerminalTab: false,
    }).filter((tab) => tab.visible);
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "terminal",
      showBrowserTab: false,
      showTerminalTab: true,
    }).filter((tab) => tab.visible);

    assert.deepEqual(hiddenTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git"]);
    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "git", "terminal"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "terminal")?.active, true);
    assert.equal(shouldShowCreateTerminalTab(true), false);
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

  it("defaults the activity rail to trace in app state", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(appSource, /activityRailTabBySessionId\[activeSessionId\] \?\? "trace"/);
    assert.match(railSource, /useState<ActivityRailTab>\("trace"\)/);
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
});
