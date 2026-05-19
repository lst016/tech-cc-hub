import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { listAvailableClaudeAgents, resolveAgentRuntimeContext } from "../../src/electron/libs/agent-resolver.js";

test("agent resolver scans user and project Claude documents plus sanitized settings", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-agent-config-"));
  const userClaudeRoot = join(tempRoot, "user-claude");
  const projectRoot = join(tempRoot, "project");

  try {
    mkdirSync(userClaudeRoot, { recursive: true });
    mkdirSync(join(projectRoot, ".claude"), { recursive: true });
    mkdirSync(join(userClaudeRoot, "agents"), { recursive: true });
    mkdirSync(join(userClaudeRoot, "rules"), { recursive: true });
    mkdirSync(join(projectRoot, ".claude", "agents"), { recursive: true });
    mkdirSync(join(projectRoot, ".claude", "rules"), { recursive: true });

    writeFileSync(join(userClaudeRoot, "CLAUDE.md"), "用户全局 CLAUDE 规则", "utf8");
    writeFileSync(join(userClaudeRoot, "AGENTS.md"), "用户全局 AGENTS 规则", "utf8");
    writeFileSync(join(projectRoot, "CLAUDE.md"), "项目根 CLAUDE 规则", "utf8");
    writeFileSync(join(projectRoot, ".claude", "CLAUDE.md"), "项目 .claude CLAUDE 规则", "utf8");
    writeFileSync(join(userClaudeRoot, "rules", "global.md"), "global rule body", "utf8");
    writeFileSync(join(projectRoot, ".claude", "rules", "project.md"), "project rule body", "utf8");
    writeFileSync(join(userClaudeRoot, "agents", "executor.md"), [
      "---",
      "name: executor",
      "description: Runs implementation work",
      "tools: Read, Edit",
      "---",
      "Executor full prompt",
    ].join("\n"), "utf8");
    writeFileSync(join(projectRoot, ".claude", "agents", "default.md"), [
      "---",
      "name: default",
      "description: Project default agent",
      "---",
      "Project default agent prompt",
    ].join("\n"), "utf8");
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

    assert.deepEqual(context.settingSources, ["user", "project", "local"]);
    assert.match(prompt, /用户全局 CLAUDE 规则/);
    assert.match(prompt, /用户全局 AGENTS 规则/);
    assert.match(prompt, /项目根 CLAUDE 规则/);
    assert.match(prompt, /项目 \.claude CLAUDE 规则/);
    assert.match(prompt, /global rule body/);
    assert.match(prompt, /project rule body/);
    assert.match(prompt, /Project default agent prompt/);
    assert.match(prompt, /executor/);
    assert.match(prompt, /Runs implementation work/);
    assert.match(prompt, /compact routing index/);
    assert.doesNotMatch(prompt, /source=.*executor\.md/);
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
    assert.ok(sourcePaths.includes(join(userClaudeRoot, "rules", "global.md")));
    assert.ok(sourcePaths.includes(join(projectRoot, ".claude", "rules", "project.md")));
    assert.ok(sourcePaths.includes(join(projectRoot, ".claude", "settings.local.json")));
    assert.ok(context.availableProfiles.some((profile) => profile.id === "executor" && profile.description === "Runs implementation work"));

    const selected = resolveAgentRuntimeContext({ cwd: projectRoot, userClaudeRoot, agentId: "executor" });
    assert.match(selected.systemPromptAppend ?? "", /Executor full prompt/);
    assert.deepEqual(selected.allowedTools, ["Read", "Edit"]);

    const listedAgents = listAvailableClaudeAgents({ cwd: projectRoot, userClaudeRoot });
    assert.ok(listedAgents.some((agent) => agent.id === "executor" && agent.description === "Runs implementation work"));
    assert.ok(listedAgents.some((agent) => agent.id === "default" && agent.scope === "project"));
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("agent resolver keeps the local Claude agent catalog compact", () => {
  const tempRoot = mkdtempSync(join(tmpdir(), "tech-cc-hub-agent-catalog-"));
  const userClaudeRoot = join(tempRoot, "user-claude");

  try {
    mkdirSync(join(userClaudeRoot, "agents"), { recursive: true });

    for (let index = 1; index <= 24; index += 1) {
      writeFileSync(join(userClaudeRoot, "agents", `agent-${index}.md`), [
        "---",
        `name: agent-${index}`,
        `description: ${"Long routing description ".repeat(30)}${index}`,
        "---",
        `Agent ${index} full prompt`,
      ].join("\n"), "utf8");
    }

    const context = resolveAgentRuntimeContext({ userClaudeRoot });
    const catalogSource = context.promptSources.find((source) => source.id === "local-claude-agent-catalog");
    const catalog = catalogSource?.text ?? "";

    assert.match(catalog, /24 available agents/);
    assert.match(catalog, /agent-1 \[user\]/);
    assert.match(catalog, /Descriptions are aggressively shortened because the catalog is large/);
    assert.match(catalog, /desc=Long routing description/);
    assert.doesNotMatch(catalog, /Long routing description Long routing description Long routing description/);
    assert.doesNotMatch(catalog, /source=/);
    assert.doesNotMatch(catalog, /Agent 1 full prompt/);
    assert.ok(catalog.length < 2_800, `catalog should stay compact, got ${catalog.length} chars`);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
