# pro-workflow/commands/wrap-up.md

> 模块：`pro-workflow` · 语言：`markdown` · 行数：46

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```markdown
# /wrap-up - Session Wrap-Up

End your Claude Code session with intention.

## Execute This Checklist

### 1. Changes Audit
```bash
git status
git diff --stat
```
- What files were modified?
- Any uncommitted changes?
- Any TODOs left in code?

### 2. Quality Check
```bash
npm run lint 2>&1 | head -20
npm run typecheck 2>&1 | head -20
npm test -- --changed --passWithNoTests
```
- All checks passing?
- Any warnings to address?

### 3. Learning Capture
- What mistakes were made this session?
- What patterns worked well?
- Any corrections to add to LEARNED?

Format: `[LEARN] Category: Rule`

### 4. Next Session Context
- What's the next logical task?
- Any blockers to note?
- Context to preserve for next time?

### 5. Summary
Write one paragraph:
- What was accomplished
- Current state
- What's next

---

**After completing checklist, ask:** "Ready to end session?"

```
