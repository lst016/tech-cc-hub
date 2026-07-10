import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const mainSource = readFileSync("src/electron/main.ts", "utf8");

test("Electron main process owns workspace plugin discovery, launch, and cleanup", () => {
  assert.match(mainSource, /import \{ WorkspacePluginManager \} from "\.\/libs\/workspace-plugins\/workspace-plugin-manager\.js";/);
  assert.match(mainSource, /let workspacePluginManager: WorkspacePluginManager \| null = null;/);
  assert.match(mainSource, /function workspacePluginsRoot\(\): string/);
  assert.match(mainSource, /app\.isPackaged \? join\(process\.resourcesPath, "plugins"\) : join\(app\.getAppPath\(\), "plugins"\)/);
  assert.match(mainSource, /pluginsRoot: workspacePluginsRoot\(\)/);
  assert.match(mainSource, /dispatch: handleClientEvent/);
  assert.match(mainSource, /workspacePluginManager\?\.closeAll\(\)/);
});

test("Electron main process exposes only list, open, and close workspace plugin IPC", () => {
  assert.match(mainSource, /ipcMainHandle\("workspace-plugins:list", async \(\) =>/);
  assert.match(mainSource, /ipcMainHandle\("workspace-plugins:open", async \(_event: IpcMainInvokeEvent, input: unknown\) =>/);
  assert.match(mainSource, /ipcMainHandle\("workspace-plugins:close", async \(_event: IpcMainInvokeEvent, input: unknown\) =>/);
  assert.match(mainSource, /pluginId: \(input as \{ pluginId: string \}\)\.pluginId\.trim\(\)/);
  assert.match(mainSource, /sessionId: \(input as \{ sessionId: string \}\)\.sessionId\.trim\(\)/);
});
