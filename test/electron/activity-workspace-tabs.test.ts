import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  buildActivityWorkspaceTabs,
  shouldShowCreateBrowserTab,
} from "../../src/ui/utils/activity-workspace-tabs.js";

describe("activity workspace tabs", () => {
  it("keeps non-browser tabs visible when no browser tab exists", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "trace",
      showBrowserTab: false,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage"]);
    assert.equal(shouldShowCreateBrowserTab(false), true);
  });

  it("keeps preview first when the browser tab is visible", () => {
    const visibleTabs = buildActivityWorkspaceTabs({
      activeTab: "browser",
      showBrowserTab: true,
    }).filter((tab) => tab.visible);

    assert.deepEqual(visibleTabs.map((tab) => tab.id), ["preview", "trace", "usage", "browser"]);
    assert.equal(visibleTabs.find((tab) => tab.id === "browser")?.active, true);
    assert.equal(visibleTabs.find((tab) => tab.id === "preview")?.title, "文件预览");
    assert.equal(shouldShowCreateBrowserTab(true), false);
  });

  it("defaults the activity rail to preview in app state", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");

    assert.match(appSource, /activityRailTabBySessionId\[activeSessionId\] \?\? "preview"/);
    assert.match(railSource, /useState<ActivityRailTab>\("preview"\)/);
  });

  it("preserves preview and browser runtime state while switching workspace tabs", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");

    assert.doesNotMatch(appSource, /showActivityRail && workspaceView !== "browser" && \(\s*<ActivityRail/);
    assert.match(appSource, /className=\{workspaceView === "browser" \? "hidden" : "contents"\}/);
    assert.doesNotMatch(appSource, /workspaceView[\s\S]{0,180}closeBrowserWorkbench/);
  });
});
