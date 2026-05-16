# pro-workflow/commands/auto-setup.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：30

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
description: Auto-detect project type and configure quality gates, permissions, and hooks for a new codebase
---

# /auto-setup - Project Configuration

Automatically detect your project type and set up pro-workflow quality gates.

## Quick Start

Run in any project to:
1. Detect project type (Node.js, Python, Rust, Go)
2. Configure lint/typecheck/test commands
3. Set up safe permission rules
4. Verify tooling is installed

## Supported Project Types

- **Node.js/TypeScript** — npm/pnpm/yarn, ESLint, TypeScript, Jest/Vitest
- **Python** — pip/poetry, ruff/flake8, mypy, pytest
- **Rust** — cargo, clippy, cargo test
- **Go** — go vet, golangci-lint, go test
- **Mixed/Monorepo** — detects multiple types

## Usage

```
/auto-setup
```

```
