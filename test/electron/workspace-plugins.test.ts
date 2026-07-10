import assert from "node:assert/strict";
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
