import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BROWSER_WORKBENCH_PARTITION,
  buildBrowserWorkbenchWebPreferences,
} from "../../src/electron/libs/browser-workbench-session.js";

describe("browser workbench session", () => {
  it("uses a persistent partition for login state", () => {
    assert.equal(BROWSER_WORKBENCH_PARTITION.startsWith("persist:"), true);
  });

  it("builds BrowserView webPreferences with the persistent partition", () => {
    assert.deepEqual(buildBrowserWorkbenchWebPreferences(), {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: BROWSER_WORKBENCH_PARTITION,
    });
  });
});
