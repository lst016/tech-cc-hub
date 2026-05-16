# pro-workflow/package.json

> 模块：`pro-workflow` · 语言：`json` · 行数：70

## 文件职责

这是配置文件，定义构建、运行、依赖或工具行为。

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```json
{
  "name": "pro-workflow",
  "version": "3.3.0",
  "description": "Complete AI coding workflow system with orchestration patterns, cross-agent support, reference guides, searchable learnings, and persistent research wikis",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc && node -e \"const fs=require('fs');fs.mkdirSync('dist/db',{recursive:true});fs.copyFileSync('src/db/schema.sql','dist/db/schema.sql')\"",
    "clean": "rm -rf dist",
    "prepublishOnly": "npm run build",
    "db:init": "node dist/db/index.js"
  },
  "keywords": [
    "claude-code",
    "workflow",
    "productivity",
    "self-correction",
    "worktrees",
    "hooks",
    "agents",
    "agent-teams",
    "subagents",
    "best-practices",
    "sqlite",
    "fts5",
    "adaptive-thinking",
    "context-compaction",
    "token-efficiency",
    "anti-sycophancy",
    "tool-call-budget"
  ],
  "author": {
    "name": "Rohit Ghumare",
    "url": "https://github.com/rohitg00"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/rohitg00/pro-workflow"
  },
  "license": "MIT",
  "engines": {
    "node": ">=18.0.0"
  },
  "dependencies": {
    "better-sqlite3": "^12.6.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.12",
    "@types/node": "^25.2.2",
    "typescript": "^6.0.2"
  },
  "files": [
    "dist",
    "scripts",
    "hooks",
    "commands",
    "agents",
    "contexts",
    "templates",
    "rules",
    "references",
    "skills",
    "docs",
    "config.json",
    "settings.example.json",
    "mcp-config.example.json",
    "README.md"
  ]
}

```
