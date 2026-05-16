import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { resolveAgentRuntimeContext } from "../../src/electron/libs/agent-resolver.js";

test("agent resolver scans user and project Claude documents plus sanitized settings", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-agent-config-"));
  const userClaudeRoot = join(tempRoot, "user-claude");
  const projectRoot = join(tempRoot, "project");

  try {
    mkdirSync(userClaudeRoot, { recursive: true });
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });

    writeFileSync(join(userClaudeRoot, "CLAUDE.md"), "用户全局 CLAUDE 规则", "utf8");
    writeFileSync(join(userClaudeRoot, "AGENTS.md"), "用户全局 AGENTS 规则", "utf8");
    writeFileSync(join(projectRoot, "CLAUDE.md"), "项目根 CLAUDE 规则", "utf8");
    writeFileSync(join(projectRoot, ".claude", "CLAUDE.md"), "项目 .claude CLAUDE 规则", "utf8");
    writeFileSync(join(userClaudeRoot, "settings.json"), JSON.stringify({
      env: { SECRET_TOKEN: "secret-user-value" },
      enabledPlugins: { "figma@claude-plugins-official": true },
      mcpServers: {
        userServer: {
          type: "http",
          url: "https://token@example.com/mcp?api_key=secret",
          headers: { Authorization: "Bearer secret" },
        },
      },
      permissions: { allow: ["Read"], defaultMode: "acceptEdits" },
    }), "utf8");
    writeFileSync(join(projectRoot, ".claude", "settings.local.json"), JSON.stringify({
      mcpServers: {
        projectServer: {
          command: "node",
          args: ["server.js", "--token", "secret"],
          env: { PROJECT_TOKEN: "secret-project-value" },
        },
      },
      hooks: { PreToolUse: [{ type: "command", command: "echo secret" }] },
    }), "utf8");

    const context = resolveAgentRuntimeContext({ cwd: projectRoot, userClaudeRoot });
    const prompt = context.systemPromptAppend ?? "";

    assert.equal(context.settingSources.length, 0);
    assert.match(prompt, /用户全局 CLAUDE 规则/);
    assert.match(prompt, /用户全局 AGENTS 规则/);
    assert.match(prompt, /项目根 CLAUDE 规则/);
    assert.match(prompt, /项目 \.claude CLAUDE 规则/);
    assert.match(prompt, /Claude settings summary \(sanitized\)/);
    assert.match(prompt, /userServer/);
    assert.match(prompt, /projectServer/);
    assert.match(prompt, /env keys: SECRET_TOKEN \(values redacted\)/);
    assert.match(prompt, /envKeys=PROJECT_TOKEN/);
    assert.doesNotMatch(prompt, /secret-user-value/);
    assert.doesNotMatch(prompt, /secret-project-value/);
    assert.doesNotMatch(prompt, /api_key=secret/);
    assert.doesNotMatch(prompt, /Bearer secret/);

    const sourcePaths = context.promptSources.map((source) => source.sourcePath).filter(Boolean);
    assert.ok(sourcePaths.includes(join(userClaudeRoot, "CLAUDE.md")));
    assert.ok(sourcePaths.includes(join(projectRoot, ".claude", "CLAUDE.md")));
    assert.ok(sourcePaths.includes(join(projectRoot, ".claude", "settings.local.json")));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
