import type { SlashCommandItem } from "../slash-command-discovery.js";
import { buildClaudeAgentTeamsPromptHint } from "../../../shared/claude-agent-teams.js";

// Generated compatibility seed. Refresh with:
//   node scripts/sync-claude-code-compat.mjs

export type ClaudeCodeCompatRegistry = {
  sourceUrl: string;
  sourceVersion: string;
  sourceDate: string;
  generatedAt: string;
  sourceDigest?: string;
  commandItems: SlashCommandItem[];
  promptHints: string[];
};

export const CLAUDE_CODE_COMPAT_REGISTRY: ClaudeCodeCompatRegistry = {
  "sourceUrl": "https://claudelog.com/claude-code-changelog/",
  "sourceVersion": "2.1.154",
  "sourceDate": "May 28, 2026",
  "generatedAt": "2026-06-03T15:10:42.523Z",
  "sourceDigest": "d4fa66e551aa9928280436e90b9dbcb073c8587ae2098421d3d0c805b147c82f",
  "commandItems": [
    {
      "name": "agents",
      "description": "claude agents: type ! <command> to run a shell command as a background session you can attach to and detach from. Also available as claude --bg --exec '<command>'"
    },
    {
      "name": "chrome",
      "description": "Claude in Chrome: pick which connected browser to use via /chrome → \"Select browser…\", or in-chat when a browser action runs with multiple connected"
    },
    {
      "name": "claude-api",
      "description": "Added Claude Opus 4.8 support and 4.7 → 4.8 migration guidance to the /claude-api skill"
    },
    {
      "name": "code-review",
      "description": "/simplify now runs a cleanup-only review (reuse, simplification, efficiency, altitude) and applies the fixes, instead of running the full /code-review --fix bug-hunting review"
    },
    {
      "name": "command",
      "description": "Fixed background-session classifier losing the user's goal when a scheduled /command fires"
    },
    {
      "name": "effort",
      "description": "Renamed the /effort slider labels from \"Speed\"/\"Intelligence\" to \"Faster\"/\"Smarter\" for clarity"
    },
    {
      "name": "fast",
      "description": "Deprecated CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE (will be removed on 06/01). To use fast mode on Opus 4.6, switch with /model claude-opus-4-6[1m] and then /fast on"
    },
    {
      "name": "logout",
      "description": "claude agents: /logout now signs you out instead of being sent to a background session"
    },
    {
      "name": "model",
      "description": "Deprecated CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE (will be removed on 06/01). To use fast mode on Opus 4.6, switch with /model claude-opus-4-6[1m] and then /fast on"
    },
    {
      "name": "plugin",
      "description": "Plugins can now declare defaultEnabled: false in plugin.json or a marketplace entry; enable them with /plugin or claude plugin enable. Dependencies of enabled plugins are still enabled automatically"
    },
    {
      "name": "remote-control",
      "description": "/remote-control autocomplete now shows \"Disconnect Remote Control\" when Remote Control is already active"
    },
    {
      "name": "simplify",
      "description": "/simplify now runs a cleanup-only review (reuse, simplification, efficiency, altitude) and applies the fixes, instead of running the full /code-review --fix bug-hunting review"
    },
    {
      "name": "workflows",
      "description": "Introducing dynamic workflows: ask Claude to create a workflow and it orchestrates work across tens to hundreds of agents in the background, so you can take on larger, more complex tasks. Run /workflows to view your runs"
    }
  ],
  "promptHints": [
    "`claude agents` / agent view is a session-and-agent overview. When the user asks for it here, summarize active session, subagent, tool, permission, and blocker state from available session events and progress summaries.",
    "Plugin details should include source, version, status, permissions, configured MCP servers, tool count/tool names, auth mode, update hints, and projected prompt/token impact when available.",
    "Dynamic workflows let Claude create and run workflow plans across many background agents. For broad multi-lane tasks in tech-cc-hub, prefer an explicit workflow plan, keep progress visible in the task/workflow status surface, and avoid spawning large agent trees for small reversible edits."
  ]
};

export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;

const CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS = [
  "`/code-review` should split oversized code or diff input into bounded review chunks, review each chunk for correctness, security, and regression findings, then summarize cross-chunk risks instead of loading everything at once."
];

export function buildClaudeCodeCompatPromptAppend(): string {
  return [
    `Claude Code v${CLAUDE_CODE_COMPAT_REGISTRY.sourceVersion} compatibility notes for tech-cc-hub:`,
    ...CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS.map((hint) => `- ${hint}`),
    ...CLAUDE_CODE_COMPAT_REGISTRY.promptHints.map((hint) => `- ${hint}`),
    ...buildClaudeAgentTeamsPromptHint().split("\n").map((hint) => `- ${hint}`),
  ].join("\n");
}
