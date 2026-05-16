# pro-workflow/docs/settings-guide.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：228

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Settings Guide

Complete reference for configuring Claude Code. Settings control permissions, behavior, and integrations.

## Settings Hierarchy (Top Wins)

```text
1. CLI flags              --permission-mode, --max-budget-usd
2. .claude/settings.local.json   Project-local (gitignored)
3. .claude/settings.json         Project-shared (committed)
4. ~/.claude/settings.local.json  User-local (personal)
5. ~/.claude/settings.json        User-global
6. managed-settings.json          Enterprise policy (read-only)
```

First match wins. Project settings override user settings. CLI flags override everything.

## Permission Modes

| Mode | Behavior |
|------|----------|
| `default` | Ask for dangerous operations |
| `acceptEdits` | Auto-approve file edits, ask for shell |
| `askEdits` | Ask for everything including edits |
| `dontAsk` | Auto-approve everything (trusted environments) |
| `viewOnly` | Read-only, no modifications |
| `bypassPermissions` | Skip all checks (CI/CD only) |
| `plan` | Research and plan, require approval to execute |

Set via CLI: `claude --permission-mode plan`

## Permission Rules

Rules follow `Tool` or `Tool(specifier)` format. Evaluated in order: deny > ask > allow.

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl * | bash)",
      "Edit(/vendor/**)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(docker *)",
      "Bash(npm publish)"
    ],
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Bash(npm run *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(ls *)",
      "WebFetch(domain:code.claude.com)",
      "MCP(github:*)",
      "Task(*)",
      "Agent(*)"
    ]
  }
}
```

### Wildcard Syntax

| Pattern | Matches |
|---------|---------|
| `Bash(npm run *)` | Any npm script |
| `Edit(/src/**)` | Any file under src/ recursively |
| `WebFetch(domain:*.github.com)` | Any GitHub subdomain |
| `MCP(github:*)` | Any tool from github MCP server |
| `Task(planner)` | Only the planner subagent |
| `Agent(*)` | Any agent type |

## Key Settings

### Behavior

```json
{
  "outputStyle": "Explanatory",
  "fastMode": false,
  "prefersReducedMotion": false,
  "fileSuggestion": true
}
```

Output styles: `"Concise"`, `"Explanatory"`, `"Learning"`, `"Custom:<instructions>"`

### Context & Compaction

```json
{
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "80"
  }
}
```

Default auto-compact triggers at ~95%. Set lower for proactive compaction. `50` is good for long sessions.

### Plans Directory

```json
{
  "plansDirectory": ".claude/plans"
}
```

Stores plan mode artifacts for team sharing and review.

### Status Line

```json
{
  "statusLine": "model branch tokens"
}
```

Shows model, git branch, and token usage in the status bar. Customize via `/statusline`.

### Spinner Customization

```json
{
  "spinnerVerbs": ["Thinking", "Analyzing", "Crafting", "Brewing"],
  "spinnerTipsOverride": [
    "Tip: Use /compact at task boundaries",
    "Tip: Plan mode for >3 files",
    "Tip: Ctrl+B sends tasks to background"
  ]
}
```

### Attribution

```json
{
  "attribution": {
    "commitMessage": "",
    "prDescription": ""
  }
}
```

Set to empty strings to disable "Co-Authored-By" and PR footers.

### Sandbox

```json
{
  "sandbox": {
    "filesystem": {
      "allow": ["/home/user/project"],
      "deny": ["/etc", "/root"]
    },
    "network": {
      "allowDomains": ["api.github.com", "registry.npmjs.org"],
      "denyDomains": ["*"]
    }
  }
}
```

### MCP Server Approval

```json
{
  "enableAllProjectMcpServers": false,
  "enabledMcpjsonServers": ["context7", "playwright"],
  "disabledMcpjsonServers": ["unused-server"]
}
```

### Budget Control

Via CLI flags (not settings.json):
```bash
claude --max-budget-usd 5.00
claude --max-turns 50
```

## Production-Ready Example

See `settings.example.json` in the repo root for a full working configuration.

## Scope: What Lives Where

| Feature | Global Only | Dual Scope |
|---------|:-----------:|:----------:|
| Tasks & Task Lists | Y | |
| Agent Teams | Y | |
| Auto Memory | Y | |
| Credentials/Auth | Y | |
| Keybindings | Y | |
| MCP
... (truncated)
```
