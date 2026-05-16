# pro-workflow/scripts/reread-tracker.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：82

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
- `trackFile@22`
- `input@24`
- `toolInput@38`
- `filePath@40`
- `tracked@44`
- `lastRead@53`
- `now@55`
- `modified@58`
- `stat@60`
- `readCount@67`

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

  const trackFile = path.join(tempDir, `read-track-${sessionId}.json`);

  let input = '';
  try {
    input = fs.readFileSync(0, 'utf8');
  } catch (e) {
    process.exit(0);
  }

  let parsed;
  try {
    parsed = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  const toolInput = parsed.tool_input || {};
  const filePath = toolInput.file_path || '';
  if (!filePath) {
    process.exit(0);
  }

  let tracked = {};
  if (fs.existsSync(trackFile)) {
    try {
      tracked = JSON.parse(fs.readFileSync(trackFile, 'utf8'));
    } catch (e) {
      tracked = {};
    }
  }

  const lastRead = tracked[filePath];
  const now = Date.now();

  if (lastRead) {
    let modified = false;
    try {
      const stat = fs.statSync(filePath);
      modified = stat.mtimeMs > lastRead;
    } catch (e) {
      modified = true;
    }

    if (!modified) {
      const readCount = (tracked[`${filePath}:count`] || 1) + 1;
      tracked[`${filePath}:count`] = readCount;
      if (readCount >= 2) {
        console.error(`[TokenEfficiency] Hard rule violation: Re-reading ${path.basename(filePath)} (${readCount}x) — file unchanged since last read. Consider using cached knowledge.`);
        process.exit(1);
      }
    }
  }

  tracked[filePath] = now;
  fs.writeFileSync(trackFile, JSON.stringify(tracked));

  process.exit(0);
}

main().catch(() => process.exit(0));
```
