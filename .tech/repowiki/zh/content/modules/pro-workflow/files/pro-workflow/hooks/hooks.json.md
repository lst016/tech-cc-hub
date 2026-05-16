# pro-workflow/hooks/hooks.json

> 模块：`pro-workflow` · 语言：`json` · 行数：387

## 文件职责

此页由 RepoWiki 从真实源码生成，用于让 Agent 快速定位文件职责、符号、依赖和可修改面。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "tool == \"Edit\" || tool == \"Write\"",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/quality-gate.js\""
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/read-before-write.js\""
          }
        ],
        "description": "Track edits for quality gate checks and read-before-write enforcement"
      },
      {
        "matcher": "Read",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/reread-tracker.js\""
          },
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/read-before-write.js\""
          }
        ],
        "description": "Track file reads to detect unnecessary re-reads and enable read-before-write enforcement"
      },
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/tool-call-budget.js\""
          }
        ],
        "description": "Track tool call count against budget thresholds"
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/git-blast-radius.js\""
          },
          {
            "type": "command",
            "if": "Bash(git commit*)",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/pre-commit-check.js\""
          },
          {
            "type": "command",
            "if": "Bash(git commit*)",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/commit-validate.js\""
          },
          {
            "type": "command",
            "if": "Bash(git push*)",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/pre-push-check.js\""
          }
        ],
        "description": "Git operation guards: quality gates before commit, LLM commit validation, wrap-up before push"
      },
      {
        "matcher": "tool == \"Edit\" || tool == \"Write\"",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/secret-scan.js\""
          }
        ],
        "description": "Deterministic regex-based secret detection on file writes and edits"
      }
    ],
    "PostToolUse": [
      {
        "matcher": "tool == \"Edit\" && tool_input.file_path matches \"\\\\.(ts|tsx|js|jsx|py|go|rs)$\"",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/post-edit-check.js\""
          }
        ],
        "description": "Check for common issues after code edits"
      },
      {
        "matcher": "tool == \"Bash\" && tool_input.command matches \"(npm test|pnpm test|yarn test|pytest|go test|cargo test)\"",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/test-failure-check.js\""
          }
        ],
        "description": "Suggest learning from test failures"
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-check.js\""
          }
        ],
        "description": "Context-aware wrap-up reminders using last_assistant_message"
      },
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/learn-capture.js\""
          }
        ],
        "description": "Auto-capture [LEARN] blocks from responses into database"
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/scripts/session-start.js\""
          }
        ],
        "description": "Load LEARNED patterns and previous session context"
... (truncated)
```
