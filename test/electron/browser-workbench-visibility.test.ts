import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { shouldAttachBrowserWorkbench } from "../../src/ui/utils/browser-workbench-visibility.js";

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
});
