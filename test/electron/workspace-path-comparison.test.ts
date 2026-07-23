import assert from "node:assert/strict";
import test from "node:test";

import { getWorkspacePathComparisonKey } from "../../src/shared/linked-workspaces.js";

test("workspace comparison treats Windows slash variants as the same path", () => {
  assert.equal(
    getWorkspacePathComparisonKey("D:\\tool\\tech-cc-hub"),
    getWorkspacePathComparisonKey("D:/tool/tech-cc-hub"),
  );
  assert.equal(
    getWorkspacePathComparisonKey("D:\\TOOL\\TECH-CC-HUB\\"),
    getWorkspacePathComparisonKey("d:/tool/tech-cc-hub"),
  );
});

test("workspace comparison preserves case sensitivity for POSIX paths", () => {
  assert.notEqual(
    getWorkspacePathComparisonKey("/workspace/Tech-CC-Hub"),
    getWorkspacePathComparisonKey("/workspace/tech-cc-hub"),
  );
});
