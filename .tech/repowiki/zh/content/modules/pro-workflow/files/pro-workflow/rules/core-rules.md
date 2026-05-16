# pro-workflow/rules/core-rules.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：60

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Core Rules

Universal rules for any project. Add to CLAUDE.md or use as reference.

## Quality
- Run lint/typecheck before commit
- Test affected code
- No console.log in production
- No hardcoded secrets

## Git
- Atomic commits
- Descriptive messages
- Feature branches, not main
- Review before push

## Context
- Read before edit — never write a file you haven't read
- No re-reads — don't re-read unchanged files
- Plan before multi-file
- Compact at milestones
- <10 MCPs enabled
- One-pass discipline: write complete solution, test, stop if green
- Tool-call budgets: 20 (quick fix), 30 (bug fix), 50 (feature), 80 (large)

## Learning
- Capture corrections: [LEARN] Category: Rule
- Update LEARNED.md
- Patterns compound over time

## Communication
- Concise > verbose
- Action > explanation
- Ask when unclear
- Acknowledge mistakes
- No sycophantic openers ("Sure!", "Great question!")
- No closing fluff ("Let me know if you need anything!")
- No prompt restatement before answering
- Code first, explanation after (only if non-obvious)
- ASCII only: -- not em dashes, " not smart quotes

## Performance
- Haiku for quick tasks
- Sonnet for features
- Opus for architecture
- Opus+Thinking for hard bugs

## Claude Code Mastery
Docs: https://code.claude.com/docs/
- Use plan mode for multi-file changes
- Write CLAUDE.md with structure, conventions, rules
- Manage context: /compact at task boundaries, /context to check usage
- Prompts need scope + context + constraints + acceptance criteria
- Build skills for repeated workflows (>3 repetitions)
- Delegate to subagents for parallel exploration
- Keep <10 MCPs, <80 tools
- Use hooks for automated quality gates
- Review security model before handling sensitive data
- See references/claude-code-resources.md for full guide

```
