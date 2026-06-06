import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CLAUDE_AGENT_TEAM_TOOL_NAMES,
  CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION,
  CLAUDE_AGENT_TEAMS_ENV_VAR,
  DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT,
  buildClaudeAgentTeamsPromptHint,
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

test("restricted allowed-tools defaults include Agent Teams tools", () => {
  for (const toolName of CLAUDE_AGENT_TEAM_TOOL_NAMES) {
    assert.match(DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT, new RegExp(`(^|,)${toolName}(,|$)`));
  }
});

test("runner injects the Agent Teams env flag into SDK sessions", () => {
  const source = readFileSync("src/electron/libs/runner/runner.ts", "utf8");

  assert.match(source, /withClaudeAgentTeamsEnv\(\{/);
  assert.match(source, /CLAUDE_AGENT_TEAMS_ENV_VAR/);
  assert.match(source, /agentTeamsEnabled/);
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
