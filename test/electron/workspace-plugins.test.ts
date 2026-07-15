import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizeWorkspacePluginManifest } from "../../src/shared/workspace-plugins.js";

test("normalizes a local browser-view workspace plugin manifest", () => {
  assert.deepEqual(normalizeWorkspacePluginManifest({
    id: "codex-canvas",
    label: "Canvas",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["bin/codex-canvas.mjs", "start"],
    },
    permissions: ["session.snapshot", "session.send"],
  }), {
    id: "codex-canvas",
    label: "Canvas",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["bin/codex-canvas.mjs", "start"],
    },
    permissions: ["session.snapshot", "session.send"],
  });
});

test("rejects undeclared permissions and unsafe workspace plugin identifiers", () => {
  assert.equal(normalizeWorkspacePluginManifest({ id: "../bad", permissions: [] }), null);
  assert.equal(normalizeWorkspacePluginManifest({
    id: "canvas",
    label: "Canvas",
    surface: "browser-view",
    start: { command: "node", args: [] },
    permissions: ["session.stop"],
  }), null);
});

test("preserves a local URL template for a launchable workspace plugin", () => {
  assert.deepEqual(normalizeWorkspacePluginManifest({
    id: "codex-canvas",
    label: "Canvas",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["bin/codex-canvas.mjs", "start", "--port", "{port}"],
      urlTemplate: "http://127.0.0.1:{port}/?threadId={sessionId}",
    },
    permissions: ["session.snapshot", "session.send"],
  }), {
    id: "codex-canvas",
    label: "Canvas",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["bin/codex-canvas.mjs", "start", "--port", "{port}"],
      urlTemplate: "http://127.0.0.1:{port}/?threadId={sessionId}",
    },
    permissions: ["session.snapshot", "session.send"],
  });
});

test("ships Codex-Canvas as the first local browser-view plugin", () => {
  const manifest = JSON.parse(readFileSync("plugins/codex-canvas/tech-cc-hub.plugin.json", "utf8"));
  assert.deepEqual(normalizeWorkspacePluginManifest(manifest), {
    id: "codex-canvas",
    label: "画布",
    surface: "browser-view",
    start: {
      command: "node",
      args: ["dist/codex-canvas.mjs", "start", "--host", "127.0.0.1", "--port", "{port}", "--project", "{workspace}", "--thread-id", "{sessionId}"],
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
    permissions: ["session.snapshot", "session.send", "session.images.receive", "session.images.generate"],
  });
});
