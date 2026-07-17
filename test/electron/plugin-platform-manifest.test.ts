import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { normalizePluginPackageManifests } from "../../src/shared/plugin-platform/index.js";

const codexCanvasManifest = JSON.parse(
  readFileSync("plugins/codex-canvas/.codex-plugin/plugin.json", "utf8"),
) as unknown;

const legacyCanvasManifest = JSON.parse(
  readFileSync("plugins/codex-canvas/tech-cc-hub.plugin.json", "utf8"),
) as unknown;

test("normalizes an unmodified Codex plugin package", () => {
  const result = normalizePluginPackageManifests({ codexManifest: codexCanvasManifest });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.id, "codex-canvas");
  assert.equal(result.manifest.version, "0.2.1");
  assert.equal(result.manifest.displayName, "Codex Canvas");
  assert.equal(result.manifest.runtimeClass, "native-local");
  assert.deepEqual(result.manifest.contributions, {
    skills: "./skills/",
    mcpServers: "./.mcp.json",
    surfaces: [],
    commands: [],
    hooks: [],
  });
  assert.deepEqual(result.warnings, []);
});

test("keeps Codex interface capability labels out of host capability grants", () => {
  const result = normalizePluginPackageManifests({ codexManifest: codexCanvasManifest });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.interfaceCapabilities, ["Interactive", "Read", "Write"]);
  assert.deepEqual(result.manifest.capabilities, { required: [], optional: [] });
});

test("rejects a Codex manifest without an identity or version", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { description: "missing identity" },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(result.errors.map((error) => error.code), ["MANIFEST_INVALID", "MANIFEST_INVALID"]);
  assert.deepEqual(result.errors.map((error) => error.path), ["codex.name", "codex.version"]);
});

test("rejects unsafe Codex contribution paths", () => {
  for (const skills of ["../skills", "C:\\plugins\\skills", "/opt/plugins/skills", "https://example.com/skills"]) {
    const result = normalizePluginPackageManifests({
      codexManifest: { name: "unsafe-plugin", version: "1.0.0", skills },
    });

    assert.equal(result.ok, false, `expected ${skills} to be rejected`);
    if (!result.ok) {
      assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
      assert.equal(result.errors[0]?.path, "codex.skills");
    }
  }
});

test("normalizes declared tech-cc-hub contributions and capabilities", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "agent-lab", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      runtime: { kind: "native-local" },
      contributes: {
        surfaces: [{ id: "workspace", placement: "activity-rail", entry: "./ui/index.html" }],
        commands: [{ id: "agent-lab.run", title: "Run Agent Lab" }],
        hooks: ["session.image.add"],
      },
      capabilities: {
        required: ["session.context.read", "session.child.create"],
        optional: ["session.main.control", "tools.call:*"],
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.contributions.surfaces, [
    { id: "workspace", placement: "activity-rail", entry: "./ui/index.html" },
  ]);
  assert.deepEqual(result.manifest.contributions.commands, [
    { id: "agent-lab.run", title: "Run Agent Lab" },
  ]);
  assert.deepEqual(result.manifest.contributions.hooks, ["session.image.add"]);
  assert.deepEqual(result.manifest.capabilities, {
    required: ["session.context.read", "session.child.create"],
    optional: ["session.main.control", "tools.call:*"],
  });
});

test("rejects unsafe tech-cc-hub surface entry paths", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "unsafe-surface", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      contributes: {
        surfaces: [{ id: "workspace", placement: "activity-rail", entry: "http://localhost:3000" }],
      },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "extension.contributes.surfaces[0].entry");
  }
});

test("rejects unknown required host capabilities", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "unknown-required", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      capabilities: { required: ["session.time-travel"] },
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors[0]?.code, "UNKNOWN_REQUIRED_CAPABILITY");
    assert.equal(result.errors[0]?.path, "extension.capabilities.required[0]");
  }
});

test("warns and disables unknown optional host capabilities", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "unknown-optional", version: "1.0.0" },
    extensionManifest: {
      schemaVersion: 1,
      capabilities: {
        optional: ["session.time-travel", "models.list"],
      },
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.manifest.capabilities.optional, ["models.list"]);
  assert.equal(result.warnings[0]?.code, "UNKNOWN_OPTIONAL_CAPABILITY");
  assert.equal(result.warnings[0]?.path, "extension.capabilities.optional[0]");
});

test("maps legacy workspace permissions to least-privilege host capabilities", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: codexCanvasManifest,
    legacyWorkspaceManifest: legacyCanvasManifest,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.legacyWorkspace?.id, "codex-canvas");
  assert.deepEqual(result.manifest.capabilities.required, [
    "session.context.read",
    "session.main.message.create",
    "session.main.run.start",
    "session.attachments.receive",
    "tools.call:image_generate",
  ]);
});

test("does not overgrant main-session cancellation or model switching to legacy session.send", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: codexCanvasManifest,
    legacyWorkspaceManifest: legacyCanvasManifest,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.manifest.capabilities.required.includes("session.main.run.cancel"), false);
  assert.equal(result.manifest.capabilities.required.includes("session.main.model.set"), false);
});

test("rejects a legacy workspace manifest with a different plugin identity", () => {
  const result = normalizePluginPackageManifests({
    codexManifest: { name: "expected-plugin", version: "1.0.0" },
    legacyWorkspaceManifest: {
      id: "other-plugin",
      label: "Other",
      surface: "browser-view",
      start: { command: "node", args: ["server.mjs"] },
      permissions: [],
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errors[0]?.code, "MANIFEST_INVALID");
    assert.equal(result.errors[0]?.path, "legacyWorkspace.id");
  }
});
