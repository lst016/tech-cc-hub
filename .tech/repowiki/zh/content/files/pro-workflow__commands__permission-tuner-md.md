# pro-workflow/commands/permission-tuner.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：33

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Analyze permission denial patterns and generate optimized allow/deny rules to reduce prompt fatigue
---

# /permission-tuner - Permission Optimization

Analyze your permission patterns and generate rules to reduce prompt fatigue.

## Quick Start

Run this command to:
1. Scan permission denial history
2. Identify safe patterns for auto-approval
3. Generate optimized rules
4. Present for your approval

## What It Does

Reads your session's permission patterns and categorizes them:

- **Safe to auto-approve**: Read-only operations (Read, Glob, Grep, git status/diff/log)
- **Consider auto-approving**: Frequently approved operations (Edit, npm test)
- **Keep asking**: Operations that need review (git commit, npm install)
- **Auto-deny**: Dangerous operations (rm -rf, git push --force)

## Usage

```text
/permission-tuner
```

After running, review the suggested rules and apply the ones you want.

```
