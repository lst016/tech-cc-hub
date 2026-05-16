# pro-workflow/docs/cross-agent-workflows.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：177

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Cross-Agent Workflows

How to use pro-workflow patterns across Claude Code, Cursor, Codex, and other AI coding agents.

## The Layered Approach

The most productive teams in 2026 don't choose one tool — they layer them:

| Layer | Tool | Strength |
|-------|------|----------|
| Editor | Cursor / VS Code + Copilot | Tab completions, inline edits, visual diffs |
| Terminal | Claude Code / Codex CLI | Deep reasoning, multi-file changes, CI/CD |
| Background | Cursor Background Agents | Long-running tasks, PR creation |
| Review | Claude Code reviewer agent | Security audit, code quality |

### Common Setup

```text
Cursor for daily coding (tab completions, inline edits)
  └── Claude Code in Cursor's terminal (hard problems, refactors)
      └── Subagents for parallel exploration
```

The overlap in capabilities is worth the combined cost.

## Configuration Mapping

### Claude Code → Cursor

| Claude Code | Cursor Equivalent |
|-------------|-------------------|
| `CLAUDE.md` | `.cursorrules` or `.cursor/rules/*.mdc` |
| `.claude/settings.json` | `.cursor/settings.json` |
| `.claude/agents/*.md` | `.cursor/agents/*.md` (v2.4+) |
| `.claude/skills/*/SKILL.md` | `.cursor/skills/*/SKILL.md` (v2.4+) |
| `.claude/commands/*.md` | Built-in `/` commands |
| `hooks.json` | Not supported (use rules instead) |
| `.mcp.json` | `.cursor/mcp.json` |

### Claude Code → Codex CLI

| Claude Code | Codex Equivalent |
|-------------|-----------------|
| `CLAUDE.md` | `AGENTS.md` |
| Settings | `codex.json` |
| Agents | Not supported |
| Skills | Not supported |
| Hooks | Not supported |
| MCP | Supported via config |

### Claude Code → Gemini CLI

| Claude Code | Gemini Equivalent |
|-------------|-------------------|
| `CLAUDE.md` | `GEMINI.md` |
| Settings | `gemini.json` |
| Agents | Not supported |
| Skills | Not supported |

## Pro-Workflow on Each Agent

### Claude Code (Full Support)

Everything works: commands, agents, skills, hooks, rules, contexts, MCP config.

```bash
/plugin marketplace add rohitg00/pro-workflow
/plugin install pro-workflow@pro-workflow
```

### Cursor (Skills + Rules)

Uses skills (.mdc rules) instead of hooks. Same patterns, different enforcement.

```bash
/add-plugin pro-workflow
```

What loads:
- 9 skills (pro-workflow, smart-commit, wrap-up, learn-rule, etc.)
- 6 rules (quality-gates, atomic-commits, context-discipline, etc.)
- 3 agents (planner, reviewer, scout)

### Other Agents (via SkillKit)

```bash
npx skillkit install pro-workflow
npx skillkit translate pro-workflow --agent codex
npx skillkit translate pro-workflow --agent gemini-cli
npx skillkit translate pro-workflow --agent windsurf
```

SkillKit translates the SKILL.md format to each agent's native format.

## Shared Patterns That Work Everywhere

These patterns are agent-agnostic:

### 1. Self-Correction Loop
Works in any agent that reads a memory file. Add to CLAUDE.md / .cursorrules / AGENTS.md:
```markdown
When corrected, propose a rule. After approval, append to LEARNED section.
```

### 2. Plan Before Multi-File Changes
Universal pattern. Every agent benefits from planning mode:
- Claude Code: `Shift+Tab` to plan mode
- Cursor: Agent mode with planning prompt
- Codex: Start with "plan this before implementing"

### 3. Quality Gates Before Commit
Add to any agent's rules:
```markdown
Before committing: run lint, typecheck, and tests. Fix failures before proceeding.
```

### 4. Context Management
Every agent has finite context. The discipline is the same:
- Read before edit
- Compact/clear at task boundaries
- Delegate heavy exploration to subagents
- Keep <10 MCP servers, <80 tools

### 5. Session Handoffs
End sessions intentionally. Capture state for the next session:
```markdown
When ending a session:
1. List what's done, in progress, and pending
2. Note any decisions made and why
3. Write a one-line resume prompt for next session
```

## Background Agent Patterns

### Claude Code
```bash
Ctrl+B          # Send to background
claude -w       # Worktree for parallel session
```

### Cursor
Background agents run on isolated VMs. They can:
- Work on separate branches
- Open PRs for review
- Record video of their work
- Run indefinitely

### Whe
... (truncated)
```
