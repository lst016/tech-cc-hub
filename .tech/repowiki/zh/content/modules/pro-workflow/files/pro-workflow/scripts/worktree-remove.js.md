# pro-workflow/scripts/worktree-remove.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：30

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `fs@2`
- `path@3`
- `os@4`
- `data@7`
- `input@11`
- `tempDir@14`
- `worktreeLog@16`
- `worktrees@19`

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

process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);

    console.error(`[ProWorkflow] Worktree removed: ${input.worktree_path || 'unknown'}`);

    const tempDir = path.join(os.tmpdir(), 'pro-workflow');
    const worktreeLog = path.join(tempDir, 'worktrees.json');
    if (fs.existsSync(worktreeLog)) {
      try {
        let worktrees = JSON.parse(fs.readFileSync(worktreeLog, 'utf8'));
        worktrees = worktrees.filter(w => w.worktree_path !== input.worktree_path);
        fs.writeFileSync(worktreeLog, JSON.stringify(worktrees, null, 2));
      } catch (e) { /* ignore */ }
    }

    console.log(data);
  } catch (err) {
    console.log(data || '{}');
  }
});

```
