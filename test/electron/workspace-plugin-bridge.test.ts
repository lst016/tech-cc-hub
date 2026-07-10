import assert from "node:assert/strict";
import { mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import test from "node:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startWorkspacePluginBridge } from "../../src/electron/libs/workspace-plugins/workspace-plugin-bridge.js";

async function requestJson(url: string, path: string, options: { token?: string; body?: unknown } = {}) {
  const response = await fetch(`${url}${path}`, {
    method: options.body ? "POST" : "GET",
    headers: {
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  return { status: response.status, body: await response.json() as Record<string, unknown> };
}

async function withWorkspace<T>(run: (workspace: string) => Promise<T>) {
  const workspace = await mkdtemp(join(tmpdir(), "workspace-plugin-bridge-"));
  try {
    return await run(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

test("workspace plugin bridge rejects a request without the launch bearer token", async () => {
  const bridge = await startWorkspacePluginBridge({
    sessionId: "session-1",
    token: "launch-token",
    sessionStore: { getSession: () => ({ id: "session-1", cwd: process.cwd(), title: "Canvas", status: "idle" }) },
    dispatch: async () => {},
  });

  try {
    const response = await requestJson(bridge.url, "/v1/session/snapshot");
    assert.equal(response.status, 401);
    assert.equal(response.body.error, "Unauthorized");
  } finally {
    await bridge.close();
  }
});

test("workspace plugin bridge converts a selected workspace PNG into session.continue", async () => {
  await withWorkspace(async (workspace) => {
    const imagePath = join(workspace, "canvas-selection.png");
    await writeFile(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const resolvedImagePath = await realpath(imagePath);
    const dispatched: unknown[] = [];
    const bridge = await startWorkspacePluginBridge({
      sessionId: "session-1",
      token: "launch-token",
      sessionStore: {
        getSession: (sessionId: string) => sessionId === "session-1"
          ? { id: "session-1", cwd: workspace, title: "Canvas", status: "idle", model: "gpt-5.5", lastPrompt: "previous" }
          : undefined,
      },
      dispatch: async (event: unknown) => { dispatched.push(event); },
    });

    try {
      const response = await requestJson(bridge.url, "/v1/session/send", {
        token: bridge.token,
        body: {
          sessionId: "session-1",
          prompt: "把备注排成两行",
          imagePath,
          source: { pluginId: "codex-canvas", action: "send-to-chat" },
        },
      });
      assert.equal(response.status, 202);
      assert.equal(response.body.status, "accepted");
      assert.deepEqual(dispatched, [{
        type: "session.continue",
        payload: {
          sessionId: "session-1",
          prompt: "[来自 Codex-Canvas：send-to-chat]\n把备注排成两行",
          attachments: [{
            id: "workspace-plugin:codex-canvas:canvas-selection.png",
            kind: "image",
            name: "canvas-selection.png",
            mimeType: "image/png",
            data: "data:image/png;base64,iVBORw==",
            runtimeData: "data:image/png;base64,iVBORw==",
            size: 4,
            storagePath: resolvedImagePath,
          }],
        },
      }]);
    } finally {
      await bridge.close();
    }
  });
});
