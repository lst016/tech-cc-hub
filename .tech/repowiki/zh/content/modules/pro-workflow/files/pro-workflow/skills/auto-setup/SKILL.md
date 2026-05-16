# pro-workflow/skills/auto-setup/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：103

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: auto-setup
description: Auto-configure quality gates, hooks, and settings for a new project. Detects project type and sets up appropriate tooling. Use when onboarding a new codebase.
---

# Auto Setup

Detect project type and configure pro-workflow quality gates automatically.

## Trigger

Use when:
- Starting work on a new project
- Onboarding to an unfamiliar codebase
- Setting up CI integration

## Detection

### Step 1: Identify Project Type

```bash
ls package.json pyproject.toml Cargo.toml go.mod Gemfile pom.xml build.gradle 2>/dev/null
```

### Step 2: Configure Quality Gates

**Node.js/TypeScript:**
```json
{
  "lint": "npm run lint",
  "typecheck": "npx tsc --noEmit",
  "test": "npm test -- --changed --passWithNoTests",
  "format": "npx prettier --check ."
}
```

**Python:**
```json
{
  "lint": "ruff check .",
  "typecheck": "mypy .",
  "test": "pytest --tb=short -q",
  "format": "ruff format --check ."
}
```

**Rust:**
```json
{
  "lint": "cargo clippy -- -D warnings",
  "typecheck": "cargo check",
  "test": "cargo test --quiet",
  "format": "cargo fmt --check"
}
```

**Go:**
```json
{
  "lint": "golangci-lint run",
  "typecheck": "go vet ./...",
  "test": "go test ./... -count=1",
  "format": "gofmt -l ."
}
```

### Step 3: Verify Tools Are Installed

Run each command with `--version` or `--help` to confirm availability. Report missing tools.

### Step 4: Create Configuration

Generate a `.claude/settings.json` with:
- Quality gate commands for the detected project type
- Safe permission rules (read-only tools auto-approved)
- Hook configuration for the project

## Output

```text
AUTO SETUP
  Project type: [Node.js/Python/Rust/Go/Mixed]
  Package manager: [npm/pnpm/yarn/pip/cargo]

  Quality gates configured:
    lint:      [command] ✓
    typecheck: [command] ✓
    test:      [command] ✓
    format:    [command] ✓

  Missing tools:
    - [tool] — install with: [command]

  Settings written to: .claude/settings.json
```

## Rules

- Never overwrite existing settings without asking
- Detect, don't assume — check for tool presence
- Support monorepos (check for workspaces config)
- Report missing tools with install commands

```
