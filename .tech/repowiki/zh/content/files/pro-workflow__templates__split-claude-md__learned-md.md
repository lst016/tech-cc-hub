# pro-workflow/templates/split-claude-md/LEARNED.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：32

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# Learned Patterns

This file is auto-populated through the self-correction loop.
When Claude makes a mistake and gets corrected, the lesson goes here.

## Format

### [Date] - Category: [Brief Title]
**Mistake:** What went wrong
**Correction:** What should have happened
**Rule:** The pattern to follow going forward

---

## Examples

### 2025-01-15 - Testing: Always run related tests
**Mistake:** Made changes to utility function without running tests
**Correction:** User pointed out tests were broken
**Rule:** After editing any .ts file, run `npm test -- --related` before marking complete

### 2025-01-20 - Git: Don't commit sensitive files
**Mistake:** Almost committed .env file
**Correction:** User caught in review
**Rule:** Never stage .env, credentials.*, or *.pem files. Check `git status` carefully.

---

## Active Patterns

(Add patterns below as they're learned)

```
