import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  closeManagedCodeGraph,
  ensureManagedCodeGraphSynced,
  openManagedCodeGraph,
  resolveManagedCodeGraphPaths,
  searchManagedCodeGraph,
  syncManagedCodeGraph,
} from "../../src/electron/libs/codegraph/managed-codegraph.js";

test("managed CodeGraph stores its DB under .tech/codegraph", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-"));
  writeFileSync(join(workspaceRoot, "service.ts"), "export function loadUser() { return 1; }\n", "utf8");

  try {
    const graph = await openManagedCodeGraph(workspaceRoot, { index: true });
    const paths = resolveManagedCodeGraphPaths(workspaceRoot);

    assert.equal(existsSync(paths.databasePath), true);
    assert.equal(existsSync(paths.upstreamCodegraphRoot), false);
    assert.equal(graph.getStats().fileCount, 1);

    const config = JSON.parse(readFileSync(paths.configPath, "utf8")) as { exclude?: string[] };
    assert.ok(config.exclude?.includes("**/.tech/codegraph/**"));
    assert.ok(config.exclude?.includes("**/.codegraph/**"));
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("managed CodeGraph search does not auto-initialize missing indexes", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-auto-"));
  writeFileSync(join(workspaceRoot, "gamma.ts"), "export function gammaSearchTarget() { return 3; }\n", "utf8");

  try {
    const paths = resolveManagedCodeGraphPaths(workspaceRoot);
    assert.equal(existsSync(paths.databasePath), false);

    const results = await searchManagedCodeGraph(workspaceRoot, "gammaSearchTarget", { limit: 5 });

    assert.equal(existsSync(paths.databasePath), false);
    assert.deepEqual(results, []);
    assert.equal(existsSync(paths.upstreamCodegraphRoot), false);
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("managed CodeGraph sync skips missing indexes instead of full indexing implicitly", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-sync-skip-"));
  writeFileSync(join(workspaceRoot, "epsilon.ts"), "export function epsilonSearchTarget() { return 5; }\n", "utf8");

  try {
    const paths = resolveManagedCodeGraphPaths(workspaceRoot);
    assert.equal(existsSync(paths.databasePath), false);

    const sync = await syncManagedCodeGraph(workspaceRoot);

    assert.equal("skipped" in sync && sync.skipped, true);
    assert.equal(existsSync(paths.databasePath), false);
    assert.equal(existsSync(paths.upstreamCodegraphRoot), false);
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("managed CodeGraph ensure sync indexes a missing workspace for autosync", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-ensure-"));
  writeFileSync(join(workspaceRoot, "zeta.ts"), "export function zetaSearchTarget() { return 6; }\n", "utf8");

  try {
    const paths = resolveManagedCodeGraphPaths(workspaceRoot);
    assert.equal(existsSync(paths.databasePath), false);

    const ensured = await ensureManagedCodeGraphSynced(workspaceRoot);
    const results = await searchManagedCodeGraph(workspaceRoot, "zetaSearchTarget", { limit: 5 });

    assert.equal(ensured.mode, "index");
    assert.equal(existsSync(paths.databasePath), true);
    assert.ok(results.some((result) => result.node.name === "zetaSearchTarget"));
    assert.equal(existsSync(paths.upstreamCodegraphRoot), false);
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("managed CodeGraph sync incrementally picks up changed files", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-sync-"));
  writeFileSync(join(workspaceRoot, "alpha.ts"), "export function alpha() { return 1; }\n", "utf8");

  try {
    await openManagedCodeGraph(workspaceRoot, { index: true });
    writeFileSync(join(workspaceRoot, "beta.ts"), "export function beta() { return alpha; }\n", "utf8");

    const sync = await syncManagedCodeGraph(workspaceRoot);
    const results = await searchManagedCodeGraph(workspaceRoot, "beta", { limit: 5 });

    assert.ok(sync.filesAdded >= 1);
    assert.ok(results.some((result) => result.node.name === "beta"));
    assert.equal(existsSync(resolveManagedCodeGraphPaths(workspaceRoot).upstreamCodegraphRoot), false);
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test("managed CodeGraph search does not sync existing indexes before retrieval", async () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-codegraph-retrieval-sync-"));
  writeFileSync(join(workspaceRoot, "alpha.ts"), "export function alpha() { return 1; }\n", "utf8");

  try {
    await openManagedCodeGraph(workspaceRoot, { index: true });
    writeFileSync(join(workspaceRoot, "delta.ts"), "export function deltaSearchTarget() { return alpha(); }\n", "utf8");

    const results = await searchManagedCodeGraph(workspaceRoot, "deltaSearchTarget", { limit: 5 });

    assert.equal(results.some((result) => result.node.name === "deltaSearchTarget"), false);
    assert.equal(existsSync(resolveManagedCodeGraphPaths(workspaceRoot).upstreamCodegraphRoot), false);
  } finally {
    closeManagedCodeGraph(workspaceRoot);
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});
