# pro-workflow/scripts/tool-call-budget.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：57

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `getTempDir@5`
- `ensureDir@9`
- `main@15`
- `fs@2`
- `path@3`
- `os@4`
- `rawSessionId@17`
- `sessionId@19`
- `tempDir@20`
- `budgetFile@22`
- `count@24`
- `thresholds@31`

## 依赖输入

- `fs`
- `path`
- `os`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

function getTempDir() {
  return path.join(os.tmpdir(), 'pro-workflow');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  const rawSessionId = process.env.CLAUDE_SESSION_ID || String(process.ppid) || 'default';
  // Sanitize sessionId to prevent path traversal
  const sessionId = rawSessionId.replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
  const tempDir = getTempDir();
  ensureDir(tempDir);

  const budgetFile = path.join(tempDir, `tool-budget-${sessionId}`);

  let count = 0;
  if (fs.existsSync(budgetFile)) {
    count = parseInt(fs.readFileSync(budgetFile, 'utf8').trim(), 10) || 0;
  }
  count++;
  fs.writeFileSync(budgetFile, String(count));

  const thresholds = [
    { limit: 20, warn: 15, label: 'quick-fix budget (20 calls)' },
    { limit: 30, warn: 25, label: 'bug-fix budget (30 calls)' },
    { limit: 50, warn: 40, label: 'feature budget (50 calls)' },
    { limit: 80, warn: 65, label: 'large-feature budget (80 calls)' }
  ];

  for (const t of thresholds) {
    if (count === t.warn) {
      console.error(`[TokenEfficiency] ${count} tool calls — approaching ${t.label}. Consider wrapping up or compacting.`);
      break;
    }
    if (count === t.limit) {
      console.error(`[TokenEfficiency] ${count} tool calls — hit ${t.label}. Commit progress and assess remaining work.`);
      break;
    }
  }

  if (count === 65) {
    console.error('[TokenEfficiency] 65 tool calls — approaching large-feature limit. Wrap up current task.');
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
```
