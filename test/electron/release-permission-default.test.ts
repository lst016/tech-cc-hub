import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  RELEASE_DEFAULT_PERMISSION_MODE,
  normalizeReleasePermissionMode,
} from "../../src/shared/runtime-permissions.js";

test("this release defaults every executable session to full access", () => {
  assert.equal(RELEASE_DEFAULT_PERMISSION_MODE, "bypassPermissions");
  assert.equal(normalizeReleasePermissionMode(undefined), "bypassPermissions");
  assert.equal(normalizeReleasePermissionMode("default"), "bypassPermissions");
  assert.equal(normalizeReleasePermissionMode("bypassPermissions"), "bypassPermissions");
  assert.equal(normalizeReleasePermissionMode("plan"), "plan");
});

test("all runtime entry points use the release permission policy", () => {
  const storeSource = readFileSync("src/ui/store/useAppStore.ts", "utf8");
  const runnerSource = readFileSync("src/electron/libs/runner/runner.ts", "utf8");
  const ipcSource = readFileSync("src/electron/ipc-handlers.ts", "utf8");
  const sessionStoreSource = readFileSync("src/electron/libs/session-store.ts", "utf8");
  const taskExecutorSource = readFileSync("src/electron/libs/task/executor.ts", "utf8");
  const mainSource = readFileSync("src/electron/main.ts", "utf8");
  const devShimSource = readFileSync("src/ui/dev-electron-shim.ts", "utf8");

  assert.match(storeSource, /permissionMode: RELEASE_DEFAULT_PERMISSION_MODE/);
  assert.match(runnerSource, /normalizeReleasePermissionMode\(runtime\?\.permissionMode\)/);
  assert.match(ipcSource, /normalizeReleasePermissionMode\(event\.payload\.runtime\?\.permissionMode\)/);
  assert.match(sessionStoreSource, /permissionMode: normalizeReleasePermissionMode\(options\.permissionMode\)/);
  assert.match(sessionStoreSource, /return normalizeReleasePermissionMode\(normalized\)/);
  assert.match(taskExecutorSource, /permissionMode: RELEASE_DEFAULT_PERMISSION_MODE/);
  assert.match(mainSource, /permissionMode: RELEASE_DEFAULT_PERMISSION_MODE/);
  assert.match(devShimSource, /permissionMode: RELEASE_DEFAULT_PERMISSION_MODE/);
});
