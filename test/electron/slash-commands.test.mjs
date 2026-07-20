// test/electron/slash-commands.test.mjs
// Phase 3 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mergeSlashCommandItemsByPriority,
  withCompatCommandAliases,
  buildCompatFactId,
} from "../../scripts/claude-code-compat-sync-lib.mjs";

test("mergeSlashCommandItemsByPriority: higher-priority source wins on name", () => {
  const compat = [{ name: "code-review", description: "compat desc", source: "claude-code-compat" }];
  const local = [{ name: "code-review", description: "local desc", source: "local" }];
  const out = mergeSlashCommandItemsByPriority([compat, [], local, []]);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "code-review");
  assert.equal(out[0].description, "local desc");
  assert.equal(out[0].source, "local");
});

test("mergeSlashCommandItemsByPriority: lower-priority fills description when higher is empty", () => {
  const compat = [{ name: "agents", description: "compat rich desc", icon: "data:image/png;base64,AAAA", source: "claude-code-compat" }];
  const local = [{ name: "agents", source: "local" }];
  const out = mergeSlashCommandItemsByPriority([compat, [], local, []]);
  assert.equal(out.length, 1);
  assert.equal(out[0].description, "compat rich desc");
  assert.equal(out[0].icon, "data:image/png;base64,AAAA");
  assert.equal(out[0].source, "local");
});

test("mergeSlashCommandItemsByPriority: empty groups are tolerated", () => {
  const out = mergeSlashCommandItemsByPriority([[], [], []]);
  assert.deepEqual(out, []);
});

test("mergeSlashCommandItemsByPriority: items are sorted by name ascending", () => {
  const out = mergeSlashCommandItemsByPriority([
    [{ name: "zebra" }],
    [],
    [{ name: "alpha" }, { name: "mike" }],
    [],
  ]);
  assert.deepEqual(out.map((it) => it.name), ["alpha", "mike", "zebra"]);
});

test("mergeSlashCommandItemsByPriority: leading slashes are stripped", () => {
  const out = mergeSlashCommandItemsByPriority([[{ name: "/agents" }], [], [], []]);
  assert.equal(out[0].name, "agents");
});

test("withCompatCommandAliases: simplify → code-review when code-review is present", () => {
  const items = [{ name: "code-review", description: "primary", source: "claude-code-compat" }];
  const out = withCompatCommandAliases(items);
  const alias = out.find((it) => it.name === "simplify");
  assert.ok(alias, "simplify alias should be present");
  assert.equal(alias.aliasOf, "code-review");
  assert.equal(alias.source, "claude-code-compat");
});

test("withCompatCommandAliases: extra-usage → usage-credits when usage-credits is present", () => {
  const items = [{ name: "usage-credits", description: "primary", source: "claude-code-compat" }];
  const out = withCompatCommandAliases(items);
  const alias = out.find((it) => it.name === "extra-usage");
  assert.ok(alias);
  assert.equal(alias.aliasOf, "usage-credits");
});

test("withCompatCommandAliases: alias is not added when primary is missing", () => {
  const items = [{ name: "something-else", description: "x", source: "claude-code-compat" }];
  const out = withCompatCommandAliases(items);
  assert.equal(out.find((it) => it.name === "simplify"), undefined);
  assert.equal(out.find((it) => it.name === "extra-usage"), undefined);
});

test("withCompatCommandAliases: existing items are passed through unchanged", () => {
  const items = [
    { name: "code-review", description: "primary" },
    { name: "usage-credits", description: "primary" },
  ];
  const out = withCompatCommandAliases(items);
  // 2 originals + 2 aliases
  assert.equal(out.length, 4);
  const cr = out.find((it) => it.name === "code-review");
  assert.equal(cr.description, "primary");
  assert.equal(cr.aliasOf, undefined);
});

test("mergeSlashCommandItemsByPriority: aliasOf is preserved through merge", () => {
  const compat = [
    { name: "code-review", source: "claude-code-compat" },
    { name: "simplify", source: "claude-code-compat", aliasOf: "code-review" },
  ];
  const out = mergeSlashCommandItemsByPriority([compat, [], [], []]);
  assert.equal(out.length, 2);
  const alias = out.find((it) => it.name === "simplify");
  assert.equal(alias.aliasOf, "code-review");
});

test("buildCompatFactId: stable across runs for the same input", () => {
  assert.equal(buildCompatFactId("2.1.154", "Dynamic Workflows are here"), buildCompatFactId("2.1.154", "Dynamic Workflows are here"));
  assert.notEqual(buildCompatFactId("2.1.154", "Foo"), buildCompatFactId("2.1.155", "Foo"));
});
