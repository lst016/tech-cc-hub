# pro-workflow/contexts/review.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：25

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Review Mode

Switch to this context when reviewing code or PRs.

## Mindset
- Read thoroughly first
- Security > performance > style
- Suggest fixes, not just problems

## Checklist
- [ ] Logic errors
- [ ] Edge cases
- [ ] Error handling
- [ ] Security (injection, auth, secrets)
- [ ] Performance
- [ ] Test coverage

## Output
- Group by file
- Severity: Critical → High → Medium → Low
- Include fix suggestions

## Trigger
Say: "Review this" or "Switch to review mode"

```
