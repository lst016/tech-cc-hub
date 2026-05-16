# pro-workflow/settings.example.json

> 模块：`pro-workflow` · 语言：`json` · 行数：82

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
  "permissions": {
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl * | bash)",
      "Bash(wget * | sh)",
      "Edit(/vendor/**)",
      "Edit(/node_modules/**)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(git reset *)",
      "Bash(docker *)",
      "Bash(npm publish *)",
      "Bash(npx * deploy *)"
    ],
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Bash(npm run *)",
      "Bash(pnpm *)",
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git branch *)",
      "Bash(git checkout *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash(find *)",
      "Bash(grep *)",
      "Bash(node *)",
      "Bash(npx jest *)",
      "Bash(npx vitest *)",
      "Bash(npx tsc *)",
      "Bash(npx eslint *)",
      "MCP(github:*)",
      "MCP(context7:*)",
      "Task(*)",
      "Agent(*)"
    ]
  },
  "outputStyle": "Explanatory",
  "statusLine": "model branch tokens",
  "plansDirectory": ".claude/plans",
  "enableAllProjectMcpServers": false,
  "attribution": {
    "commitMessage": "",
    "prDescription": ""
  },
  "env": {
    "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "80"
  },
  "spinnerVerbs": [
    "Thinking",
    "Analyzing",
    "Exploring",
    "Investigating",
    "Crafting",
    "Reviewing"
  ],
  "spinnerTipsOverride": [
    "Use /compact at task boundaries to keep context fresh",
    "Shift+Tab cycles modes: Normal > Auto > Plan",
    "Ctrl+B sends the current task to background",
    "Use subagents for parallel exploration",
    "claude -w creates an instant parallel worktree session",
    "Voice mode: /voice then hold spacebar to talk",
    "Esc Esc rewinds to the last checkpoint",
    "Write tests alongside code for better AI output",
    "/doctor diagnoses configuration issues"
  ]
}

```
