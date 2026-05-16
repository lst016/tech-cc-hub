import type { SlashCommandItem } from "./slash-command-discovery.js";
import { buildClaudeAgentTeamsPromptHint } from "../../shared/claude-agent-teams.js";

// Generated compatibility seed. Refresh with:
//   node scripts/sync-claude-code-compat.mjs

export type ClaudeCodeCompatRegistry = {
  sourceUrl: string;
  sourceVersion: string;
  sourceDate: string;
  generatedAt: string;
  commandItems: SlashCommandItem[];
  promptHints: string[];
};

export const CLAUDE_CODE_COMPAT_REGISTRY: ClaudeCodeCompatRegistry = {
  "sourceUrl": "https://claudelog.com/claude-code-changelog/",
  "sourceVersion": "2.1.139",
  "sourceDate": "May 11, 2026",
  "generatedAt": "2026-05-12T03:37:34.697Z",
  "commandItems": [
    {
      "name": "agent-view",
      "description": "Added agent view (Research Preview): a single list of every Claude Code session — running, blocked on you, or done. Run claude agents to get started. See https://code.claude.com/docs/en/agent-view"
    },
    {
      "name": "agents",
      "description": "Added agent view (Research Preview): a single list of every Claude Code session — running, blocked on you, or done. Run claude agents to get started. See https://code.claude.com/docs/en/agent-view"
    },
    {
      "name": "code",
      "description": "Added agent view (Research Preview): a single list of every Claude Code session — running, blocked on you, or done. Run claude agents to get started. See https://code.claude.com/docs/en/agent-view"
    },
    {
      "name": "context",
      "description": "/context all per-skill token estimates now account for the model's tokenizer and show rounded values"
    },
    {
      "name": "ctrl",
      "description": "[VSCode] Press Cmd/Ctrl+Shift+T to reopen the most recently closed session tab, configurable via claudeCode.enableReopenClosedSessionShortcut"
    },
    {
      "name": "docs",
      "description": "Added agent view (Research Preview): a single list of every Claude Code session — running, blocked on you, or done. Run claude agents to get started. See https://code.claude.com/docs/en/agent-view"
    },
    {
      "name": "emoji",
      "description": "Fixed border-embedded text overflowing on CJK/emoji due to visual cell width miscalculation"
    },
    {
      "name": "en",
      "description": "Added agent view (Research Preview): a single list of every Claude Code session — running, blocked on you, or done. Run claude agents to get started. See https://code.claude.com/docs/en/agent-view"
    },
    {
      "name": "goal",
      "description": "Added /goal command: set a completion condition and Claude keeps working across turns until it's met. Works in interactive, -p, and Remote Control. Shows live elapsed/turns/tokens as an overlay panel"
    },
    {
      "name": "logout",
      "description": "Fixed a deadlock where expired credentials and the forceRemoteSettingsRefresh policy setting blocked claude auth login/logout/status with no way to recover"
    },
    {
      "name": "mcp",
      "description": "/mcp Reconnect now picks up .mcp.json edits without a restart, and shows the HTTP status and URL when reconnecting fails"
    },
    {
      "name": "model",
      "description": "Fixed /model picker \"Default\" row not reflecting ANTHROPIC_DEFAULT_OPUS_MODEL/ANTHROPIC_DEFAULT_SONNET_MODEL overrides"
    },
    {
      "name": "plugin",
      "description": "Added claude plugin details <name> to show a plugin's component inventory and projected per-session token cost"
    },
    {
      "name": "schedule",
      "description": "Remote Control, /schedule, claude.ai MCP connectors, and notification preferences are now disabled when ANTHROPIC_API_KEY / apiKeyHelper / ANTHROPIC_AUTH_TOKEN is set, even if a Claude.ai login also exists. Unset the API key to use these features"
    },
    {
      "name": "scroll-speed",
      "description": "Added /scroll-speed command to tune mouse wheel scroll speed with a live preview"
    },
    {
      "name": "settings",
      "description": "Fixed settings hot-reload not detecting edits to symlinked ~/.claude/settings.json"
    },
    {
      "name": "sse",
      "description": "Fixed unbounded memory growth when an HTTP/SSE MCP server streams non-protocol data — response bodies now capped at 16 MB per SSE frame"
    },
    {
      "name": "status",
      "description": "Fixed a deadlock where expired credentials and the forceRemoteSettingsRefresh policy setting blocked claude auth login/logout/status with no way to recover"
    },
    {
      "name": "super",
      "description": "Fixed keybindings using only the cmd/super/win modifier being flagged as unparseable"
    },
    {
      "name": "tokens",
      "description": "Added /goal command: set a completion condition and Claude keeps working across turns until it's met. Works in interactive, -p, and Remote Control. Shows live elapsed/turns/tokens as an overlay panel"
    },
    {
      "name": "turns",
      "description": "Added /goal command: set a completion condition and Claude keeps working across turns until it's met. Works in interactive, -p, and Remote Control. Shows live elapsed/turns/tokens as an overlay panel"
    },
    {
      "name": "win",
      "description": "Fixed keybindings using only the cmd/super/win modifier being flagged as unparseable"
    }
  ],
  "promptHints": [
    "`/goal <goal>` sets or updates a durable completion condition. Restate the goal briefly, use update_plan to track progress, keep later work tied to the goal, and stop only when the goal is satisfied or a real blocker remains.",
    "`/scroll-speed <slow|normal|fast|number>` is a Claude Code terminal TUI setting. In tech-cc-hub, map it to explicit browser scroll distances or mouse wheel deltas when using browser tools; for chat transcript reading, summarize/navigate instead of pretending to change terminal scroll speed.",
    "`claude agents` / agent view is a session-and-agent overview. When the user asks for it here, summarize active session, subagent, tool, permission, and blocker state from available session events and progress summaries.",
    "Plugin details should include source, version, status, permissions, configured MCP servers, tool count/tool names, auth mode, update hints, and projected prompt/token impact when available.",
    "Hook `args: string[]` exec form and PostToolUse `continueOnBlock` apply to config-driven Claude Code hooks. tech-cc-hub uses SDK in-process hook callbacks, so keep using structured callbacks and `updatedToolOutput` for PostToolUse output replacement.",
    "Stdio MCP servers should receive `CLAUDE_PROJECT_DIR` for the current workspace unless the user explicitly configured that env var."
  ]
};

export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;

export function buildClaudeCodeCompatPromptAppend(): string {
  return [
    `Claude Code v${CLAUDE_CODE_COMPAT_REGISTRY.sourceVersion} compatibility notes for tech-cc-hub:`,
    ...CLAUDE_CODE_COMPAT_REGISTRY.promptHints.map((hint) => `- ${hint}`),
    ...buildClaudeAgentTeamsPromptHint().split("\n").map((hint) => `- ${hint}`),
  ].join("\n");
}
