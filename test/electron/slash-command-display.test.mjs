// test/electron/slash-command-display.test.mjs
// Phase 3 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveSlashCommandByName } from "../../scripts/claude-code-compat-sync-lib.mjs";

test("resolveSlashCommandByName: direct name match returns the entry", () => {
  const out = resolveSlashCommandByName("agents", [
    { name: "agents", description: "agents desc", source: "claude-code-compat" },
  ]);
  assert.ok(out);
  assert.equal(out.name, "agents");
  assert.equal(out.description, "agents desc");
  assert.equal(out.resolvedFrom, "agents");
});

test("resolveSlashCommandByName: alias token resolves to its primary", () => {
  const commands = [
    { name: "code-review", description: "primary desc", source: "claude-code-compat" },
    { name: "simplify", aliasOf: "code-review", source: "claude-code-compat" },
  ];
  const out = resolveSlashCommandByName("simplify", commands);
  assert.ok(out);
  assert.equal(out.name, "code-review");
  assert.equal(out.description, "primary desc");
  assert.equal(out.resolvedFrom, "simplify");
});

test("resolveSlashCommandByName: extra-usage → usage-credits (current rename)", () => {
  const commands = [
    { name: "usage-credits", description: "credits desc", source: "claude-code-compat" },
    { name: "extra-usage", aliasOf: "usage-credits", source: "claude-code-compat" },
  ];
  const out = resolveSlashCommandByName("extra-usage", commands);
  assert.ok(out);
  assert.equal(out.name, "usage-credits");
});

test("resolveSlashCommandByName: unknown name returns null", () => {
  const out = resolveSlashCommandByName("not-a-command", [{ name: "agents" }]);
  assert.equal(out, null);
});

test("resolveSlashCommandByName: empty input returns null", () => {
  assert.equal(resolveSlashCommandByName("", [{ name: "agents" }]), null);
  assert.equal(resolveSlashCommandByName(null, [{ name: "agents" }]), null);
  assert.equal(resolveSlashCommandByName("agents", null), null);
});

test("resolveSlashCommandByName: alias whose primary is missing falls back to alias entry", () => {
  const commands = [
    { name: "simplify", aliasOf: "code-review", description: "fallback desc" },
  ];
  const out = resolveSlashCommandByName("simplify", commands);
  assert.ok(out);
  assert.equal(out.name, "simplify");
  assert.equal(out.description, "fallback desc");
});

test("resolveSlashCommandByName: primary name typed returns primary even when alias points to it", () => {
  const commands = [
    { name: "code-review", description: "primary" },
    { name: "simplify", aliasOf: "code-review" },
  ];
  const out = resolveSlashCommandByName("code-review", commands);
  assert.ok(out);
  assert.equal(out.name, "code-review");
});

test("resolveSlashCommandByName: leading slash is stripped", () => {
  const out = resolveSlashCommandByName("/agents", [{ name: "agents" }]);
  assert.ok(out);
  assert.equal(out.name, "agents");
});

test("resolveSlashCommandByName: case-insensitive lookup", () => {
  const out = resolveSlashCommandByName("Agents", [{ name: "agents" }]);
  assert.ok(out);
  assert.equal(out.name, "agents");
});
