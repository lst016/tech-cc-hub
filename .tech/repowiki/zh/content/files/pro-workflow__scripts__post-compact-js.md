# pro-workflow/scripts/post-compact.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：47

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `fs@3`
- `path@4`
- `os@5`
- `data@6`
- `input@11`
- `tempDir@12`
- `compactsDir@14`
- `restored@15`
- `files@18`
- `saved@20`

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
process.stdin.setEncoding('utf8');
const fs = require('fs');
const path = require('path');
const os = require('os');

let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);

    const tempDir = path.join(os.tmpdir(), 'pro-workflow');
    const compactsDir = path.join(tempDir, 'compacts');

    let restored = false;
    if (fs.existsSync(compactsDir)) {
      const files = fs.readdirSync(compactsDir).filter(f => f.endsWith('.json')).sort().reverse();
      if (files.length > 0) {
        const saved = JSON.parse(fs.readFileSync(path.join(compactsDir, files[0]), 'utf8'));
        console.error('[ProWorkflow] Context restored after compaction:');
        if (saved.summary) {
          console.error('[ProWorkflow]   Summary: ' + saved.summary);
        }
        if (saved.edits_before_compact) {
          console.error('[ProWorkflow]   Edits before compact: ' + saved.edits_before_compact);
        }
        if (saved.prompts_before_compact) {
          console.error('[ProWorkflow]   Prompts before compact: ' + saved.prompts_before_compact);
        }
        if (saved.session_id) {
          console.error('[ProWorkflow]   Session: ' + saved.session_id);
        }
        restored = true;
      }
    }
    if (!restored) {
      console.error('[ProWorkflow] Post-compact: no saved context found (pre-compact may not have run)');
    }

    console.log(data);
  } catch (err) {
    console.error('[ProWorkflow] JSON parse error:', err.message);
    console.log(data || '{}');
  }
});

```
