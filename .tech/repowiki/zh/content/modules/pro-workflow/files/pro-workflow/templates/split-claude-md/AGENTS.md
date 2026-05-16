# pro-workflow/templates/split-claude-md/AGENTS.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：49

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Agent Workflow Rules

## Planning
For any task that touches more than 3 files or involves architectural decisions:
1. Enter plan mode first
2. Present implementation plan
3. Wait for explicit "proceed" or "go ahead"
4. Execute step by step

## Subagent Usage
Use Task tool (subagents) for:
- Parallel file exploration
- Background long-running operations
- Independent research tasks

Provide subagents with:
- Clear, specific objective
- Relevant file paths
- Success criteria

Avoid subagents for:
- Simple single-file reads
- Sequential dependent operations

## Context Management
- Always read files before editing
- Compact at task boundaries, not mid-work
- Summarize complex explorations

## Quality Gates
After ANY code edit, before marking complete:
1. Run lint: `npm run lint`
2. Run typecheck: `npm run typecheck`
3. Run related tests: `npm test -- --related`

## Session Wrap-Up
On "/wrap-up" command:
1. Review all changes made this session
2. Check for uncommitted changes
3. Verify tests pass
4. Update LEARNED.md with new patterns
5. Create session summary

## Self-Correction Loop
When user corrects me:
1. Acknowledge the correction
2. Propose addition to LEARNED.md
3. Apply after approval

```
