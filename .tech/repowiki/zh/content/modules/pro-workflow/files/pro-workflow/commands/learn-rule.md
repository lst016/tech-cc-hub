# pro-workflow/commands/learn-rule.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：61

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# /learn-rule - Extract Correction to Memory

Capture a lesson from this session into permanent memory.

## Process

1. **Identify the lesson**
   - What mistake was made?
   - What should happen instead?

2. **Format the rule**
   ```
   [LEARN] Category: One-line rule
   ```

   Categories:
   - Navigation (file paths, finding code)
   - Editing (code changes, patterns)
   - Testing (test approaches)
   - Git (commits, branches)
   - Quality (lint, types, style)
   - Context (when to clarify)
   - Architecture (design decisions)
   - Performance (optimization)
   - Claude-Code (sessions, modes, CLAUDE.md, skills, subagents, hooks, MCP)
   - Prompting (scope, constraints, acceptance criteria)

3. **Propose addition**
   Show what will be added to LEARNED section.

4. **Wait for approval**
   Only add after user confirms.

## Example

```
Recent mistake: Edited wrong utils.ts file

[LEARN] Navigation: Confirm full path when multiple files share a name.

Add to LEARNED section? (y/n)
```

---

## Claude Code Examples

```
[LEARN] Claude-Code: Use plan mode before multi-file changes.
Docs: https://code.claude.com/docs/common-workflows

[LEARN] Claude-Code: Compact context at task boundaries, not mid-work.
Docs: https://code.claude.com/docs/common-workflows

[LEARN] Prompting: Always include acceptance criteria in prompts.
```

---

**Trigger:** Use when user says "remember this", "add to rules", or after making a mistake.

```
