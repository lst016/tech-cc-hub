import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("workspace plugin view pane", () => {
  it("opens an installed plugin in an isolated BrowserView and hides it when the tab is left", () => {
    const paneSource = readFileSync("src/ui/components/workspace-plugins/WorkspacePluginViewPane.tsx", "utf8");
    const railSource = readFileSync("src/ui/components/ActivityRail.tsx", "utf8");
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");

    assert.match(paneSource, /workspacePlugins\.open\(\{ pluginId: plugin\.id, sessionId \}\)/);
    assert.match(paneSource, /openBrowserWorkbench\(launch\.url, surfaceId\)/);
    assert.match(paneSource, /setBrowserWorkbenchBounds\(\{ x: 0, y: 0, width: 0, height: 0 \}, surfaceId\)/);
    assert.match(paneSource, /new ResizeObserver\(syncBounds\)/);
    assert.match(railSource, /workspacePlugins = \[\]/);
    assert.match(railSource, /workspacePlugins\.find\(\(plugin\) => plugin\.id === getWorkspacePluginIdFromTab/);
    assert.match(railSource, /<WorkspacePluginViewPane/);
    assert.match(appSource, /window\.electron\.workspacePlugins\.list\(\)/);
    assert.match(appSource, /workspacePlugins=\{visibleWorkspacePlugins\}/);
    assert.match(appSource, /closedWorkspacePluginIdsBySessionId/);
    assert.match(appSource, /closeWorkspacePluginTab/);
    assert.match(appSource, /openWorkspacePluginTab/);
    assert.match(appSource, /hiddenWorkspacePlugins=\{hiddenWorkspacePlugins\}/);
    assert.match(appSource, /window\.addEventListener\(OPEN_WORKSPACE_PLUGIN_EVENT, handleOpenWorkspacePlugin\)/);
    assert.match(appSource, /openWorkspacePluginTab\(getWorkspacePluginTabId\(pluginId\)\)/);
    assert.match(railSource, /onCloseWorkspacePluginTab/);
    assert.match(railSource, /onOpenWorkspacePluginTab/);
    assert.match(preloadSource, /workspacePlugins: \{/);
    assert.match(preloadSource, /close: \(input: \{ pluginId: string; sessionId: string \}\)/);
  });
});
