# pro-workflow/rules/atomic-commits.mdc

> 模块：`pro-workflow` · 语言：`unknown` · 行数：17

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```unknown
---
description: Git best practices - atomic commits, descriptive messages, feature branches
alwaysApply: true
---

Make atomic commits. Each commit should represent one logical change.

Write descriptive commit messages in conventional format: `<type>(<scope>): <summary>`

Types: feat, fix, refactor, test, docs, chore, perf, ci, style

Always work on feature branches. Never commit directly to main.

Review changes before pushing. Run `git diff --stat` to verify what's staged.

Stage specific files by name. Avoid `git add -A` or `git add .` which can include sensitive files.

```
