import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readSource(path: string): string {
  return readFileSync(path, "utf8");
}

test("MCP settings exposes a clickable managed CodeGraph initializer", () => {
  const source = readSource("src/ui/components/settings/McpSettingsPage.tsx");

  assert.match(source, /function ManagedCodeGraphActions/);
  assert.match(source, /CodeGraph 本地索引/);
  assert.match(source, /codegraph:status/);
  assert.match(source, /codegraph:sync/);
  assert.match(source, /初始化/);
  assert.match(source, /增量同步/);
  assert.match(source, /\.tech\/codegraph/);
  assert.match(source, /不会创建 upstream/);
  assert.match(source, /useActiveWorkspaceRoot/);
});

test("main process exposes managed CodeGraph UI IPC channels", () => {
  const source = readSource("src/electron/main.ts");

  assert.match(source, /ipcMain\.handle\("codegraph:status"/);
  assert.match(source, /ipcMain\.handle\("codegraph:sync"/);
  assert.match(source, /handleCodeGraphUiInvoke\("codegraph:status"/);
  assert.match(source, /handleCodeGraphUiInvoke\("codegraph:sync"/);
  assert.match(source, /channel === "codegraph:status" \|\| channel === "codegraph:sync"/);
  assert.match(source, /isManagedCodeGraphInitialized/);
  assert.match(source, /request\.mode === "index" \|\| !initialized \? "index" : "sync"/);
  assert.match(source, /getManagedCodeGraphStatus/);
  assert.match(source, /syncManagedCodeGraph/);
  assert.match(source, /indexManagedCodeGraph/);
  assert.match(source, /resolveCodeGraphWorkspaceRoot/);
});
