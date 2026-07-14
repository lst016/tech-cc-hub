import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  BROWSER_WORKBENCH_OCCLUDER_SELECTOR,
  hasRenderableBrowserWorkbenchBounds,
  hasVisibleBrowserWorkbenchOccluder,
  shouldAttachBrowserWorkbench,
} from "../../src/ui/utils/browser-workbench-visibility.js";

describe("browser workbench visibility", () => {
  it("detaches BrowserView while an app modal occludes the workbench", () => {
    assert.equal(
      shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: true, occluded: true }),
      false,
    );
  });

  it("keeps BrowserView attached only when active, tabbed, and unobstructed", () => {
    assert.equal(shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: true, occluded: false }), true);
    assert.equal(shouldAttachBrowserWorkbench({ active: false, hasBrowserTab: true, occluded: false }), false);
    assert.equal(shouldAttachBrowserWorkbench({ active: true, hasBrowserTab: false, occluded: false }), false);
  });

  it("ignores transient zero-sized active browser surfaces", () => {
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 0, height: 480 }), false);
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 640, height: 0 }), false);
    assert.equal(hasRenderableBrowserWorkbenchBounds({ width: 640, height: 480 }), true);
  });

  it("detects semantic dialogs and full-screen renderer overlays as BrowserView occluders", () => {
    const candidates = [{ id: "hidden-dialog" }, { id: "image-lightbox" }] as unknown as Element[];
    let queriedSelector = "";
    const root = {
      querySelectorAll(selector: string) {
        queriedSelector = selector;
        return candidates;
      },
    } as unknown as Pick<ParentNode, "querySelectorAll">;

    assert.equal(
      hasVisibleBrowserWorkbenchOccluder(root, (element) => element === candidates[1]),
      true,
    );
    assert.equal(hasVisibleBrowserWorkbenchOccluder(root, () => false), false);
    assert.equal(queriedSelector, BROWSER_WORKBENCH_OCCLUDER_SELECTOR);
    assert.match(queriedSelector, /\[aria-modal="true"\]/);
    assert.match(queriedSelector, /\[role="dialog"\]/);
    assert.match(queriedSelector, /dialog\[open\]/);
    assert.match(queriedSelector, /\[class~="fixed"\]\[class~="inset-0"\]/);
  });

  it("hides every BrowserView when app-level chrome occludes the workbench", () => {
    const appSource = readFileSync("src/ui/App.tsx", "utf8");
    const mainSource = readFileSync("src/electron/main.ts", "utf8");
    const preloadSource = readFileSync("src/electron/preload.cts", "utf8");
    const typesSource = readFileSync("types.d.ts", "utf8");

    assert.match(appSource, /observeBrowserWorkbenchOcclusion\(setBrowserWorkbenchDomOccluded\)/);
    assert.match(appSource, /showSettingsModal \|\| showStartModal \|\| browserWorkbenchDomOccluded/);
    assert.match(appSource, /if \(!browserWorkbenchOccluded \|\| typeof window\.electron\.hideAllBrowserWorkbenches !== "function"\) return/);
    assert.match(appSource, /void window\.electron\.hideAllBrowserWorkbenches\(\)/);
    assert.match(appSource, /\}, \[browserWorkbenchOccluded\]\)/);
    assert.match(mainSource, /function hideAllBrowserWorkbenches\(\): BrowserWorkbenchState\[\]/);
    assert.match(mainSource, /for \(const manager of browserWorkbenches\.values\(\)\)[\s\S]{0,140}manager\.setBounds\(hiddenBounds\)/);
    assert.match(mainSource, /for \(const view of mainWindow\.getBrowserViews\(\)\)[\s\S]{0,80}mainWindow\.removeBrowserView\(view\)/);
    assert.match(mainSource, /ipcMainHandle\("browser-hide-all"/);
    assert.match(preloadSource, /hideAllBrowserWorkbenches: \(\) =>\s*ipcInvoke\("browser-hide-all"\)/);
    assert.match(typesSource, /hideAllBrowserWorkbenches: \(\) => Promise<BrowserWorkbenchState\[\]>/);
  });
});
