# pro-workflow/scripts/cwd-changed.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：40

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `fs@2`
- `path@3`
- `data@6`
- `input@10`
- `newCwd@11`
- `hasGit@12`
- `hasPackageJson@14`
- `hasClaude@15`
- `type@23`

## 依赖输入

- `fs`
- `path`

## Agent 使用提示

- 修改此文件前，先查看同模块页面和本页的运行信号。
- 如果本页包含 IPC、MCP、DB 表或 UI 调用，改动后要同时验证前后端桥接和索引结果。
- 检索时可以用文件名、关键符号名、IPC channel 或表名作为 query。

## 源码摘录

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

process.stdin.setEncoding('utf8');
let data = '';
process.stdin.on('data', chunk => { data += chunk; });
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(data);
    const newCwd = input.cwd || process.cwd();

    const hasGit = fs.existsSync(path.join(newCwd, '.git'));
    const hasPackageJson = fs.existsSync(path.join(newCwd, 'package.json'));
    const hasClaude = fs.existsSync(path.join(newCwd, 'CLAUDE.md')) || fs.existsSync(path.join(newCwd, '.claude'));

    console.error(`[ProWorkflow] Directory changed: ${path.basename(newCwd)}`);
    if (hasGit) console.error('[ProWorkflow]   Git: yes');
    if (hasPackageJson) console.error('[ProWorkflow]   Node project detected');
    if (!hasClaude) console.error('[ProWorkflow]   No CLAUDE.md — consider /auto-setup');

    if (process.env.CLAUDE_ENV_FILE) {
      const type = hasPackageJson ? 'node'
        : fs.existsSync(path.join(newCwd, 'Cargo.toml')) ? 'rust'
        : fs.existsSync(path.join(newCwd, 'go.mod')) ? 'go'
        : fs.existsSync(path.join(newCwd, 'pyproject.toml')) ? 'python'
        : null;

      if (type) {
        try { fs.appendFileSync(process.env.CLAUDE_ENV_FILE, `export PRO_WORKFLOW_PROJECT_TYPE=${type}\n`); }
        catch (e) { /* env file may not exist yet */ }
      }
    }

    console.log(data);
  } catch (err) {
    console.log(data || '{}');
  }
});

```
