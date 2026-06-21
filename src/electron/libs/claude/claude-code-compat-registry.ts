import type { SlashCommandItem } from "../slash-command-discovery.js";
import type { ClaudeCodeCompatFact } from "./claude-code-compat-facts.js";
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
  facts: ClaudeCodeCompatFact[];
};

export const CLAUDE_CODE_COMPAT_REGISTRY: ClaudeCodeCompatRegistry = {
  "sourceUrl": "https://claudelog.com/claude-code-changelog/",
  "sourceVersion": "2.1.154",
  "sourceDate": "May 28, 2026",
  "generatedAt": "2026-06-03T15:19:03.495Z",
  "sourceDigest": "0bb18a690a291b70d1c5f2e932e5fff6567feac549ccede1e366576b073dad1f",
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
  ],
  "facts": [
    {
      "id": "2.1.154#opus-4-8-is-here-now-defaults-to-high-ef",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Opus 4.8 is here! Now defaults to high effort · /effort xhigh for your hardes...",
      "summary": "Opus 4.8 is here! Now defaults to high effort · /effort xhigh for your hardest tasks",
      "rawText": "Opus 4.8 is here! Now defaults to high effort · /effort xhigh for your hardest tasks",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#introducing-dynamic-workflows-ask-claude",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "Introducing dynamic workflows: ask Claude to create a workflow and it orchest...",
      "summary": "Introducing dynamic workflows: ask Claude to create a workflow and it orchestrates work across tens to hundreds of agents in the background, so you can take on larger, more complex tasks. Run `/workflows` to view your runs",
      "rawText": "Introducing dynamic workflows: ask Claude to create a workflow and it orchestrates work across tens to hundreds of agents in the background, so you can take on larger, more complex tasks. Run `/workflows` to view your runs",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fast-mode-on-opus-4-8-is-now-available-a",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Fast mode on Opus 4.8 is now available at a fraction of its previous cost: 2x...",
      "summary": "Fast mode on Opus 4.8 is now available at a fraction of its previous cost: 2x the standard rate for 2.5x the speed",
      "rawText": "Fast mode on Opus 4.8 is now available at a fraction of its previous cost: 2x the standard rate for 2.5x the speed",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#the-lean-system-prompt-is-now-the-defaul",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "The lean system prompt is now the default for all models except Haiku, Sonnet...",
      "summary": "The lean system prompt is now the default for all models except Haiku, Sonnet, and Opus 4.7 and earlier",
      "rawText": "The lean system prompt is now the default for all models except Haiku, Sonnet, and Opus 4.7 and earlier",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#claude-now-reserves-the-multiple-choice-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Claude now reserves the multiple-choice question prompt for decisions it genu...",
      "summary": "Claude now reserves the multiple-choice question prompt for decisions it genuinely cannot make itself, instead of asking when it already has enough context to proceed",
      "rawText": "Claude now reserves the multiple-choice question prompt for decisions it genuinely cannot make itself, instead of asking when it already has enough context to proceed",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#simplify-now-runs-a-cleanup-only-review-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "`/simplify` now runs a cleanup-only review (reuse, simplification, efficiency...",
      "summary": "`/simplify` now runs a cleanup-only review (reuse, simplification, efficiency, altitude) and applies the fixes, instead of running the full `/code-review --fix` bug-hunting review",
      "rawText": "`/simplify` now runs a cleanup-only review (reuse, simplification, efficiency, altitude) and applies the fixes, instead of running the full `/code-review --fix` bug-hunting review",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#renamed-the-effort-slider-labels-from-sp",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Renamed the `/effort` slider labels from \"Speed\"/\"Intelligence\" to \"Faster\"/\"...",
      "summary": "Renamed the `/effort` slider labels from \"Speed\"/\"Intelligence\" to \"Faster\"/\"Smarter\" for clarity",
      "rawText": "Renamed the `/effort` slider labels from \"Speed\"/\"Intelligence\" to \"Faster\"/\"Smarter\" for clarity",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#claude-agents-type-command-to-run-a-shel",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "`claude agents`: type `! <command>` to run a shell command as a background se...",
      "summary": "`claude agents`: type `! <command>` to run a shell command as a background session you can attach to and detach from. Also available as `claude --bg --exec '<command>'`",
      "rawText": "`claude agents`: type `! <command>` to run a shell command as a background session you can attach to and detach from. Also available as `claude --bg --exec '<command>'`",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#claude-agents-logout-now-signs-you-out-i",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "`claude agents`: `/logout` now signs you out instead of being sent to a backg...",
      "summary": "`claude agents`: `/logout` now signs you out instead of being sent to a background session",
      "rawText": "`claude agents`: `/logout` now signs you out instead of being sent to a background session",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#to-open-the-agents-view-now-works-on-bed",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "`←←` to open the agents view now works on Bedrock, Vertex, Foundry, and with ...",
      "summary": "`←←` to open the agents view now works on Bedrock, Vertex, Foundry, and with telemetry disabled",
      "rawText": "`←←` to open the agents view now works on Bedrock, Vertex, Foundry, and with telemetry disabled",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#claude-in-chrome-pick-which-connected-br",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Claude in Chrome: pick which connected browser to use via `/chrome` → \"Select...",
      "summary": "Claude in Chrome: pick which connected browser to use via `/chrome` → \"Select browser…\", or in-chat when a browser action runs with multiple connected",
      "rawText": "Claude in Chrome: pick which connected browser to use via `/chrome` → \"Select browser…\", or in-chat when a browser action runs with multiple connected",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#plugins-can-now-declare-defaultenabled-f",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "plugin",
      "severity": "compat",
      "title": "Plugins can now declare `defaultEnabled: false` in `plugin.json` or a marketp...",
      "summary": "Plugins can now declare `defaultEnabled: false` in `plugin.json` or a marketplace entry; enable them with `/plugin` or `claude plugin enable`. Dependencies of enabled plugins are still enabled automatically",
      "rawText": "Plugins can now declare `defaultEnabled: false` in `plugin.json` or a marketplace entry; enable them with `/plugin` or `claude plugin enable`. Dependencies of enabled plugins are still enabled automatically",
      "productTargets": [
        "plugin-manager",
        "settings-ui",
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#the-plugin-discover-tab-now-pins-plugins",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "plugin",
      "severity": "compat",
      "title": "The `/plugin` Discover tab now pins plugins whose relevance signals match the...",
      "summary": "The `/plugin` Discover tab now pins plugins whose relevance signals match the current directory with a \"suggested for this directory\" annotation",
      "rawText": "The `/plugin` Discover tab now pins plugins whose relevance signals match the current directory with a \"suggested for this directory\" annotation",
      "productTargets": [
        "plugin-manager",
        "settings-ui",
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#streaming-tool-execution-is-now-always-e",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Streaming tool execution is now always enabled, including when telemetry is d...",
      "summary": "Streaming tool execution is now always enabled, including when telemetry is disabled or on Bedrock/Vertex/Foundry (previously behind a feature flag)",
      "rawText": "Streaming tool execution is now always enabled, including when telemetry is disabled or on Bedrock/Vertex/Foundry (previously behind a feature flag)",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#stdio-mcp-server-subprocesses-now-receiv",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "plugin",
      "severity": "compat",
      "title": "Stdio MCP server subprocesses now receive `CLAUDE_CODE_SESSION_ID` and `CLAUD...",
      "summary": "Stdio MCP server subprocesses now receive `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1` in their environment",
      "rawText": "Stdio MCP server subprocesses now receive `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1` in their environment",
      "productTargets": [
        "plugin-manager",
        "settings-ui",
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#claude-mcp-list-get-now-show-unapproved-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "`claude mcp list`/`get` now show unapproved `.mcp.json` servers as `⏸ Pending...",
      "summary": "`claude mcp list`/`get` now show unapproved `.mcp.json` servers as `⏸ Pending approval` instead of auto-approving and connecting when output is piped",
      "rawText": "`claude mcp list`/`get` now show unapproved `.mcp.json` servers as `⏸ Pending approval` instead of auto-approving and connecting when output is piped",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#remote-control-autocomplete-now-shows-di",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "`/remote-control` autocomplete now shows \"Disconnect Remote Control\" when Rem...",
      "summary": "`/remote-control` autocomplete now shows \"Disconnect Remote Control\" when Remote Control is already active",
      "rawText": "`/remote-control` autocomplete now shows \"Disconnect Remote Control\" when Remote Control is already active",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#added-claude-opus-4-8-support-and-4-7-4-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Added Claude Opus 4.8 support and 4.7 → 4.8 migration guidance to the `/claud...",
      "summary": "Added Claude Opus 4.8 support and 4.7 → 4.8 migration guidance to the `/claude-api` skill",
      "rawText": "Added Claude Opus 4.8 support and 4.7 → 4.8 migration guidance to the `/claude-api` skill",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#deprecated-claude-code-opus-4-6-fast-mod",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Deprecated `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` (will be removed on 06/0...",
      "summary": "Deprecated `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` (will be removed on 06/01). To use fast mode on Opus 4.6, switch with `/model claude-opus-4-6[1m]` and then `/fast on`",
      "rawText": "Deprecated `CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE` (will be removed on 06/01). To use fast mode on Opus 4.6, switch with `/model claude-opus-4-6[1m]` and then `/fast on`",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#improved-the-auto-mode-classifier-s-dete",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Improved the auto-mode classifier's detection of data exfiltration, particula...",
      "summary": "Improved the auto-mode classifier's detection of data exfiltration, particularly bulk transfers of repository contents",
      "rawText": "Improved the auto-mode classifier's detection of data exfiltration, particularly bulk transfers of repository contents",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-rm-rf-home-not-being-blocked-as-a-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "security",
      "severity": "guardrail",
      "title": "Fixed `rm -rf $HOME` not being blocked as a dangerous path when `HOME` has a ...",
      "summary": "Fixed `rm -rf $HOME` not being blocked as a dangerous path when `HOME` has a trailing slash",
      "rawText": "Fixed `rm -rf $HOME` not being blocked as a dangerous path when `HOME` has a trailing slash",
      "productTargets": [
        "runner",
        "release-gate",
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-tmpdir-resolving-to-different-dire",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed `$TMPDIR` resolving to different directories in sandboxed vs unsandboxe...",
      "summary": "Fixed `$TMPDIR` resolving to different directories in sandboxed vs unsandboxed Bash commands within the same session",
      "rawText": "Fixed `$TMPDIR` resolving to different directories in sandboxed vs unsandboxed Bash commands within the same session",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-unreadable-highlighted-row-text-in",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "Fixed unreadable highlighted-row text in `claude agents` when the Claude Code...",
      "summary": "Fixed unreadable highlighted-row text in `claude agents` when the Claude Code theme doesn't match the terminal background",
      "rawText": "Fixed unreadable highlighted-row text in `claude agents` when the Claude Code theme doesn't match the terminal background",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-background-agent-completion-notifi",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed background-agent completion notifications triggering premature \"out of ...",
      "summary": "Fixed background-agent completion notifications triggering premature \"out of context\" behavior on some 1M-context models",
      "rawText": "Fixed background-agent completion notifications triggering premature \"out of context\" behavior on some 1M-context models",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-background-session-classifier-losi",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed background-session classifier losing the user's goal when a scheduled `...",
      "summary": "Fixed background-session classifier losing the user's goal when a scheduled `/command` fires",
      "rawText": "Fixed background-session classifier losing the user's goal when a scheduled `/command` fires",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-pinned-background-sessions-respawn",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed pinned background sessions respawning every minute after a Claude Code ...",
      "summary": "Fixed pinned background sessions respawning every minute after a Claude Code update, causing repeated agent-start notifications and process churn at idle",
      "rawText": "Fixed pinned background sessions respawning every minute after a Claude Code update, causing repeated agent-start notifications and process churn at idle",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-background-sessions-stuck-at-block",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "Fixed background sessions stuck at \"blocked\", \"running\", or \"working\" not ret...",
      "summary": "Fixed background sessions stuck at \"blocked\", \"running\", or \"working\" not retiring after the idle grace period",
      "rawText": "Fixed background sessions stuck at \"blocked\", \"running\", or \"working\" not retiring after the idle grace period",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-subagents-in-background-sessions-b",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed subagents in background sessions bypassing the worktree-isolation guard...",
      "summary": "Fixed subagents in background sessions bypassing the worktree-isolation guard and writing to the shared checkout",
      "rawText": "Fixed subagents in background sessions bypassing the worktree-isolation guard and writing to the shared checkout",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-orphaned-claude-bg-pty-host-proces",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed orphaned `claude --bg-pty-host` processes spinning at 100% CPU after th...",
      "summary": "Fixed orphaned `claude --bg-pty-host` processes spinning at 100% CPU after the daemon exits on macOS",
      "rawText": "Fixed orphaned `claude --bg-pty-host` processes spinning at 100% CPU after the daemon exits on macOS",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-number-key-shortcuts-not-working-f",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed number key shortcuts not working for options shown below the divider in...",
      "summary": "Fixed number key shortcuts not working for options shown below the divider in option dialogs",
      "rawText": "Fixed number key shortcuts not working for options shown below the divider in option dialogs",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-worktree-baseref-head-resolving-to",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed `worktree.baseRef: \"head\"` resolving to the main checkout's HEAD instea...",
      "summary": "Fixed `worktree.baseRef: \"head\"` resolving to the main checkout's HEAD instead of the current worktree's HEAD when spawning subagents or calling `EnterWorktree` from inside a linked worktree",
      "rawText": "Fixed `worktree.baseRef: \"head\"` resolving to the main checkout's HEAD instead of the current worktree's HEAD when spawning subagents or calling `EnterWorktree` from inside a linked worktree",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-a-stray-leading-space-on-wrapped-l",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed a stray leading space on wrapped lines when the previous line ended exa...",
      "summary": "Fixed a stray leading space on wrapped lines when the previous line ended exactly at the terminal width",
      "rawText": "Fixed a stray leading space on wrapped lines when the previous line ended exactly at the terminal width",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-intermittent-terminal-rendering-co",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed intermittent terminal rendering corruption in VS Code by capping the nu...",
      "summary": "Fixed intermittent terminal rendering corruption in VS Code by capping the number of distinct colors the thinking spinner produces",
      "rawText": "Fixed intermittent terminal rendering corruption in VS Code by capping the number of distinct colors the thinking spinner produces",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-plan-file-names-including-image-n-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed plan file names including `[Image #N]` / `[Pasted text #N]` placeholder...",
      "summary": "Fixed plan file names including `[Image #N]` / `[Pasted text #N]` placeholders when a plan-mode prompt starts with pasted images or text",
      "rawText": "Fixed plan file names including `[Image #N]` / `[Pasted text #N]` placeholders when a plan-mode prompt starts with pasted images or text",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-a-phantom-expand-click-affordance-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "command",
      "severity": "info",
      "title": "Fixed a phantom expand/click affordance on colored tool output: short ANSI-co...",
      "summary": "Fixed a phantom expand/click affordance on colored tool output: short ANSI-colored lines that fit on screen no longer show a \"ctrl+o to expand\" hint",
      "rawText": "Fixed a phantom expand/click affordance on colored tool output: short ANSI-colored lines that fit on screen no longer show a \"ctrl+o to expand\" hint",
      "productTargets": [
        "slash-catalog"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-a-single-invalid-allowedmcpservers",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed a single invalid `allowedMcpServers`/`deniedMcpServers` entry in manage...",
      "summary": "Fixed a single invalid `allowedMcpServers`/`deniedMcpServers` entry in managed settings discarding all managed-settings policy; the bad entry is now dropped with a `claude doctor` warning",
      "rawText": "Fixed a single invalid `allowedMcpServers`/`deniedMcpServers` entry in managed settings discarding all managed-settings policy; the bad entry is now dropped with a `claude doctor` warning",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-api-400-errors-on-models-that-don-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Fixed API 400 errors on models that don't support the effort parameter when `...",
      "summary": "Fixed API 400 errors on models that don't support the effort parameter when `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` is set",
      "rawText": "Fixed API 400 errors on models that don't support the effort parameter when `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` is set",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#windows-fixed-update-failures-caused-by-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "platform",
      "severity": "compat",
      "title": "Windows: Fixed update failures caused by `claude.exe` being in use showing a ...",
      "summary": "Windows: Fixed update failures caused by `claude.exe` being in use showing a generic error instead of telling you to close other sessions and retry",
      "rawText": "Windows: Fixed update failures caused by `claude.exe` being in use showing a generic error instead of telling you to close other sessions and retry",
      "platformTags": [
        "windows"
      ],
      "productTargets": [
        "qa",
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#removed-the-stale-for-background-hint-fr",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "Removed the stale \"& for background\" hint from the shortcuts help panel",
      "summary": "Removed the stale \"& for background\" hint from the shortcuts help panel",
      "rawText": "Removed the stale \"& for background\" hint from the shortcuts help panel",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#vscode-auto-mode-no-longer-requires-the-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "[VSCode] Auto mode no longer requires the bypass-permissions setting to appea...",
      "summary": "[VSCode] Auto mode no longer requires the bypass-permissions setting to appear in the mode picker, and a dismissable notice on the new-session screen explains auto mode the first time it's active",
      "rawText": "[VSCode] Auto mode no longer requires the bypass-permissions setting to appear in the mode picker, and a dismissable notice on the new-session screen explains auto mode the first time it's active",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-the-task-panel-below-the-prompt-sh",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "runtime",
      "severity": "breaking-risk",
      "title": "Fixed the task panel below the prompt showing a stray unselectable \"main\" row...",
      "summary": "Fixed the task panel below the prompt showing a stray unselectable \"main\" row when only a workflow is running",
      "rawText": "Fixed the task panel below the prompt showing a stray unselectable \"main\" row when only a workflow is running",
      "productTargets": [
        "session-state",
        "activity-rail",
        "runner"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-mcp-tools-list-and-tool-detail-ren",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed /mcp tools list and tool detail rendering when MCP servers have long or...",
      "summary": "Fixed /mcp tools list and tool detail rendering when MCP servers have long or multi-line tool names or long descriptions",
      "rawText": "Fixed /mcp tools list and tool detail rendering when MCP servers have long or multi-line tool names or long descriptions",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-the-model-picker-not-showing-fast-",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "model",
      "severity": "compat",
      "title": "Fixed the /model picker not showing fast mode pricing on the Default option f...",
      "summary": "Fixed the /model picker not showing fast mode pricing on the Default option for API (pay-as-you-go) users when fast mode is on",
      "rawText": "Fixed the /model picker not showing fast mode pricing on the Default option for API (pay-as-you-go) users when fast mode is on",
      "productTargets": [
        "runner",
        "settings-ui"
      ],
      "implemented": false,
      "testIds": []
    },
    {
      "id": "2.1.154#fixed-auto-mode-incorrectly-blocking-act",
      "version": "2.1.154",
      "date": "May 28, 2026",
      "category": "ui-copy",
      "severity": "info",
      "title": "Fixed auto mode incorrectly blocking actions with \"could not evaluate this ac...",
      "summary": "Fixed auto mode incorrectly blocking actions with \"could not evaluate this action\" when the safety classifier ran out of output tokens while reasoning",
      "rawText": "Fixed auto mode incorrectly blocking actions with \"could not evaluate this action\" when the safety classifier ran out of output tokens while reasoning",
      "productTargets": [
        "docs"
      ],
      "implemented": false,
      "testIds": []
    }
  ]
};

export const CLAUDE_CODE_COMPAT_COMMAND_ITEMS = CLAUDE_CODE_COMPAT_REGISTRY.commandItems;

const CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS = [
  "`/code-review` should split oversized code or diff input into bounded review chunks, review each chunk for correctness, security, and regression findings, then summarize cross-chunk risks instead of loading everything at once."
];

export type ClaudeCodeCompatPromptAppendOptions = {
  includeAgentTeamsHint?: boolean;
};

export function buildClaudeCodeCompatPromptAppend(
  options: ClaudeCodeCompatPromptAppendOptions = {},
): string {
  const includeAgentTeamsHint = options.includeAgentTeamsHint ?? true;
  const agentTeamsHints = includeAgentTeamsHint
    ? buildClaudeAgentTeamsPromptHint().split("\n").map((hint) => `- ${hint}`)
    : [];

  return [
    `Claude Code v${CLAUDE_CODE_COMPAT_REGISTRY.sourceVersion} compatibility notes for tech-cc-hub:`,
    ...CLAUDE_CODE_LOCAL_COMPAT_PROMPT_HINTS.map((hint) => `- ${hint}`),
    ...CLAUDE_CODE_COMPAT_REGISTRY.promptHints.map((hint) => `- ${hint}`),
    ...agentTeamsHints,
  ].join("\n");
}
