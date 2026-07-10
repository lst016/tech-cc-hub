import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WorkspacePluginManager } from "../../src/electron/libs/workspace-plugins/workspace-plugin-manager.js";

async function withPluginRoot<T>(run: (root: string, workspace: string) => Promise<T>) {
  const root = await mkdtemp(join(tmpdir(), "workspace-plugin-manager-"));
  const workspace = join(root, "workspace");
  await mkdir(join(root, "plugins", "codex-canvas"), { recursive: true });
  await mkdir(workspace, { recursive: true });
  await writeFile(join(root, "plugins", "codex-canvas", "tech-cc-hub.plugin.json"), JSON.stringify({
    id: "codex-canvas",
    label: "Canvas",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["bin/codex-canvas.mjs", "start", "--port", "{port}", "--project", "{workspace}", "--thread-id", "{sessionId}"],
      urlTemplate: "http://127.0.0.1:{port}/?threadId={sessionId}",
    },
    permissions: ["session.snapshot", "session.send"],
  }, null, 2));
  try {
    return await run(join(root, "plugins"), workspace);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("workspace plugin manager discovers manifests and starts a session-scoped launch", async () => {
  await withPluginRoot(async (pluginsRoot, workspace) => {
    const spawned: Array<{ command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }> = [];
    const readyUrls: string[] = [];
    let killed = false;
    const manager = new WorkspacePluginManager({
      pluginsRoot,
      sessionStore: { getSession: (sessionId: string) => sessionId === "session-1" ? { id: sessionId, cwd: workspace } : undefined },
      dispatch: async () => {},
      allocatePort: async () => 45678,
      createBridge: async () => ({ url: "http://127.0.0.1:30001", token: "bridge-token", close: async () => {} }),
      spawnProcess: (input: { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }) => {
        spawned.push(input);
        return { kill: () => { killed = true; return true; } };
      },
      waitForReady: async (url: string) => { readyUrls.push(url); },
    });

    assert.deepEqual(await manager.list(), [{
      id: "codex-canvas",
      label: "Canvas",
      surface: "browser-view",
      permissions: ["session.snapshot", "session.send"],
    }]);

    assert.deepEqual(await manager.open({ pluginId: "codex-canvas", sessionId: "session-1" }), {
      pluginId: "codex-canvas",
      sessionId: "session-1",
      url: "http://127.0.0.1:45678/?threadId=session-1",
    });
    assert.deepEqual(readyUrls, ["http://127.0.0.1:45678/?threadId=session-1"]);
    assert.equal(spawned.length, 1);
    assert.equal(spawned[0]?.command, process.execPath);
    assert.deepEqual(spawned[0]?.args, ["bin/codex-canvas.mjs", "start", "--port", "45678", "--project", workspace, "--thread-id", "session-1"]);
    assert.equal(spawned[0]?.cwd, join(pluginsRoot, "codex-canvas"));
    assert.equal(spawned[0]?.env.TECH_CC_HUB_BRIDGE_URL, "http://127.0.0.1:30001");
    assert.equal(spawned[0]?.env.TECH_CC_HUB_BRIDGE_TOKEN, "bridge-token");
    assert.equal(spawned[0]?.env.TECH_CC_HUB_SESSION_ID, "session-1");
    assert.equal(spawned[0]?.env.TECH_CC_HUB_WORKSPACE, workspace);

    await manager.closeSession("session-1");
    assert.equal(killed, true);
  });
});
