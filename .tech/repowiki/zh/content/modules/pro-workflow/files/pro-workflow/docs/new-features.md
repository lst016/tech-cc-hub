# pro-workflow/docs/new-features.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：199

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# New Claude Code Features (2026)

Latest capabilities and how to use them with pro-workflow.

## Voice Mode

Talk to Claude Code instead of typing. Rolling out to Pro, Max, Team, and Enterprise plans.

### Setup

```bash
/voice    # Toggle voice mode on/off
```

### Usage

- Hold **spacebar** to talk, release to transcribe
- Mix typed and spoken input in a single prompt
- Works alongside all other features (hooks still fire, modes still apply)

### When Voice Helps

| Scenario | Why Voice |
|----------|----------|
| Describing architecture | Faster than typing long descriptions |
| Quick fixes | "Fix the import on line 42" |
| Exploring ideas | Stream-of-consciousness brainstorming |
| Reviewing code | "Walk me through this function" |

### Pro-Workflow Integration

Voice mode works with all pro-workflow patterns. Corrections spoken verbally still trigger the self-correction loop if you say "remember that" or "add to rules".

## Agent Teams

Coordinate multiple Claude Code sessions working as a team.

### Enable

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

### How It Works

1. One session is the **lead** — coordinates work, assigns tasks
2. **Teammates** work independently in their own context windows
3. Teammates message each other directly (not just report to lead)
4. Shared task list with dependency tracking

### Display Modes

| Mode | How | Best For |
|------|-----|----------|
| In-process | `Shift+Down` to navigate | Quick coordination |
| Split panes | tmux or iTerm2 splits | Visual monitoring |

### Delegate Mode

Press `Shift+Tab` to toggle delegate mode. Lead orchestrates only, no direct code edits.

### Team Patterns

| Pattern | Lead | Teammate A | Teammate B |
|---------|------|-----------|-----------|
| Frontend/Backend | Coordinate | UI changes | API changes |
| Feature/Tests | Plan | Implementation | Test coverage |
| Competing hypotheses | Evaluate | Approach A | Approach B |
| Cross-layer | Integrate | Database | Application |

### Docs

https://code.claude.com/docs/agent-teams

## Checkpointing & Rewind

Claude Code automatically tracks checkpoints during your session.

### Usage

- **`Esc Esc`** — Rewind to the last checkpoint
- **`/rewind`** — Browse and select a checkpoint to restore
- Checkpoints are git-based — your code state is saved at each point

### When to Rewind

- Claude went down the wrong path
- An approach isn't working out
- You want to try a different solution
- Something broke that was previously working

### Pro-Workflow Integration

The `PreCompact` hook saves context state, which complements checkpointing. Between checkpoints (code state) and pre-compact saves (context state), you can recover from most mistakes.

## Remote Control

Continue sessions from phone, tablet, or browser.

### How It Works

- Start Claude Code on your machine
- Access it remotely via `--remote` flag
- Continue interacting from any device
- Session state persists

### Headless Mode

Run Claude Code without a terminal UI for CI/CD and automation:

```bash
claude --print "review and fix lint errors" --max-turns 10
```

## New Hook Events

Claude Code has expanded from 8 to 18+ hook event types.

### Newly Available

| Event | When | Use Case | In hooks.json |
|-------|------|----------|:-------------:|
| `SubagentStart` | Subagent spawns | Log agent activity, set up context | Yes |
| `SubagentStop` | Subagent finishes | Collect results, update metrics | Yes |
| `TaskCompleted` | Task marked complete | Quality gate on completion | Yes |
| `PermissionRequest` | Permission dialog | Flag dangerous operations | Yes |
| `PostToolUseFailure` | Tool use fails | Error tracking, retry logic | Yes |
| `TeammateIdle` | Team member goes idle | Force continuation, reassign | Yes |
| `ConfigChange` | Settings modified | Detect mid-session changes | Yes |
| `Setup` | Initial setup (30s timeout) | One-time initialization | No |
| `WorktreeCreate` | Worktree created | Set up worktree-specific config | No |
| `WorktreeRemove` | Worktree removed | Cleanup | No |

Events marked "No" are available in Claude Code but not configured in `hooks.json` by default. Add them to your `hooks.json` or `set
... (truncated)
```
