# pro-workflow/templates/split-claude-md/COMMANDS.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：42

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Custom Commands

## /wrap-up
End of session review:
- Review all changes
- Check uncommitted work
- Verify tests pass
- Update learnings
- Create summary

## /plan
Enter planning mode for current task:
- Explore relevant files
- Identify all changes needed
- Present step-by-step plan
- Wait for approval

## /learn
Extract pattern from recent interaction:
- Identify the lesson
- Propose LEARNED.md addition
- Apply after approval

## /parallel
Suggest worktree setup for parallel work:
- Show current branches
- Suggest worktree commands
- Explain parallel workflow

## /quality
Run quality gates:
- Lint check
- Type check
- Related tests
- Report results

## /compact
Suggest strategic compaction:
- Summarize current context
- Identify what to preserve
- Recommend compaction point

```
