# pro-workflow/scripts/setup-hook.js

> 模块：`pro-workflow` · 语言：`javascript` · 行数：56

## 文件职责

这是项目入口文件或运行入口，优先阅读它可以理解启动链路和主流程。

## 关键符号

- `fs@2`
- `path@3`
- `os@4`
- `data@7`
- `input@11`
- `trigger@12`
- `cwd@13`
- `checks@17`
- `tempDir@34`
- `denialsFile@35`
- `denials@38`
- `ONE_WEEK_MS@39`
- `recent@40`
- `age@41`

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
    const trigger = input.trigger || 'unknown';
    const cwd = process.cwd();

    if (trigger === 'init') {
      console.error('[ProWorkflow] Initial setup detected');

      const checks = [];
      if (fs.existsSync(path.join(cwd, 'package.json'))) checks.push('Node.js project');
      if (fs.existsSync(path.join(cwd, 'Cargo.toml'))) checks.push('Rust project');
      if (fs.existsSync(path.join(cwd, 'go.mod'))) checks.push('Go project');
      if (fs.existsSync(path.join(cwd, 'pyproject.toml'))) checks.push('Python project');

      if (checks.length > 0) {
        console.error(`[ProWorkflow] Detected: ${checks.join(', ')}`);
      }

      if (!fs.existsSync(path.join(cwd, 'CLAUDE.md')) && !fs.existsSync(path.join(cwd, '.claude'))) {
        console.error('[ProWorkflow] No CLAUDE.md found — use /auto-setup to configure');
      }
    }

    if (trigger === 'maintenance') {
      const tempDir = path.join(os.tmpdir(), 'pro-workflow');
      const denialsFile = path.join(tempDir, 'permission-denials.json');
      if (fs.existsSync(denialsFile)) {
        try {
          const denials = JSON.parse(fs.readFileSync(denialsFile, 'utf8'));
          const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
          const recent = denials.filter(d => {
            const age = Date.now() - new Date(d.timestamp).getTime();
            return age >= 0 && age < ONE_WEEK_MS;
          });
          if (recent.length > 20) {
            console.error(`[ProWorkflow] ${recent.length} permission denials this week — consider /permission-tuner`);
          }
        } catch (e) { /* ignore */ }
      }
    }

    console.log(data);
  } catch (err) {
    console.log('{}');
  }
});

```
