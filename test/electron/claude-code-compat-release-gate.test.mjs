// test/electron/claude-code-compat-release-gate.test.mjs
// Phase 10 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const SCRIPT = "scripts/check-claude-code-compat.mjs";

function runCheck(extraArgs = []) {
  try {
    const stdout = execFileSync("node", [SCRIPT, "--json", ...extraArgs], { encoding: "utf8" });
    return { ok: true, payload: JSON.parse(stdout) };
  } catch (err) {
    return { ok: false, error: err, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

test("release gate: current registry passes basic checks", () => {
  const result = runCheck();
  assert.equal(result.ok, true, `gate should not block the current registry; stderr: ${result.stderr}`);
  assert.ok(result.payload.sourceVersion);
  assert.match(result.payload.sourceVersion, /^\d+\.\d+\.\d+$/);
});

test("release gate: sourceUrl is set", () => {
  const result = runCheck();
  assert.ok(result.ok);
  assert.ok(result.payload.sourceUrl);
  assert.match(result.payload.sourceUrl, /^https?:\/\//);
});

test("release gate: generatedAt parses as ISO date", () => {
  const result = runCheck();
  assert.ok(result.ok);
  assert.ok(result.payload.generatedAt);
  assert.doesNotThrow(() => new Date(result.payload.generatedAt).toISOString());
});

test("release gate: facts sidecar is present and has the expected count", () => {
  const result = runCheck();
  assert.ok(result.ok);
  assert.ok(result.payload.factsCount >= 5, "expected at least 5 facts from a real sync");
});

test("release gate: findings array exists (even if empty)", () => {
  const result = runCheck();
  assert.ok(result.ok);
  assert.ok(Array.isArray(result.payload.findings));
});

test("release gate: severity levels in findings are recognized", () => {
  const result = runCheck();
  assert.ok(result.ok);
  for (const f of result.payload.findings) {
    assert.ok(["blocker", "warning", "info"].includes(f.severity), `unknown severity ${f.severity}`);
  }
});
