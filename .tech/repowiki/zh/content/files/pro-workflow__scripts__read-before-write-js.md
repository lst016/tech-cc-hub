# pro-workflow/scripts/read-before-write.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：80

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
- `readTrackFile@22`
- `input@24`
- `tool@38`
- `toolInput@40`
- `readFiles@41`
- `filePath@52`
- `normalizedPath@54`
- `filePath@62`
- `normalizedPath@70`

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

  const readTrackFile = path.join(tempDir, `reads-${sessionId}.json`);

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

  const tool = parsed.tool_name || parsed.tool || '';
  const toolInput = parsed.tool_input || {};

  let readFiles = {};
  if (fs.existsSync(readTrackFile)) {
    try {
      readFiles = JSON.parse(fs.readFileSync(readTrackFile, 'utf8'));
    } catch (e) {
      readFiles = {};
    }
  }

  if (tool === 'Read') {
    const filePath = toolInput.file_path || '';
    if (filePath) {
      const normalizedPath = path.resolve(filePath);
      readFiles[normalizedPath] = Date.now();
      fs.writeFileSync(readTrackFile, JSON.stringify(readFiles));
    }
    process.exit(0);
  }

  if (tool === 'Write' || tool === 'Edit') {
    const filePath = toolInput.file_path || '';
    if (!filePath) {
      process.exit(0);
    }

    if (tool === 'Write' && !fs.existsSync(filePath)) {
      process.exit(0);
    }

    const normalizedPath = path.resolve(filePath);
    if (!readFiles[normalizedPath]) {
      console.error(`[TokenEfficiency] Warning: ${tool} on ${path.basename(filePath)} without reading it first. Read the file before modifying.`);
    }
  }

  process.exit(0);
}

main().catch(() => process.exit(0));
```
