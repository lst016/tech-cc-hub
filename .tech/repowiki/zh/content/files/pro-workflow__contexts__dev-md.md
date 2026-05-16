# pro-workflow/contexts/dev.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：23

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Development Mode

Switch to this context when actively building features.

## Mindset
- Code first, explain after
- Working > perfect
- Iterate quickly

## Priorities
1. Get it working
2. Get it right
3. Get it clean

## Behavior
- Run tests after changes
- Keep commits atomic
- Use plan mode for >3 files
- Quality gates before commit

## Trigger
Say: "Switch to dev mode" or "Let's build"

```
