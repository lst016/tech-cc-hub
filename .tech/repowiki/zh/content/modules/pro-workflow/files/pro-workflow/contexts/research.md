# pro-workflow/contexts/research.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：24

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Research Mode

Switch to this context when exploring or investigating.

## Mindset
- Explore broadly first
- Summarize findings
- Don't change code yet

## Behavior
- Use Grep, Glob, Read extensively
- Take notes on patterns found
- Propose plan before acting
- Ask clarifying questions

## Output
- Summary of findings
- Key files identified
- Proposed next steps
- Open questions

## Trigger
Say: "Research this" or "Help me understand"

```
