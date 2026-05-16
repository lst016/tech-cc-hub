# pro-workflow/skills/batch-orchestration/SKILL.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：156

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
---
name: batch-orchestration
description: Decompose large-scale changes into independent units and spawn parallel agents in isolated worktrees. Use for migrations, refactors, codemods, and any change touching 10+ files with the same pattern.
---

# Batch Orchestration

The `/batch` command pattern for large-scale parallel changes.

## How It Works

```text
/batch <instruction>
  │
  ├── 1. Research: scan repo, understand scope
  ├── 2. Decompose: split into 5-30 independent units
  ├── 3. Present plan: show units, ask for approval
  ├── 4. Execute: one background agent per unit in isolated worktree
  └── 5. Collect: each agent runs tests and opens a PR
```

## Syntax

```bash
/batch Convert all React class components to function components
/batch Add error boundaries to every page component
/batch Migrate from moment.js to dayjs across the codebase
/batch Add OpenTelemetry tracing to all API handlers
```

The instruction should describe the change pattern, not individual files. The batch system finds the files.

## Phase 1: Research

The orchestrator scans the repo to find every instance that matches the instruction:

```bash
grep -r "class.*extends.*Component" --include="*.tsx" -l
```

It builds a complete list of targets and groups them by independence.

## Phase 2: Decompose

Each unit must be:

- **Independent** — no shared state with other units
- **Self-contained** — can be implemented and tested alone
- **Verifiable** — has a clear pass/fail criteria

**Good units:**
```text
Unit 1: Convert src/components/Header.tsx (class → function)
Unit 2: Convert src/components/Footer.tsx (class → function)
Unit 3: Convert src/components/Sidebar.tsx (class → function)
```

**Bad units:**
```text
Unit 1: Convert all components in src/components/ (too broad)
Unit 2: Fix issues from Unit 1 (dependent)
```

Target 5-30 units. Fewer than 5 doesn't justify the overhead. More than 30 and coordination costs grow.

## Phase 3: Plan Approval

The orchestrator presents:

```text
BATCH: Convert class components to function components

Found: 18 class components across src/

Units (18):
  1. src/components/Header.tsx — class Header → function
  2. src/components/Footer.tsx — class Footer → function
  ...
  18. src/pages/Settings.tsx — class Settings → function

Per unit: convert class to function, update hooks, run component tests
Estimated: ~2 min per unit, ~5 min total (parallel)

Proceed? (y/n)
```

**Wait for approval.** Never spawn agents without explicit confirmation.

## Phase 4: Execute

After approval, for each unit:

1. Create isolated git worktree
2. Spawn background agent in that worktree
3. Agent implements the change
4. Agent runs relevant tests
5. Agent opens a PR

Agents run in parallel. Each has its own context window and worktree — no conflicts.

```text
[Agent 1] ── worktree-1 ── Header.tsx ── tests pass ── PR #41
[Agent 2] ── worktree-2 ── Footer.tsx ── tests pass ── PR #42
[Agent 3] ── worktree-3 ── Sidebar.tsx ── tests fail ── flagged
```

## Phase 5: Collect

After all agents complete:

- Summary of pass/fail per unit
- Links to opened PRs
- Any units that failed with error details
- Failed units can be retried individually

## Best For

| Use Case | Why Batch Works |
|----------|-----------------|
| API migrations | Same pattern across many endpoints |
| Dependency upgrades | Find/replace + fix across codebase |
| Codemod-style refactors | Mechanical transformation, file by file |
| Adding instrumentation | Same tracing/logging pattern everywhere |
| Test coverage gaps | Add tests to untested modules independently |
| Lint rule adoption | Apply new rule fixes across all files |

## Anti-Patterns

| Don't Batch | Why |
|-------------|-----|
| Interdependent changes | Units can't run in parallel if they depend on each other |
| Shared state modifications | Multiple agents writing to the same config or state file |
| Architecture changes | Need holistic reasoning, not file-by-file |
| Schema migrations | Database changes must be sequential |
| Changes requiring human judgment per file | Defeats the purpose of automation |

## Relationship to Other Patterns

| Pattern | Scale | Isolation |
|---------|-------|-----------|
... (truncated)
```
