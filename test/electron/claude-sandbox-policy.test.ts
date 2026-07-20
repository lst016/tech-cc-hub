import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClaudeSandboxSettings,
  getClaudeCredentialAccessDenyMessage,
} from "../../src/electron/libs/claude/claude-sandbox-policy.js";

test("sandbox denies provider secrets and masks scoped package credentials", () => {
  const sandbox = buildClaudeSandboxSettings({
    enabled: true,
    workspaceRoot: "D:/workspace/project",
  });
  const envRules = sandbox.credentials?.envVars ?? [];

  assert.deepEqual(
    envRules.find((rule) => rule.name === "ANTHROPIC_API_KEY"),
    { name: "ANTHROPIC_API_KEY", mode: "deny" },
  );
  assert.deepEqual(
    envRules.find((rule) => rule.name === "GITHUB_TOKEN"),
    {
      name: "GITHUB_TOKEN",
      mode: "mask",
      injectHosts: ["github.com", "api.github.com"],
    },
  );
  assert.equal(sandbox.credentials?.allowPlaintextInject, false);
  assert.equal(sandbox.failIfUnavailable, false);
  assert.deepEqual(
    sandbox.credentials?.files?.find((rule) => rule.path === "~/.ssh/**"),
    { path: "~/.ssh/**", mode: "deny" },
  );
});

test("unattended sandbox policy can fail closed when isolation is unavailable", () => {
  const sandbox = buildClaudeSandboxSettings({
    enabled: true,
    failIfUnavailable: true,
    workspaceRoot: "D:/workspace/project",
    environment: {
      SLACK_BOT_TOKEN: "secret",
      DATABASE_PASSWORD: "secret",
      DATABASE_URL: "postgres://user:password@localhost/db",
      REDIS_URL: "redis://:password@localhost:6379",
      SENTRY_DSN: "https://secret@sentry.example/1",
      CONNECTION_STRING: "Server=localhost;Password=secret",
      PATH: "D:/bin",
      CLASSPATH: "D:/classes",
      API_BASE_URL: "https://api.example.com",
    },
  });

  assert.equal(sandbox.failIfUnavailable, true);
  assert.deepEqual(
    sandbox.credentials?.files?.find((rule) => rule.path === "~/.claude/.credentials.json"),
    { path: "~/.claude/.credentials.json", mode: "deny" },
  );
  assert.match(
    getClaudeCredentialAccessDenyMessage("Read", { file_path: "~/.claude/.credentials.json" }) ?? "",
    /credential files is blocked/,
  );
  assert.deepEqual(
    sandbox.credentials?.envVars?.find((rule) => rule.name === "SLACK_BOT_TOKEN"),
    { name: "SLACK_BOT_TOKEN", mode: "deny" },
  );
  assert.deepEqual(
    sandbox.credentials?.envVars?.find((rule) => rule.name === "DATABASE_PASSWORD"),
    { name: "DATABASE_PASSWORD", mode: "deny" },
  );
  for (const name of ["DATABASE_URL", "REDIS_URL", "SENTRY_DSN", "CONNECTION_STRING"]) {
    assert.deepEqual(
      sandbox.credentials?.envVars?.find((rule) => rule.name === name),
      { name, mode: "deny" },
    );
  }
  for (const name of ["PATH", "CLASSPATH", "API_BASE_URL"]) {
    assert.equal(sandbox.credentials?.envVars?.some((rule) => rule.name === name), false);
  }
  assert.match(
    getClaudeCredentialAccessDenyMessage("Read", { file_path: "D:/workspace/project/.env.local" }) ?? "",
    /credential files is blocked/,
  );
});

test("credential guard remains active when SDK permission prompts are bypassed", () => {
  assert.match(
    getClaudeCredentialAccessDenyMessage("Read", { file_path: "~/.aws/credentials" }) ?? "",
    /credential files is blocked/,
  );
  assert.match(
    getClaudeCredentialAccessDenyMessage("Bash", { command: "echo $GITHUB_TOKEN" }) ?? "",
    /Shell access to host credentials is blocked/,
  );
  assert.match(
    getClaudeCredentialAccessDenyMessage("Bash", { command: "printenv" }) ?? "",
    /Shell access to host credentials is blocked/,
  );
  assert.equal(getClaudeCredentialAccessDenyMessage("Read", { file_path: "src/index.ts" }), undefined);
});
