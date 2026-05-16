# pro-workflow/docs/orchestration-patterns.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：295

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Orchestration Patterns

How to wire Commands, Agents, and Skills together for complex workflows.

## The Three Layers

```text
Command (entry point, user-facing)
  └── Agent (execution, constrained tools)
        └── Skill (domain knowledge, preloaded)
```

Each layer has a single responsibility:
- **Commands** handle user interaction and parameter collection
- **Agents** execute workflows with constrained tool access
- **Skills** provide domain-specific knowledge and procedures

## Pattern 1: Command > Agent > Skill

The most powerful pattern. A slash command delegates to an agent that has skills preloaded.

### Example: Feature Builder

**Command** (`commands/build-feature.md`):
```markdown
---
description: Build a feature end-to-end with planning, implementation, and tests
argument-hint: <feature description>
---

Build this feature using a structured approach:

1. Delegate to the planner agent to create a plan
2. Wait for plan approval
3. Implement the plan
4. Run quality gates
5. Create a commit

Feature: $ARGUMENTS
```

**Agent** (`agents/planner.md`):
```yaml
---
name: planner
description: Break down tasks into plans
tools: ["Read", "Glob", "Grep"]
skills: ["api-conventions", "project-patterns"]
model: opus
---
```

**Skill** (`skills/api-conventions/SKILL.md`):
```yaml
---
name: api-conventions
description: API design patterns for this project
user-invocable: false
---

REST endpoints use camelCase. Auth via Bearer tokens.
Error responses follow RFC 7807.
```

### How It Flows

1. User runs `/build-feature add user preferences`
2. Command expands `$ARGUMENTS` and delegates to planner agent
3. Planner loads with `api-conventions` skill already in context
4. Planner explores code, produces plan using skill knowledge
5. Control returns to command for approval
6. Implementation proceeds with full context

## Pattern 2: Multi-Phase Development (RPI)

Research > Plan > Implement with validation gates between phases.

### Structure

```text
.claude/
├── commands/
│   └── develop.md          # Entry point
├── agents/
│   ├── researcher.md       # Phase 1: explore and validate
│   ├── architect.md        # Phase 2: design
│   └── implementer.md      # Phase 3: build
└── skills/
    └── project-patterns/
        └── SKILL.md         # Shared knowledge
```

### The Flow

```text
/develop "add webhook support"
    │
    ▼
[Research Phase] → researcher agent
    │  - Explore existing code
    │  - Find similar patterns
    │  - Check dependencies
    │  - Score confidence (0-100)
    │
    ├── Score < 70 → HOLD (ask user for more context)
    │
    ▼
[Plan Phase] → architect agent
    │  - Design the solution
    │  - List all files to change
    │  - Identify risks
    │  - Present plan for approval
    │
    ├── User rejects → Back to research
    │
    ▼
[Implement Phase] → implementer agent
    │  - Execute the plan step by step
    │  - Run tests after each step
    │  - Quality gates at checkpoints
    │
    ▼
[Verify] → reviewer agent
    │  - Code review the changes
    │  - Security check
    │  - Performance check
    │
    ▼
[Commit] → /commit command
```

### Researcher Agent

```yaml
---
name: researcher
description: Explore codebase to assess feasibility before implementation
tools: ["Read", "Glob", "Grep", "Bash"]
background: true
isolation: worktree
memory: project
---
```

Key: runs in background with worktree isolation so it doesn't block the main session.

### Architect Agent

```yaml
---
name: architect
description: Design implementation plans with risk assessment
tools: ["Read", "Glob", "Grep"]
skills: ["project-patterns"]
model: opus
---
```

Key: read-only tools, Opus model for deep reasoning, preloaded project patterns.

## Pattern 3: Agent Skills vs On-Demand Skills

Two ways to use skills — understand when to use each.

### Agent Skills (Preloaded)

```yaml
# In agent frontmatter
skills: ["api-conventions", "error-handling"]
```

- Full skill content injected into agent context at startup
- Always available, no invocation needed
- Use for: domain knowledge the agent always needs
- Cost: uses context tokens

### On-Demand Skills (Invoked)

```yaml
# In skill frontmatter
user-invocable: true
```

- Use
... (truncated)
```
