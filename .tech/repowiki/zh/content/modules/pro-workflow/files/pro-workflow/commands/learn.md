# pro-workflow/commands/learn.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：259

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# /learn - Claude Code Best Practices & Learning Capture

Learn Claude Code best practices and capture lessons into persistent memory.

## Usage

- `/learn` — Show best practices guide
- `/learn <topic>` — Show practices for a specific topic (e.g., `/learn context`, `/learn prompting`)
- `/learn save` — Capture a lesson from this session into the database

## Best Practices

### Sessions & Context
- Every Claude Code invocation is a session. Claude reads your project on start.
- Context window is finite (200k tokens). Use `/context` to check usage.
- Use `/compact` at task boundaries — after planning, after a feature, when >70%.
- Don't compact mid-task. You lose working context.
- Plan mode now survives compaction (fixed in 2.1.49).
- **Docs:** https://code.claude.com/docs/common-workflows
- **Pattern:** Context Discipline (Pattern 7)

### CLAUDE.md & Memory
- CLAUDE.md is persistent project memory. It loads every session.
- Put: project structure, build commands, conventions, constraints, gotchas.
- Don't put: entire file contents, obvious things, rapidly changing info.
- For complex projects, split into AGENTS.md, SOUL.md, LEARNED.md.
- **Docs:** https://code.claude.com/docs/settings
- **Pattern:** Split Memory (Pattern 4)

### Modes
- **Normal** — Claude asks before edits (default)
- **Auto-Accept** — Claude edits without asking (trusted iteration)
- **Plan** — Research first, then propose plan (complex tasks)
- **Simple** — Bash + Edit tools only (lightweight, no extra overhead)
- Use Plan mode when: >3 files, architecture decisions, multiple approaches, unclear requirements.
- Toggle with `Shift+Tab`.
- **Docs:** https://code.claude.com/docs/common-workflows
- **Pattern:** 80/20 Review (Pattern 5)

### CLI Shortcuts
| Shortcut | Action |
|----------|--------|
| `Shift+Tab` | Cycle modes (Normal/Auto-Accept/Plan) |
| `Ctrl+L` | Clear screen |
| `Ctrl+C` | Cancel generation |
| `Ctrl+B` | Run task in background |
| `Ctrl+F` | Kill all background agents (two-press confirmation) |
| `Ctrl+T` | Toggle task list (agent teams) |
| `Shift+Down` | Navigate teammates (wraps around) |
| `Up/Down` | Prompt history |
| `/compact` | Compact context |
| `/context` | Check context usage |
| `/clear` | Clear conversation |
| `/agents` | Manage subagents |
| `/model` | Switch models |
| `/commit` | Smart commit with quality gates |
| `/insights` | Session analytics and patterns |
- **Docs:** https://code.claude.com/docs/cli-reference

### Worktrees
Native worktree support (2.1.49+):
```bash
claude --worktree    # or claude -w
```
Creates an isolated git worktree automatically. Subagents support `isolation: worktree` in frontmatter.

### Prompting
Good prompts have four parts:
1. **Scope** — What files/area to work in
2. **Context** — Background info Claude needs
3. **Constraints** — What NOT to do
4. **Acceptance criteria** — How to know it's done

Bad: "Add rate limiting"
Good: "In src/auth/, add rate limiting to the login endpoint. We use Express with Redis. Don't change session middleware. Return 429 after 5 failed attempts per IP in 15 min."

### Writing Rules
Rules in CLAUDE.md prevent Claude from going off-track.
- Good: "Always use snake_case for database columns"
- Good: "Run pytest -x after any Python file change"
- Bad: "Write good code"
- Bad: "Be careful"
- **Pattern:** Self-Correction Loop (Pattern 1)

### Skills
Skills are reusable commands defined in markdown with frontmatter. Create one when you repeat the same prompt pattern >3 times.
- **Docs:** https://code.claude.com/docs/settings
- **Pattern:** Learning Log (Pattern 8)

### Subagents
Subagents run in separate context windows for parallel work.
- Use for: parallel exploration, background tasks, independent research.
- Avoid for: single-file reads, tasks needing conversation context.
- Press `Ctrl+B` to send tasks to background.
- Press `Ctrl+F` to kill all background agents (two-press confirmation).
- ESC cancels the main thread only; background agents keep running.
- Create custom subagents in `.claude/agents/` (project) or `~/.claude/agents/` (user).
- Subagents support: custom tools, permission modes, persistent memory, hooks, skill preloading, and **worktree is
... (truncated)
```
