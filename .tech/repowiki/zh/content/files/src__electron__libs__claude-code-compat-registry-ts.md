# src/electron/libs/claude-code-compat-registry.ts

> 模块：`electron` · 语言：`typescript` · 行数：128

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## 关键符号

- `buildClaudeCodeCompatPromptAppend@121`
- `CLAUDE_CODE_COMPAT_COMMAND_ITEMS@119`
- `ClaudeCodeCompatRegistry@5`

## 依赖输入

- `./slash-command-discovery.js`

## 对外暴露

- `ClaudeCodeCompatRegistry`
- `CLAUDE_CODE_COMPAT_REGISTRY`
- `CLAUDE_CODE_COMPAT_COMMAND_ITEMS`
- `buildClaudeCodeCompatPromptAppend`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```typescript
import type { SlashCommandItem } from "./slash-command-discovery.js";

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
      "description": "Fixed unbounded memory growth when an HTTP/SSE MCP server streams non-protocol data — response bodies now capped at 16 MB per SSE
... (truncated)
```
