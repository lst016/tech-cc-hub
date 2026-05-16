# pro-workflow/config.json

> 模块：`pro-workflow` · 语言：`json` · 行数：48

## 文件职责

这是配置文件，定义构建、运行、依赖或工具行为。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "database": {
    "path": "~/.pro-workflow/data.db",
    "auto_init": true
  },
  "search": {
    "default_limit": 10,
    "highlight_matches": true
  },
  "self_correction": {
    "enabled": true,
    "auto_update_claude_md": false,
    "require_approval": true,
    "learned_file": "~/.claude/LEARNED.md"
  },
  "plan_mode": {
    "threshold_files": 3,
    "threshold_tool_calls": 10,
    "require_explicit_approval": true
  },
  "quality_gates": {
    "run_lint": true,
    "run_typecheck": true,
    "run_tests": true,
    "lint_command": "npm run lint",
    "typecheck_command": "npm run typecheck",
    "test_command": "npm test -- --related"
  },
  "wrap_up": {
    "check_uncommitted": true,
    "verify_tests": true,
    "update_claude_md": true,
    "create_summary": true
  },
  "parallel_sessions": {
    "suggest_worktrees": true,
    "worktree_prefix": "../",
    "native_worktree": true
  },
  "model_preferences": {
    "quick_fixes": "haiku",
    "features": "sonnet",
    "refactors": "opus",
    "architecture": "opus",
    "debugging": "opus"
  }
}

```
