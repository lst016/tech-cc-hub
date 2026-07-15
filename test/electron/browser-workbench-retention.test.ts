import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_RETAINED_BROWSER_WORKBENCHES,
  selectBrowserWorkbenchEvictionIds,
} from "../../src/electron/libs/browser-workbench/browser-workbench-retention.js";

test("browser workbench retention evicts oldest live views and protects the active session", () => {
  assert.equal(MAX_RETAINED_BROWSER_WORKBENCHES, 2);
  assert.deepEqual(selectBrowserWorkbenchEvictionIds([
    { sessionId: "oldest", hasLiveView: true },
    { sessionId: "previous", hasLiveView: true },
    { sessionId: "active", hasLiveView: true },
  ], "active"), ["oldest"]);
});

test("browser workbench retention ignores managers without a live renderer", () => {
  assert.deepEqual(selectBrowserWorkbenchEvictionIds([
    { sessionId: "closed", hasLiveView: false },
    { sessionId: "previous", hasLiveView: true },
    { sessionId: "active", hasLiveView: true },
  ], "active"), []);
});
