import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
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
      environment: {
        CODEX_CANVAS_GENERATED_IMAGES_ROOT: "{generatedImagesRoot}",
      },
    },
    hooks: {
      "session.image.add": {
        urlTemplate: "http://127.0.0.1:{port}/api/images?threadId={sessionId}",
      },
    },
    permissions: ["session.snapshot", "session.send", "session.images.receive"],
  }, null, 2));
  try {
    return await run(join(root, "plugins"), workspace);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function withImageHookServer<T>(run: (port: number, requests: Array<Record<string, unknown>>) => Promise<T>) {
  const requests: Array<Record<string, unknown>> = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push(JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>);
    response.writeHead(201, { "content-type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await run(address.port, requests);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
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
      generatedImagesRoot: join(pluginsRoot, "generated-images"),
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
      permissions: ["session.snapshot", "session.send", "session.images.receive"],
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
    assert.equal(spawned[0]?.env.CODEX_CANVAS_GENERATED_IMAGES_ROOT, join(pluginsRoot, "generated-images"));
    assert.equal(spawned[0]?.env.ELECTRON_RUN_AS_NODE, "1");

    await manager.closeSession("session-1");
    assert.equal(killed, true);
  });
});

test("workspace plugin manager shares historical, generated, and newly attached chat images with an open plugin", async () => {
  await withImageHookServer(async (port, requests) => {
    await withPluginRoot(async (pluginsRoot, workspace) => {
      const generatedImagesRoot = join(pluginsRoot, "generated-images");
      const historicalImagePath = join(workspace, "reference.png");
      const generatedImagePath = join(generatedImagesRoot, "session-1", "generated.png");
      const newImagePath = join(workspace, "new-upload.png");
      await mkdir(join(generatedImagesRoot, "session-1"), { recursive: true });
      await writeFile(historicalImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await writeFile(generatedImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
      await writeFile(newImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

      const manager = new WorkspacePluginManager({
        pluginsRoot,
        sessionStore: {
          getSession: (sessionId: string) => sessionId === "session-1" ? { id: sessionId, cwd: workspace } : undefined,
          getSessionHistory: () => ({
            messages: [{ attachments: [{ id: "reference", kind: "image", name: "reference.png", mimeType: "image/png", data: "file://reference", storagePath: historicalImagePath }] }],
          }),
        },
        dispatch: async () => {},
        allocatePort: async () => port,
        generatedImagesRoot,
        createBridge: async () => ({ url: "http://127.0.0.1:30001", token: "bridge-token", close: async () => {} }),
        spawnProcess: () => ({ kill: () => true }),
        waitForReady: async () => {},
      });

      await manager.open({ pluginId: "codex-canvas", sessionId: "session-1" });
      await manager.syncSessionImages({
        sessionId: "session-1",
        attachments: [{ id: "new-upload", kind: "image", name: "new-upload.png", mimeType: "image/png", data: "file://new-upload", storagePath: newImagePath }],
      });

      await manager.open({ pluginId: "codex-canvas", sessionId: "session-1" });

      assert.deepEqual(requests.map((request) => request.path), [
        historicalImagePath,
        generatedImagePath,
        newImagePath,
        historicalImagePath,
        generatedImagePath,
      ]);
      assert.ok(requests.every((request) => request.prompt === "Shared from the active chat"));
    });
  });
});
