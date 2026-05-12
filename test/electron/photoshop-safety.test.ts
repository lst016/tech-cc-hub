import assert from "node:assert/strict";
import test from "node:test";

import { preparePhotoshopControlledChange } from "../../src/electron/libs/mcp-tools/photoshop/safety.js";

const workspaceRoot = "/workspace/project";
const filePath = "/workspace/project/design/home.psd";
const operations = [{ type: "rename-layer" as const, layerId: "layer-1", nextName: "asset/logo" }];

test("creates a dry-run plan without backup metadata", () => {
  const plan = preparePhotoshopControlledChange({
    workspaceRoot,
    filePath,
    dryRun: true,
    operations,
  });

  assert.equal(plan.mode, "dry-run");
  assert.equal(plan.requiresConfirmation, true);
  assert.equal(plan.backupPath, undefined);
});

test("rejects mutations without explicit confirmation", () => {
  assert.throws(() => preparePhotoshopControlledChange({
    workspaceRoot,
    filePath,
    dryRun: false,
    confirmed: false,
    operations,
  }), /confirmed=true/);
});

test("creates backup and changelog metadata for confirmed plans", () => {
  const plan = preparePhotoshopControlledChange({
    workspaceRoot,
    filePath,
    dryRun: false,
    confirmed: true,
    now: new Date("2026-05-12T10:20:00.000Z"),
    operations,
  });

  assert.equal(plan.mode, "confirmed");
  assert.match(plan.backupPath ?? "", /\.tech-cc-hub\/photoshop\/backups\/2026-05-12T10-20-00-000Z-home\.psd$/);
  assert.equal(plan.changeLog[0]?.operation, "rename-layer");
});

test("rejects PSD files outside the workspace", () => {
  assert.throws(() => preparePhotoshopControlledChange({
    workspaceRoot,
    filePath: "/private/home.psd",
    dryRun: true,
    operations,
  }), /must be inside/);
});
