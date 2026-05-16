export const CLAUDE_AGENT_TEAMS_ENV_VAR = "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS";
export const CLAUDE_AGENT_TEAMS_ENV_VALUE = "1";
export const CLAUDE_AGENT_TEAMS_MIN_CLAUDE_CODE_VERSION = "2.1.142";

export const CLAUDE_AGENT_TEAM_TOOL_NAMES = [
  "TeamCreate",
  "TeamDelete",
  "SendMessage",
  "Agent",
  "TaskCreate",
  "TaskGet",
  "TaskUpdate",
  "TaskList",
] as const;

export const DEFAULT_RESTRICTED_ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "MultiEdit",
  "Write",
  "Bash",
  "Glob",
  "Search",
  "update_plan",
  ...CLAUDE_AGENT_TEAM_TOOL_NAMES,
] as const;

export const DEFAULT_RESTRICTED_ALLOWED_TOOLS_TEXT = DEFAULT_RESTRICTED_ALLOWED_TOOLS.join(",");

export function withClaudeAgentTeamsEnv<T extends Record<string, string | undefined>>(
  env: T,
): T & Record<typeof CLAUDE_AGENT_TEAMS_ENV_VAR, string | undefined> {
  const configuredValue = env[CLAUDE_AGENT_TEAMS_ENV_VAR]?.trim();
  return {
    ...env,
    [CLAUDE_AGENT_TEAMS_ENV_VAR]: configuredValue || CLAUDE_AGENT_TEAMS_ENV_VALUE,
  };
}

export function buildClaudeAgentTeamsPromptHint(): string {
  return [
    "Claude Code Agent Teams is enabled in tech-cc-hub through `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.",
    "Use `TeamCreate`, `SendMessage`, and `TeamDelete` only for true cross-layer or non-overlapping parallel work; keep the leader responsible for decomposition and review, and on SDK builds that expose teammate spawning through `Agent` plus task-list tools, use the named teammate and task fields instead of hand-rolled coordination.",
    "Prefer 3-5 teammates, assign clear file ownership, use plan mode for teammates when work needs approval, and avoid teams when a single quick investigation or ordinary subagent is enough.",
    "Teammates coordinate through Claude Code shared team state under `~/.claude/teams/`; do not invent separate task files unless the user asks for product-level documentation.",
  ].join("\n");
}
