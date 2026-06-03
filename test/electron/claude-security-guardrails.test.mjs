// test/electron/claude-security-guardrails.test.mjs
// Phase 6 of the Claude Code 2.1.161 compatibility workflow.

import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const mod = await import(pathToFileURL("dist-electron/electron/libs/compat-security-guardrails.js").href);

test("looksLikeSecretKey: matches common secret key names", () => {
  assert.equal(mod.looksLikeSecretKey("ANTHROPIC_API_KEY"), true);
  assert.equal(mod.looksLikeSecretKey("api_key"), true);
  assert.equal(mod.looksLikeSecretKey("password"), true);
  assert.equal(mod.looksLikeSecretKey("token"), true);
  assert.equal(mod.looksLikeSecretKey("username"), false);
  assert.equal(mod.looksLikeSecretKey(""), false);
});

test("redactSecrets: redacts value when key is a secret-named key in objects", () => {
  const out = mod.redactSecrets({ ANTHROPIC_API_KEY: "sk-abc123", other: "safe" });
  assert.equal(out.ANTHROPIC_API_KEY, "[REDACTED]");
  assert.equal(out.other, "safe");
});

test("redactSecrets: handles nested objects", () => {
  const out = mod.redactSecrets({ env: { GITHUB_TOKEN: "ghp_xyz", normal: 42 } });
  assert.equal(out.env.GITHUB_TOKEN, "[REDACTED]");
  assert.equal(out.env.normal, 42);
});

test("redactSecrets: handles arrays", () => {
  const out = mod.redactSecrets({ items: [{ api_key: "k1" }, { normal: "x" }] });
  assert.equal(out.items[0].api_key, "[REDACTED]");
  assert.equal(out.items[1].normal, "x");
});

test("redactSecrets: redacts inline key=value in strings", () => {
  const out = mod.redactSecrets("log: ANTHROPIC_API_KEY=sk-abc-12345 visible");
  assert.match(out, /ANTHROPIC_API_KEY=\[REDACTED\]/);
  assert.doesNotMatch(out, /sk-abc-12345/);
});

test("redactSecrets: does not over-redact normal text", () => {
  const out = mod.redactSecrets("hello world this is a log line");
  assert.equal(out, "hello world this is a log line");
});

test("isExecutableConfigPath: detects shell rc files", () => {
  assert.equal(mod.isExecutableConfigPath("/home/u/.bashrc"), true);
  assert.equal(mod.isExecutableConfigPath("/home/u/.zshrc"), true);
  assert.equal(mod.isExecutableConfigPath("/home/u/.profile"), true);
});

test("isExecutableConfigPath: detects package manager rc files", () => {
  assert.equal(mod.isExecutableConfigPath("/repo/.npmrc"), true);
  assert.equal(mod.isExecutableConfigPath("/repo/.yarnrc.yml"), true);
  assert.equal(mod.isExecutableConfigPath("/repo/.pnpmrc"), true);
});

test("isExecutableConfigPath: detects husky and pre-commit", () => {
  assert.equal(mod.isExecutableConfigPath("/repo/.husky/pre-commit"), true);
  assert.equal(mod.isExecutableConfigPath("/repo/.pre-commit-config.yaml"), true);
});

test("isExecutableConfigPath: detects PowerShell profile", () => {
  assert.equal(mod.isExecutableConfigPath("C:/Users/u/Documents/PowerShell/Microsoft.PowerShell_profile.ps1"), true);
  assert.equal(mod.isExecutableConfigPath("/repo/scripts/run.ps1"), true);
});

test("isExecutableConfigPath: rejects regular source files", () => {
  assert.equal(mod.isExecutableConfigPath("/repo/src/index.ts"), false);
  assert.equal(mod.isExecutableConfigPath("/repo/README.md"), false);
});

test("classifyDangerousCommand: rm -rf outside workspace is dangerous + requires confirmation", () => {
  const out = mod.classifyDangerousCommand("rm -rf /etc/passwd", "/workspace");
  assert.equal(out.dangerous, true);
  assert.equal(out.requiresConfirmation, true);
  assert.match(out.reason, /outside workspace/);
});

test("classifyDangerousCommand: rm -rf inside workspace still requires confirmation", () => {
  const out = mod.classifyDangerousCommand("rm -rf /workspace/dist", "/workspace");
  assert.equal(out.dangerous, true);
  assert.equal(out.requiresConfirmation, true);
});

test("classifyDangerousCommand: normal commands are not dangerous", () => {
  const out = mod.classifyDangerousCommand("ls -la /workspace", "/workspace");
  assert.equal(out.dangerous, false);
  assert.equal(out.requiresConfirmation, false);
});
