import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLAUDE_AGENT_TEAM_TOOL_NAMES,
  CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION,
  CLAUDE_AGENT_TEAMS_ENV_VAR,
  DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT,
  buildClaudeAgentTeamsDisallowedTools,
  buildClaudeAgentTeamsPromptHint,
  resolveClaudeAgentTeamsEnv,
  withClaudeAgentTeamsEnv,
} from "../../src/shared/claude-agent-teams.js";

test("agent teams env helper enables the Claude Code experimental flag", () => {
  assert.equal(
    withClaudeAgentTeamsEnv({ PATH: "/bin" })[CLAUDE_AGENT_TEAMS_ENV_VAR],
    "1",
  );

  assert.equal(
    withClaudeAgentTeamsEnv({ [CLAUDE_AGENT_TEAMS_ENV_VAR]: "custom" })[CLAUDE_AGENT_TEAMS_ENV_VAR],
    "custom",
  );
});

test("agent teams env resolver only enables the experimental flag when requested", () => {
  assert.equal(
    resolveClaudeAgentTeamsEnv({ PATH: "/bin" }, false)[CLAUDE_AGENT_TEAMS_ENV_VAR],
    undefined,
  );

  assert.equal(
    resolveClaudeAgentTeamsEnv({ PATH: "/bin" }, true)[CLAUDE_AGENT_TEAMS_ENV_VAR],
    "1",
  );

  assert.equal(
    resolveClaudeAgentTeamsEnv({ [CLAUDE_AGENT_TEAMS_ENV_VAR]: "custom" }, false)[CLAUDE_AGENT_TEAMS_ENV_VAR],
    undefined,
  );
});

test("restricted allowed-tools defaults include Agent Teams tools", () => {
  for (const toolName of CLAUDE_AGENT_TEAM_TOOL_NAMES) {
    assert.match(DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT, new RegExp(`(^|,)${toolName}(,|$)`));
  }
});

test("Agent Teams tools are denied through the official SDK option unless explicitly enabled", () => {
  assert.equal(buildClaudeAgentTeamsDisallowedTools(true), undefined);
  assert.deepEqual(buildClaudeAgentTeamsDisallowedTools(false), [
    ...CLAUDE_AGENT_TEAM_TOOL_NAMES,
  ]);
});

test("runner gates the Agent Teams env flag by runtime profile", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.doesNotMatch(source, /const mergedEnv = withClaudeAgentTeamsEnv\(\{/);
  assert.match(source, /resolveClaudeAgentTeamsEnv\([\s\S]*runtimeProfile\.enableAgentTeams/);
  assert.match(source, /CLAUDE_AGENT_TEAMS_ENV_VAR/);
  assert.match(source, /agentTeamsEnabled/);
});

test("runner passes Agent Teams denies to the Agent SDK disallowedTools option", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /buildClaudeAgentTeamsDisallowedTools\(runtimeProfile\.enableAgentTeams\)/);
  assert.match(source, /disallowedTools: agentTeamsDisallowedTools/);
});

test("Claude Code path resolution falls back to a team-capable bundled CLI", () => {
  const source = readFileSync("src/electron/libs/claude/claude-settings.ts", "utf8");

  assert.match(source, /supportsClaudeCodeAgentTeams\(systemPath\)/);
  assert.match(source, /resolveSdkBundledClaudePath\(\)/);
  assert.match(source, /CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION/);
  assert.equal(CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION, "2.1.142");
});

test("Agent Teams prompt hint documents leader and teammate constraints", () => {
  const hint = buildClaudeAgentTeamsPromptHint();

  assert.match(hint, /TeamCreate/);
  assert.match(hint, /SendMessage/);
  assert.match(hint, /TeamDelete/);
  assert.match(hint, /leader/);
  assert.match(hint, /~\/\.claude\/teams/);
});
