---
description: Turn a rough request into a concrete goal, scope, acceptance criteria, and next actions.
---

# /goal-plan

You are helping the user turn an ambiguous or broad request into an executable goal for the current `tech-cc-hub` workspace.

User input:

```text
$ARGUMENTS
```

## Output Rules

- Answer in Chinese unless the user explicitly asks for English.
- Be concrete and implementation-ready. Avoid generic advice.
- If the goal is already clear, do not ask questions; state the goal and proceed.
- Ask at most 3 clarification questions only when missing information would make execution risky.
- Prefer the current repository context over abstract best practices.
- Preserve user constraints and latest instructions exactly.

## Required Output Shape

### 1. Goal

State the goal in one precise sentence.

### 2. Scope

List what is in scope and what is out of scope.

### 3. Acceptance Criteria

List observable checks that prove the task is done.

### 4. Execution Order

Give the smallest safe sequence of steps to implement or verify the goal.

### 5. Risks

Name likely blockers, especially:

- UI state vs Electron main/preload hot reload
- runtime config vs source config
- stale worktree or existing user changes
- missing browser/Electron verification

### 6. Next Step

End with the immediate next action the agent should take.
