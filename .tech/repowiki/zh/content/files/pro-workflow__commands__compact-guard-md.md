# pro-workflow/commands/compact-guard.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：36

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Smart context compaction with state preservation — saves critical state before compact and restores after
---

# /compact-guard - Protected Compaction

Protect your working context through compaction.

## Quick Start

Run before `/compact` to:
1. Save your current task state
2. Note which files you're editing (max 5 survive compaction)
3. Record decisions made this session
4. Compact safely
5. Restore critical context after

## When To Use

- Before manual `/compact`
- When you see auto-compact warnings
- At natural task boundaries

## Key Insight

Claude Code only restores **5 files** after compaction, with **5K tokens per file** and **50K total budget**. Plan accordingly:
- Prioritize the file you're actively editing
- Move exploration results to subagents
- Keep notes in a scratch file

## Usage

```text
/compact-guard
```

```
