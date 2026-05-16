# pro-workflow/docs/cli-cheatsheet.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：183

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# CLI Cheatsheet

Every CLI flag and keyboard shortcut organized by workflow.

## Startup Flags

### Session Management

```bash
claude                       # New session
claude --continue            # Continue last session
claude --resume              # Pick from recent sessions
claude --from-pr 123         # Start from a PR's context
claude --session-id <id>     # Resume specific session
claude --fork-session <id>   # Fork an existing session
```

### System Prompt

```bash
claude --system-prompt "You are a Go expert"
claude --system-prompt-file ./prompts/go.md
claude --append-system-prompt "Also run tests after changes"
```

### Agent & Subagent Control

```bash
claude --agent researcher        # Run with specific agent
claude --agents '{"name":"researcher","tools":["Read","Grep"]}'
claude --teammate-mode           # Launch as a teammate in agent teams
```

### Permission Control

```bash
claude --permission-mode plan    # Force plan mode
claude --allowedTools Read,Grep  # Whitelist specific tools
claude --disallowedTools Bash    # Blacklist tools
```

### Output & Scripting

```bash
claude --print "explain this code"      # One-shot, no interactive
claude --output-format json             # JSON output for scripting
claude --json-schema '{"type":"object"}'  # Structured output
claude --verbose                        # Debug output
```

### Budget & Limits

```bash
claude --max-budget-usd 5.00    # Cap spending
claude --max-turns 50           # Limit conversation turns
```

### Workspace

```bash
claude --worktree        # or -w: auto-create git worktree
claude --add-dir ../lib  # Add extra directory to context
```

### MCP & Plugins

```bash
claude --mcp-config ./mcp.json     # Load MCP config
claude --strict-mcp-config         # Fail if MCP server errors
claude --plugin-dir ./my-plugin    # Load a plugin directory
```

### Integration

```bash
claude --chrome           # Enable Chrome integration
claude --no-chrome        # Disable Chrome integration
claude --ide vscode       # Set IDE context
```

## Keyboard Shortcuts

### During Prompting

| Key | Action |
|-----|--------|
| `Enter` | Submit prompt |
| `Shift+Tab` | Cycle modes (Normal > Auto > Plan) |
| `Ctrl+C` | Cancel current generation |
| `Ctrl+L` | Clear screen |
| `Ctrl+B` | Send current task to background |
| `Ctrl+F` | Kill all background agents (two-press) |
| `Up/Down` | Navigate prompt history |
| `Esc Esc` | Rewind to last checkpoint |

### Agent Teams

| Key | Action |
|-----|--------|
| `Shift+Down` | Navigate between teammates (wraps) |
| `Shift+Tab` | Toggle delegate mode |

## Slash Commands

### Session

| Command | Purpose |
|---------|---------|
| `/clear` | Reset conversation |
| `/compact` | Compress context (do at task boundaries) |
| `/context` | Show context window usage |
| `/resume` | Resume a previous session |
| `/rename` | Rename current session |
| `/cost` | Show session cost (API key users) |
| `/usage` | Check plan limits |
| `/extra-usage` | Pay-as-you-go overflow billing |

### Modes & Models

| Command | Purpose |
|---------|---------|
| `/model` | Switch model or effort level |
| `/fast` | Toggle fast mode |
| `/voice` | Toggle voice mode (hold spacebar to talk) |

### Project

| Command | Purpose |
|---------|---------|
| `/permissions` | Manage tool permissions |
| `/agents` | Create and manage subagents |
| `/memory` | View/edit auto memory |
| `/doctor` | Diagnose configuration issues |

### Configuration

| Command | Purpose |
|---------|---------|
| `/config` | Open settings |
| `/terminal-setup` | Configure terminal |
| `/statusline` | Customize status bar |
| `/keybindings` | Customize keyboard shortcuts |
| `/sandbox` | Configure sandboxing |
| `/vim` | Toggle vim keybindings |

### Export & Debug

| Command | Purpose |
|---------|---------|
| `/export` | Export conversation |
| `/debug` | Toggle debug mode |
| `/rewind` | Rewind to checkpoint |

## Scripting Patterns

### One-Shot Execution

```bash
echo "explain this error" | claude --print
```

### Capture Session ID

```bash
SESSION_ID=$(claude --output-format json --print "fix the bug" | jq -r '.session_id')
claude --session-id "$SESSION_ID" --print "now add test
... (truncated)
```
