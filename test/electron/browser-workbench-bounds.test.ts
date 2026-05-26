import assert from "node:assert/strict";
import test from "node:test";

import {
  sanitizeBrowserWorkbenchBounds,
  shouldDetachBrowserWorkbenchForBounds,
} from "../../src/electron/libs/browser-workbench/browser-workbench-bounds.js";

test("sanitizes browser workbench bounds before applying them to Electron", () => {
  assert.deepEqual(
    sanitizeBrowserWorkbenchBounds({ x: -4.4, y: 12.6, width: 640.4, height: -1 }),
    { x: 0, y: 13, width: 640, height: 0 },
  );
});

test("zero-sized bounds detach the BrowserView instead of representing a renderable surface", () => {
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 0, height: 480 }), true);
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 640, height: 0 }), true);
  assert.equal(shouldDetachBrowserWorkbenchForBounds({ width: 640, height: 480 }), false);
});
