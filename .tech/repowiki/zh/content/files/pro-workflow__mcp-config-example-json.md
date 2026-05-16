# pro-workflow/mcp-config.example.json

> 模块：`pro-workflow` · 语言：`json` · 行数：47

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp@latest"],
      "_comment": "Live documentation lookup. Eliminates outdated API guessing."
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@anthropic/mcp-playwright"],
      "_comment": "Browser automation and E2E testing. Most token-efficient browser MCP."
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      },
      "_comment": "PRs, issues, code search. Essential for any GitHub-based project."
    }
  },
  "_recommendations": {
    "daily_use": [
      "context7 - Live docs. Use instead of guessing API signatures.",
      "playwright - E2E testing and browser automation. 13.7k tokens avg.",
      "github - PRs, issues, code search."
    ],
    "add_when_needed": [
      "supabase - Database operations (when using Supabase)",
      "linear - Issue tracking (when using Linear)",
      "slack - Team notifications (when using Slack)"
    ],
    "wisdom": "Start with 3 MCPs. Add only when you hit a concrete need. Most developers who start with 10+ end up using 3-4 daily."
  },
  "_scopes": {
    "project": ".mcp.json at project root (shared with team)",
    "user": "~/.claude.json mcpServers section (personal)",
    "agent": "mcpServers field in agent frontmatter (per-agent)"
  },
  "_approval_settings": {
    "auto_approve_all": "\"enableAllProjectMcpServers\": true in settings.json",
    "selective": "\"enabledMcpjsonServers\": [\"context7\", \"github\"] in settings.json",
    "block": "\"disabledMcpjsonServers\": [\"unused-server\"] in settings.json"
  }
}

```
